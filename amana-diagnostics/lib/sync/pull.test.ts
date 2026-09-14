import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { initDb, queueSync } from '@/lib/localDb';
import { pullAll, MAX_PULL_ATTEMPTS, countDeadPullRows } from './pull';
import { getPullCursor } from './cursors';
import { fakeCloud } from './fakeCloud';

/**
 * The pull, against a real SQLite database and a cloud stand-in that answers
 * the way PostgREST does. Each case is a way the old pull lost data.
 */

const ORG = '11111111-1111-1111-1111-111111111111';
const T = (n: number) => `2026-09-12T10:${String(n).padStart(2, '0')}:00.000000+00:00`;

let db: DatabaseSync;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  initDb(db);
});

const patient = (id: number, over: Record<string, any> = {}) => ({
  id, organization_id: ORG, first_name: 'Musa', surname: 'Bello', slip_number: `S${id}`,
  registered_at: T(0), updated_at: T(1), commission_assigned: false, ...over,
});

const localPatient = (id: number) =>
  db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as Record<string, any> | undefined;

describe('pulling rows', () => {
  it('writes the cloud rows the hub does not have, converting types for SQLite', async () => {
    const cloud = fakeCloud({
      patients: [patient(1, { commission_assigned: true })],
      patient_tests: [{ id: 't1', patient_id: 1, organization_id: ORG, test_id: 'fbc', test_name: 'FBC', department: 'lab', status: 'completed', results: [{ parameter: 'WBC', result: '5' }], updated_at: T(2) }],
    });

    const result = await pullAll(db, cloud, ORG);

    expect(result.failedTables).toEqual([]);
    expect(localPatient(1)?.commission_assigned).toBe(1);
    const test = db.prepare('SELECT * FROM patient_tests WHERE id = ?').get('t1') as any;
    expect(JSON.parse(test.results)).toEqual([{ parameter: 'WBC', result: '5' }]);
  });

  it('lets the newer copy win, in either direction', async () => {
    db.prepare(`INSERT INTO patients (id, organization_id, first_name, surname, updated_at) VALUES (1, ?, 'Local', 'Newer', ?)`).run(ORG, T(5));
    db.prepare(`INSERT INTO patients (id, organization_id, first_name, surname, updated_at) VALUES (2, ?, 'Local', 'Older', ?)`).run(ORG, T(1));
    const cloud = fakeCloud({
      patients: [patient(1, { first_name: 'Cloud', updated_at: T(3) }), patient(2, { first_name: 'Cloud', updated_at: T(3) })],
    });

    await pullAll(db, cloud, ORG);

    expect(localPatient(1)?.first_name).toBe('Local'); // hub's edit was later
    expect(localPatient(2)?.first_name).toBe('Cloud'); // cloud's edit was later
  });

  it('moves the cursor to the newest stamp seen, in the cloud clock', async () => {
    const cloud = fakeCloud({ patients: [patient(1, { updated_at: T(7) }), patient(2, { updated_at: T(4) })] });
    await pullAll(db, cloud, ORG);
    expect(getPullCursor(db, ORG, 'patients')).toBe(T(7));
  });

  it('re-reads the row at the cursor rather than skipping it', async () => {
    // Two rows with the same stamp; the first pull saw one of them.
    const cloud = fakeCloud({ patients: [patient(1, { updated_at: T(3) })] });
    await pullAll(db, cloud, ORG);
    cloud.data.patients.push(patient(2, { updated_at: T(3) }));

    await pullAll(db, cloud, ORG);

    expect(localPatient(2)).toBeDefined();
  });

  it('pages a large change set by keyset without dropping a row', async () => {
    const rows = Array.from({ length: 2350 }, (_, i) => patient(i + 1, { updated_at: T(Math.floor(i / 500)) }));
    const cloud = fakeCloud({ patients: rows });

    const result = await pullAll(db, cloud, ORG);

    expect(result.failedTables).toEqual([]);
    const n = (db.prepare('SELECT COUNT(*) AS n FROM patients').get() as any).n;
    expect(n).toBe(2350);
  });

  it('holds a table\'s cursor when its fetch fails, and still pulls the others', async () => {
    const cloud = fakeCloud(
      { patients: [patient(1)], referring_doctors: [] },
      { failing: { patients: { message: 'connection reset' } } },
    );

    const result = await pullAll(db, cloud, ORG);

    expect(result.failedTables).toEqual(['patients']);
    expect(getPullCursor(db, ORG, 'patients')).toBe('1970-01-01T00:00:00.000Z');
    expect(localPatient(1)).toBeUndefined();
  });
});

