import { describe, it, expect } from 'vitest';
import { getPullCursor, setPullCursor, cursorAfter, EPOCH } from './cursors';
import { toRemotePayload } from './outboxPayload';

/** A stand-in for the sync_metadata key/value table. */
function fakeDb(seed: Record<string, string> = {}) {
  const rows = new Map(Object.entries(seed));
  return {
    rows,
    prepare(sql: string) {
      if (sql.startsWith('SELECT value')) {
        return { get: (key: string) => (rows.has(key) ? { value: rows.get(key) } : undefined), run: () => ({}) };
      }
      if (sql.startsWith('INSERT INTO sync_metadata')) {
        return { get: () => undefined, run: (key: string, value: string) => { rows.set(key, value); return {}; } };
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
}

describe('pull cursors', () => {
  it('starts a table at the epoch when nothing has been pulled', () => {
    expect(getPullCursor(fakeDb(), 'org1', 'patients')).toBe(EPOCH);
  });

  it('falls back to the old organisation-wide cursor so an existing hub does not re-pull everything', () => {
    const db = fakeDb({ 'last_pull_timestamp:org1': '2026-09-01T00:00:00.000Z' });
    expect(getPullCursor(db, 'org1', 'billing_accounts')).toBe('2026-09-01T00:00:00.000Z');
  });

  it('prefers a table\'s own cursor over the old shared one', () => {
    const db = fakeDb({
      'last_pull_timestamp:org1': '2026-09-01T00:00:00.000Z',
      'last_pull:org1:patients': '2026-09-03T00:00:00.000Z',
    });
    expect(getPullCursor(db, 'org1', 'patients')).toBe('2026-09-03T00:00:00.000Z');
  });

  // D-01: the whole point. One table failing must not move another table on,
  // and must not move its own cursor either.
  it('leaves other tables where they were when one table advances', () => {
    const db = fakeDb();
    setPullCursor(db, 'org1', 'patients', '2026-09-04T10:00:00.000Z');

    expect(getPullCursor(db, 'org1', 'patients')).toBe('2026-09-04T10:00:00.000Z');
    expect(getPullCursor(db, 'org1', 'billing_ledger_transactions')).toBe(EPOCH);
  });

  it('keeps cursors separate between organisations', () => {
    const db = fakeDb();
    setPullCursor(db, 'org1', 'patients', '2026-09-04T10:00:00.000Z');
    expect(getPullCursor(db, 'org2', 'patients')).toBe(EPOCH);
  });
});

describe('toRemotePayload', () => {
  it('turns SQLite 0/1 into real booleans for the columns that need it', () => {
    expect(toRemotePayload('patients', { id: 'p1', commission_assigned: 1 }).commission_assigned).toBe(true);
    expect(toRemotePayload('patients', { id: 'p1', commission_assigned: 0 }).commission_assigned).toBe(false);
    expect(toRemotePayload('custom_tests', { id: 't1', is_active: 1 }).is_active).toBe(true);
  });

  it('decodes JSON columns held as text', () => {
    expect(toRemotePayload('patient_tests', { id: 't1', results: '[{"v":1}]' }).results).toEqual([{ v: 1 }]);
  });

  // The same conversion is now used by INSERT and UPDATE alike; it used to be
  // written out twice, so a column could be converted on one path only.
  it('applies the same conversion whatever the action', () => {
    const row = { id: 'p1', commission_assigned: 1 };
    expect(toRemotePayload('patients', row)).toEqual(toRemotePayload('patients', { ...row }));
  });

  it('leaves the caller\'s row untouched so a failed row can be retried as queued', () => {
    const row = { id: 't1', results: '[]', extra: 'kept' };
    toRemotePayload('patient_tests', row);
    expect(row.results).toBe('[]');
  });

  it('leaves an unparseable JSON column alone rather than throwing', () => {
    expect(toRemotePayload('patient_tests', { id: 't1', results: '{oops' }).results).toBe('{oops');
  });

  it('does not touch columns of tables it knows nothing about', () => {
    expect(toRemotePayload('organizations', { id: 'o1', is_active: 1 }).is_active).toBe(1);
  });
});

describe('Where the cursor stands after a pull', () => {
  it('moves to the newest timestamp the cloud stamped, not the hub clock', () => {
    const rows = [
      { updated_at: '2026-09-12T10:00:00.000Z' },
      { updated_at: '2026-09-12T10:00:05.123456Z' },
      { updated_at: '2026-09-12T09:59:59.000Z' },
    ];
    expect(cursorAfter(rows, 'updated_at', '2026-09-12T09:00:00.000Z')).toBe('2026-09-12T10:00:05.123456Z');
  });

  it('stays put when the pull returned nothing', () => {
    expect(cursorAfter([], 'updated_at', '2026-09-12T09:00:00.000Z')).toBe('2026-09-12T09:00:00.000Z');
  });

  it('never goes backwards, and ignores rows without a stamp', () => {
    const rows = [{ updated_at: '2026-09-12T08:00:00.000Z' }, { updated_at: null }, {}];
    expect(cursorAfter(rows, 'updated_at', '2026-09-12T09:00:00.000Z')).toBe('2026-09-12T09:00:00.000Z');
  });
});
