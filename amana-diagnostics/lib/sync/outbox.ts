import { toRemotePayload } from './outboxPayload';

/**
 * Pushing the local outbox to the cloud.
 *
 * Three rules, each of them a bug that was in here before:
 *
 * 1. **A row is never deleted unless the cloud accepted it.** Deleting on error
 *    loses a clinic's work with nothing to show for it. The only DELETE is on
 *    the success path.
 * 2. **A transient failure stalls; it does not skip.** Rows go up in the order
 *    they were written so that a patient exists before their tests do. Skipping
 *    a failed row would send the tests of a patient who was never created.
 * 3. **A permanent failure is set aside, not retried forever.** After
 *    MAX_ATTEMPTS a row is marked dead and the queue moves past it. Before this,
 *    one unacceptable record froze every later change indefinitely and the only
 *    way out was a developer with a SQLite client.
 * 4. **A refusal about the caller is not a refusal about the row.** An expired
 *    session makes the cloud refuse everything; that is not the row's fault and
 *    does not count against it. The run stalls, the attempt is not spent, and
 *    the rows go up untouched once someone is signed in again. Before this, a
 *    hub whose session had lapsed set every result of the morning aside as
 *    permanently un-sendable within two minutes.
 */

/** Attempts before a row is set aside as permanently un-sendable. */
export const MAX_ATTEMPTS = 5;

/** Composite-keyed tables: `record_id` is "organizationId:key", not a row id. */
const COMPOSITE_KEY_COLUMN: Record<string, string> = {
  test_prices: 'test_id',
  custom_tests: 'id',
};

export interface OutboxRow {
  id: number;
  table_name: string;
  action: string;
  record_id: string;
  payload: string;
  attempts?: number;
}

export interface PushResult {
  /** Rows the cloud accepted and that have left the outbox. */
  pushed: number;
  /** Rows newly set aside as permanently un-sendable on this run. */
  deadLettered: number;
  /** Set when a row failed but has attempts left, so the run stopped there. */
  stalledOutboxId?: number;
  /** The error that stopped the run, for the caller to surface. */
  stalledReason?: string;
  /**
   * Set when the run stopped because the cloud did not accept who was asking,
   * rather than what was asked. Nothing was counted against the row.
   */
  unauthenticated?: boolean;
}

/**
 * Whether a refusal is about the session rather than the data.
 *
 * PostgREST answers an expired or missing JWT with PGRST301 or a 401, and a
 * row that RLS will not let this caller write with 42501 (insufficient
 * privilege) — the same code, and the same words, whether the policy was
 * wrong or the caller was nobody.
 */
export function isAuthFailure(error: { message?: string; code?: string } | string): boolean {
  const message = typeof error === 'string' ? error : `${error?.code ?? ''} ${error?.message ?? ''}`;
  return /(PGRST301|42501|401)|JWT|row-level security|permission denied/i.test(message);
}

/**
 * Narrow views of better-sqlite3 and supabase-js, so this can be tested
 * without either.
 */
export interface OutboxDb {
  prepare(sql: string): { all: (...a: any[]) => any[]; get: (...a: any[]) => any; run: (...a: any[]) => any };
}
export interface RemoteClient {
  from(table: string): any;
}