describe('a row the hub cannot write', () => {
  it('is set aside and the rows after it still land', async () => {
    // patient_tests.patient_id references patients: t-orphan has no parent.
    const cloud = fakeCloud({
      patients: [patient(1)],
      patient_tests: [
        { id: 't-orphan', patient_id: 999, organization_id: ORG, test_id: 'fbc', test_name: 'FBC', department: 'lab', status: 'pending', updated_at: T(1) },
        { id: 't-ok', patient_id: 1, organization_id: ORG, test_id: 'fbc', test_name: 'FBC', department: 'lab', status: 'pending', updated_at: T(2) },
      ],
    });

    const result = await pullAll(db, cloud, ORG);

    expect(result.failedTables).toEqual([]);
    expect(db.prepare('SELECT id FROM patient_tests').all().map((r: any) => r.id)).toEqual(['t-ok']);
    expect(getPullCursor(db, ORG, 'patient_tests')).toBe(T(2));
    const failure = db.prepare('SELECT * FROM sync_pull_failures').get() as any;
    expect(failure.record_key).toBe('t-orphan');
    expect(failure.attempts).toBe(1);
  });

  it('is retried by identity on later runs and lands once it can', async () => {
    const orphan = { id: 't-orphan', patient_id: 7, organization_id: ORG, test_id: 'fbc', test_name: 'FBC', department: 'lab', status: 'pending', updated_at: T(1) };
    const cloud = fakeCloud({ patient_tests: [orphan] });
    await pullAll(db, cloud, ORG);
    expect(db.prepare('SELECT COUNT(*) AS n FROM patient_tests').get()).toEqual({ n: 0 });

    // The parent turns up. Nothing about the test has changed, so the cursor
    // would never find it again — the retry by identity does.
    cloud.data.patients = [patient(7, { updated_at: T(9) })];
    await pullAll(db, cloud, ORG);

    expect(db.prepare('SELECT id FROM patient_tests').all().map((r: any) => r.id)).toEqual(['t-orphan']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM sync_pull_failures').get()).toEqual({ n: 0 });
  });

  it('is reported after enough attempts, not retried for ever', async () => {
    const orphan = { id: 't-orphan', patient_id: 999, organization_id: ORG, test_id: 'fbc', test_name: 'FBC', department: 'lab', status: 'pending', updated_at: T(1) };
    const cloud = fakeCloud({ patient_tests: [orphan] });

    let result;
    for (let i = 0; i < MAX_PULL_ATTEMPTS + 2; i++) result = await pullAll(db, cloud, ORG);

    expect(countDeadPullRows(db)).toBe(1);
    expect(result!.deadRows).toBe(0); // reported once, on the run it died
  });
});

describe('deletes', () => {
  it('apply a tombstone from the cloud', async () => {
    db.prepare(`INSERT INTO referring_doctors (id, organization_id, name, commission_type, commission_value, updated_at) VALUES ('d1', ?, 'Dr A', 'none', 0, ?)`).run(ORG, T(1));
    const cloud = fakeCloud({
      sync_tombstones: [{ id: 1, organization_id: ORG, table_name: 'referring_doctors', record_key: 'd1', deleted_at: T(5) }],
    });

    const result = await pullAll(db, cloud, ORG);

    expect(result.deleted).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM referring_doctors').get()).toEqual({ n: 0 });
    expect(getPullCursor(db, ORG, 'sync_tombstones')).toBe(T(5));
  });

  it('keep a row the hub changed after the cloud deleted it, so the push puts it back', async () => {
    db.prepare(`INSERT INTO referring_doctors (id, organization_id, name, commission_type, commission_value, updated_at) VALUES ('d1', ?, 'Dr A', 'none', 0, ?)`).run(ORG, T(8));
    const cloud = fakeCloud({
      sync_tombstones: [{ id: 1, organization_id: ORG, table_name: 'referring_doctors', record_key: 'd1', deleted_at: T(5) }],
    });

    await pullAll(db, cloud, ORG);

    expect(db.prepare('SELECT COUNT(*) AS n FROM referring_doctors').get()).toEqual({ n: 1 });
  });

  it('drop a pending outbox row for a record the delete won, so the push cannot resurrect it', async () => {
    db.prepare(`INSERT INTO referring_doctors (id, organization_id, name, commission_type, commission_value, updated_at) VALUES ('d1', ?, 'Dr A', 'none', 0, ?)`).run(ORG, T(1));
    queueSync(db, 'referring_doctors', 'UPDATE', 'd1', { id: 'd1', name: 'Dr A' });
    const cloud = fakeCloud({
      sync_tombstones: [{ id: 1, organization_id: ORG, table_name: 'referring_doctors', record_key: 'd1', deleted_at: T(5) }],
    });

    await pullAll(db, cloud, ORG);

    expect(db.prepare('SELECT COUNT(*) AS n FROM sync_outbox').get()).toEqual({ n: 0 });
  });

  it('are a degraded state, not a failed sync, on a cloud without the tombstone table', async () => {
    const cloud = fakeCloud({ patients: [patient(1)] }, { missing: ['sync_tombstones'] });
    const result = await pullAll(db, cloud, ORG);
    expect(result.failedTables).toEqual([]);
    expect(localPatient(1)).toBeDefined();
  });
});

describe('whole-set tables', () => {
  it('detach a colleague the cloud no longer lists in the clinic', async () => {
    db.prepare(`INSERT INTO profiles (id, full_name, role, organization_id) VALUES ('u1', 'Still here', 'lab', ?)`).run(ORG);
    db.prepare(`INSERT INTO profiles (id, full_name, role, organization_id) VALUES ('u2', 'Removed on the web', 'lab', ?)`).run(ORG);
    const cloud = fakeCloud({ profiles: [{ id: 'u1', full_name: 'Still here', role: 'lab', organization_id: ORG }] });

    await pullAll(db, cloud, ORG);

    const gone = db.prepare('SELECT organization_id FROM profiles WHERE id = ?').get('u2') as any;
    expect(gone.organization_id).toBeNull();
    expect((db.prepare('SELECT organization_id FROM profiles WHERE id = ?').get('u1') as any).organization_id).toBe(ORG);
  });

  it('do not detach anyone when the set could not be read', async () => {
    db.prepare(`INSERT INTO profiles (id, full_name, role, organization_id) VALUES ('u1', 'Still here', 'lab', ?)`).run(ORG);
    const cloud = fakeCloud({ profiles: [] }, { failing: { profiles: { message: 'timeout' } } });

    const result = await pullAll(db, cloud, ORG);

    expect(result.failedTables).toContain('profiles');
    expect((db.prepare('SELECT organization_id FROM profiles WHERE id = ?').get('u1') as any).organization_id).toBe(ORG);
  });

  it('delete a price the cloud has removed', async () => {
    db.prepare(`INSERT INTO test_prices (organization_id, test_id, test_name, price) VALUES (?, 'fbc', 'FBC', 5000)`).run(ORG);
    db.prepare(`INSERT INTO test_prices (organization_id, test_id, test_name, price) VALUES (?, 'old', 'Old', 100)`).run(ORG);
    const cloud = fakeCloud({ test_prices: [{ organization_id: ORG, test_id: 'fbc', test_name: 'FBC', price: 5500 }] });

    await pullAll(db, cloud, ORG);

    const prices = db.prepare('SELECT test_id, price FROM test_prices ORDER BY test_id').all();
    expect(prices).toEqual([{ test_id: 'fbc', price: 5500 }]);
  });
});
