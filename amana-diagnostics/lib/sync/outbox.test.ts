import { describe, it, expect } from 'vitest';
import { pushOutbox, countPending, countDeadLetters, requeueDeadLetters, MAX_ATTEMPTS, OutboxRow } from './outbox';

/**
 * A stand-in for the sync_outbox table that records what was run against it, so
 * a test can assert on the thing that actually matters here: whether a row was
 * deleted, and whether it was deleted having been sent.
 */
function fakeDb(rows: OutboxRow[]) {
  const state = rows.map(r => ({ attempts: 0, dead: 0, last_error: null as string | null, ...r }));
  const deleted: number[] = [];

  return {
    state,
    deleted,
    prepare(sql: string) {
      if (sql.startsWith('SELECT id, table_name')) {
        return { all: () => state.filter(r => r.dead === 0), get: () => undefined, run: () => ({}) };
      }
      if (sql.startsWith('UPDATE sync_outbox SET attempts')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (attempts: number, lastError: string, _at: number, dead: number, id: number) => {
            const row = state.find(r => r.id === id)!;
            row.attempts = attempts;
            row.last_error = lastError;
            row.dead = dead;
            return {};
          },
        };
      }
      if (sql.startsWith('DELETE FROM sync_outbox')) {
        return {
          all: () => [],
          get: () => undefined,
          run: (id: number) => { deleted.push(id); const i = state.findIndex(r => r.id === id); if (i >= 0) state.splice(i, 1); return {}; },
        };
      }
      if (sql.includes('COUNT(*)') && sql.includes('dead = 1')) {
        return { all: () => [], get: () => ({ count: state.filter(r => r.dead === 1).length }), run: () => ({}) };
      }
      if (sql.includes('COUNT(*)') && sql.includes('dead = 0')) {
        return { all: () => [], get: () => ({ count: state.filter(r => r.dead === 0).length }), run: () => ({}) };
      }
      if (sql.startsWith('UPDATE sync_outbox SET dead = 0')) {
        return {
          all: () => [],
          get: () => undefined,
          run: () => {
            const hit = state.filter(r => r.dead === 1);
            hit.forEach(r => { r.dead = 0; r.attempts = 0; r.last_error = null; });
            return { changes: hit.length };
          },
        };
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
}

/** A Supabase stand-in that answers each table with a fixed result. */
function fakeSupabase(answers: Record<string, { error: any } | undefined>, calls: string[] = []) {
  const result = (table: string) => {
    calls.push(table);
    return Promise.resolve(answers[table] ?? { error: null });
  };
  return {
    calls,
    from(table: string) {
      const thenable = {
        eq: () => thenable,
        then: (res: any, rej: any) => result(table).then(res, rej),
      };
      return {
        delete: () => thenable,
        update: () => thenable,
        upsert: () => result(table),
      };
    },
  };
}

const row = (over: Partial<OutboxRow> = {}): OutboxRow => ({
  id: 1, table_name: 'patients', action: 'INSERT', record_id: 'p1', payload: '{"id":"p1"}', ...over,
});

describe('pushOutbox', () => {
  it('deletes a row only once the cloud has accepted it', async () => {
    const db = fakeDb([row({ id: 1 })]);
    const result = await pushOutbox(db, fakeSupabase({}) as any);

    expect(result.pushed).toBe(1);
    expect(db.deleted).toEqual([1]);
  });

  // D-02: a missing table used to delete the row and call it done, losing the
  // clinic's work outright.
  it('keeps a row that the cloud rejected instead of deleting it', async () => {
    const db = fakeDb([row({ id: 1 })]);
    const supabase = fakeSupabase({ patients: { error: { code: '42P01', message: 'relation does not exist' } } });

    const result = await pushOutbox(db, supabase as any);

    expect(db.deleted).toEqual([]);
    expect(result.pushed).toBe(0);
    expect(db.state[0].attempts).toBe(1);
    expect(db.state[0].last_error).toContain('relation does not exist');
  });

  // Ordering matters: a patient must exist before their tests are sent.
  it('stops at a failing row rather than letting later rows overtake it', async () => {
    const db = fakeDb([
      row({ id: 1, table_name: 'patients' }),
      row({ id: 2, table_name: 'patient_tests' }),
    ]);
    const calls: string[] = [];
    const supabase = fakeSupabase({ patients: { error: { message: 'timeout' } } }, calls);

    const result = await pushOutbox(db, supabase as any);

    expect(result.stalledOutboxId).toBe(1);
    expect(calls).toEqual(['patients']);
    expect(db.state.find(r => r.id === 2)!.attempts).toBe(0);
  });

  // D-03: one unacceptable row used to freeze every later change for good.
  it('sets a row aside after MAX_ATTEMPTS so the rest of the queue can drain', async () => {
    const db = fakeDb([
      row({ id: 1, table_name: 'patients', attempts: MAX_ATTEMPTS - 1 }),
      row({ id: 2, table_name: 'patient_tests' }),
    ]);
    const supabase = fakeSupabase({ patients: { error: { message: 'invalid foreign key' } } });

    const result = await pushOutbox(db, supabase as any);

    expect(result.deadLettered).toBe(1);
    expect(result.stalledOutboxId).toBeUndefined();
    expect(result.pushed).toBe(1);            // the row behind it went up
    expect(db.deleted).toEqual([2]);
    expect(db.state.find(r => r.id === 1)!.dead).toBe(1);
  });

  it('passes over rows already set aside on later runs', async () => {
    const db = fakeDb([row({ id: 1 })]);
    db.state[0].dead = 1;
    const calls: string[] = [];

    const result = await pushOutbox(db, fakeSupabase({}, calls) as any);

    expect(calls).toEqual([]);
    expect(result.pushed).toBe(0);
    expect(countDeadLetters(db)).toBe(1);
    expect(countPending(db)).toBe(0);
  });

  it('records an unreadable payload rather than throwing the whole run away', async () => {
    const db = fakeDb([row({ id: 1, payload: 'not json' })]);

    const result = await pushOutbox(db, fakeSupabase({}) as any);

    expect(db.deleted).toEqual([]);
    expect(result.stalledOutboxId).toBe(1);
    expect(db.state[0].last_error).toContain('Unreadable outbox payload');
  });

  it('offers set-aside rows back to the queue with a clean slate', async () => {
    const db = fakeDb([row({ id: 1 })]);
    db.state[0].dead = 1;
    db.state[0].attempts = MAX_ATTEMPTS;

    expect(requeueDeadLetters(db)).toBe(1);
    expect(db.state[0].dead).toBe(0);
    expect(db.state[0].attempts).toBe(0);
    expect(countPending(db)).toBe(1);
  });
});

/**
 * A refusal that is about the caller, not the row. Being signed out — an
 * expired session, a token that never reached the hub — makes the cloud refuse
 * every row, and five refusals used to set the row aside for good. A morning's
 * results were then "safe here but will not send" until a developer looked,
 * for no fault in the results.
 */
describe('pushOutbox when the cloud does not know who is asking', () => {
  it.each([
    { message: 'new row violates row-level security policy for table "patient_tests"', code: '42501' },
    { message: 'JWT expired', code: 'PGRST301' },
    { message: 'Invalid JWT', code: '401' },
    { message: 'permission denied for table patients', code: '42501' },
  ])('stalls on "$message" without spending an attempt', async (error) => {
    const db = fakeDb([row({ id: 1 }), row({ id: 2 })]);
    const result = await pushOutbox(db, fakeSupabase({ patients: { error } }) as any);

    expect(result.stalledOutboxId).toBe(1);
    expect(result.unauthenticated).toBe(true);
    expect(db.state[0].attempts).toBe(0);
    expect(db.state[0].dead).toBe(0);
    expect(db.deleted).toEqual([]);
  });

  it('cannot dead-letter a row however long the session stays expired', async () => {
    const db = fakeDb([row({ id: 1 })]);
    const supabase = fakeSupabase({ patients: { error: { message: 'JWT expired', code: 'PGRST301' } } }) as any;
    for (let i = 0; i < MAX_ATTEMPTS * 3; i++) await pushOutbox(db, supabase);

    expect(db.state[0].dead).toBe(0);
    expect(countDeadLetters(db)).toBe(0);
  });
});