/** Applies one outbox row to the cloud. Throws nothing; reports the error instead. */
async function sendRow(
  supabase: RemoteClient,
  row: OutboxRow,
): Promise<{ ok: true } | { ok: false; error: string; unauthenticated?: boolean }> {
  const { table_name, action, record_id, payload } = row;

  let data: Record<string, any>;
  try {
    data = toRemotePayload(table_name, JSON.parse(payload));
  } catch (err: any) {
    // The queued payload itself is unreadable. No number of retries fixes that,
    // but it still is not deleted — it is left to be dead-lettered and seen.
    return { ok: false, error: `Unreadable outbox payload: ${err?.message || err}` };
  }

  /** Narrows a query to the row, whether the table is keyed by id or by a pair. */
  const scopedTo = (query: any) => {
    const keyColumn = COMPOSITE_KEY_COLUMN[table_name];
    if (!keyColumn) return query.eq('id', record_id);
    const [orgId, key] = record_id.split(':');
    return query.eq('organization_id', orgId).eq(keyColumn, key);
  };

  try {
    const { error } =
      action === 'DELETE' ? await scopedTo(supabase.from(table_name).delete())
      : action === 'UPDATE' ? await scopedTo(supabase.from(table_name).update(data))
      : await supabase.from(table_name).upsert(data);

    if (error) {
      return {
        ok: false,
        error: error.message || error.code || 'Unknown Supabase error',
        unauthenticated: isAuthFailure(error),
      };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Sends every pending outbox row the cloud will take, oldest first.
 *
 * Rows already set aside (`dead = 1`) are passed over — they are kept so they
 * can be inspected and re-queued, not so they can block the ones behind them.
 */
export async function pushOutbox(db: OutboxDb, supabase: RemoteClient): Promise<PushResult> {
  const rows = db
    .prepare('SELECT id, table_name, action, record_id, payload, attempts FROM sync_outbox WHERE dead = 0 ORDER BY id ASC')
    .all() as OutboxRow[];

  const markFailed = db.prepare(
    'UPDATE sync_outbox SET attempts = ?, last_error = ?, last_attempt_at = ?, dead = ? WHERE id = ?',
  );
  const deleteRow = db.prepare('DELETE FROM sync_outbox WHERE id = ?');

  const result: PushResult = { pushed: 0, deadLettered: 0 };

  for (const row of rows) {
    const outcome = await sendRow(supabase, row);

    if (outcome.ok) {
      deleteRow.run(row.id);
      result.pushed += 1;
      continue;
    }

    if (outcome.unauthenticated) {
      // The session, not the row. Stop here, spend nothing, say why.
      console.warn(`[Sync] Outbox ${row.id} refused for lack of a valid session; will retry once signed in: ${outcome.error}`);
      result.stalledOutboxId = row.id;
      result.stalledReason = outcome.error;
      result.unauthenticated = true;
      return result;
    }

    const attempts = (row.attempts ?? 0) + 1;
    const exhausted = attempts >= MAX_ATTEMPTS;
    markFailed.run(attempts, outcome.error, Date.now(), exhausted ? 1 : 0, row.id);

    console.error(
      `[Sync] Outbox ${row.id} (${row.action} ${row.table_name}) failed on attempt ${attempts}: ${outcome.error}`,
    );

    if (exhausted) {
      // Set aside so the rest of the queue can drain. It is still on disk.
      console.error(`[Sync] Outbox ${row.id} set aside after ${attempts} attempts and will not be retried automatically.`);
      result.deadLettered += 1;
      continue;
    }

    // Attempts left: stop here so later rows cannot overtake this one.
    result.stalledOutboxId = row.id;
    result.stalledReason = outcome.error;
    return result;
  }

  return result;
}

/** Rows that were set aside, for the caller to report or offer for retry. */
export function countDeadLetters(db: OutboxDb): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM sync_outbox WHERE dead = 1').get() as { count: number };
  return row.count;
}

/** Total rows still waiting to go up, excluding those set aside. */
export function countPending(db: OutboxDb): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM sync_outbox WHERE dead = 0').get() as { count: number };
  return row.count;
}

/**
 * Puts every set-aside row back in the queue with a clean slate.
 *
 * The way out of a poisoned queue without a developer: fix whatever the cloud
 * was objecting to, then ask for these to be tried again.
 */
export function requeueDeadLetters(db: OutboxDb): number {
  const info = db.prepare('UPDATE sync_outbox SET dead = 0, attempts = 0, last_error = NULL WHERE dead = 1').run();
  return info?.changes ?? 0;
}
