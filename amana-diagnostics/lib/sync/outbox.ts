import { toRemotePayload } from './outboxPayload';
import { syncTable, isCommandRow, commandPath } from './tables';

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
  /**
   * Command rows left waiting for someone with the standing to send them —
   * a staff change needs an administrator's session. They do not stop the
   * table rows behind them.
   */
  commandsWaiting?: number;
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

/** What a command row needs that a table row does not: somewhere to POST, and who is asking. */
export interface PushOptions {
  /** The cloud deployment a command row is sent to. */
  cloudOrigin?: string;
  /** The session the command is made under. Without one, commands stall as unauthenticated. */
  accessToken?: string | null;
  /** Injectable for tests. */
  fetch?: typeof fetch;
}

/**
 * An integer id that was stored as "10000039.0" — a number bound into a TEXT
 * column by an older hub — is the integer it was meant to be. Rows already
 * queued that way go up; `queueSync` no longer produces them.
 */
export function normaliseKey(key: string): string {
  return /^d+.0$/.test(key) ? key.slice(0, -2) : key;
}

/** Applies one outbox row to the cloud. Throws nothing; reports the error instead. */
async function sendRow(
  supabase: RemoteClient,
  row: OutboxRow,
  options: PushOptions,
): Promise<{ ok: true } | { ok: false; error: string; unauthenticated?: boolean }> {
  const { table_name, action, record_id, payload } = row;

  if (isCommandRow(table_name)) return sendCommand(row, options);

  let data: Record<string, any>;
  try {
    data = toRemotePayload(table_name, JSON.parse(payload));
  } catch (err: any) {
    // The queued payload itself is unreadable. No number of retries fixes that,
    // but it still is not deleted — it is left to be dead-lettered and seen.
    return { ok: false, error: `Unreadable outbox payload: ${err?.message || err}` };
  }

  /**
   * Narrows a query to the row, whether the table is keyed by id or by a
   * pair. A composite key's `record_id` is "organizationId:key".
   */
  const scopedTo = (query: any) => {
    const key = syncTable(table_name)?.key ?? ['id'];
    if (key.length === 1) return query.eq(key[0], normaliseKey(record_id));
    const parts = record_id.split(':').map(normaliseKey);
    return key.reduce((q: any, column: string, i: number) => q.eq(column, parts[i]), query);
  };

  try {
    const { error } =
      action === 'DELETE' ? await scopedTo(supabase.from(table_name).delete())
      : action === 'UPDATE' ? await conditionalUpdate(supabase, table_name, data, scopedTo)
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
 * An UPDATE that loses to a newer cloud copy, instead of overwriting it.
 *
 * The pull has always let the newer `updated_at` win. The push did not: a
 * result edited on the hub while offline overwrote a later web-side edit
 * the moment the hub reconnected, whatever the stamps said. The rule is now
 * the same in both directions. An update is applied only where the cloud's
 * stamp is not newer; if the cloud has no such row at all (it was deleted
 * there after the hub's edit — the hub's edit is the newer fact), the row
 * is put back. A table with no version column updates unconditionally, as
 * before.
 */
async function conditionalUpdate(
  supabase: RemoteClient,
  tableName: string,
  data: Record<string, any>,
  scopedTo: (query: any) => any,
): Promise<{ error: any }> {
  const spec = syncTable(tableName);
  const ver = spec?.versionColumn;
  const stamp = ver ? data[ver] : undefined;
  if (!ver || typeof stamp !== 'string') {
    return scopedTo(supabase.from(tableName).update(data));
  }

  const keyColumn = spec!.key[spec!.key.length - 1];
  const quotedStamp = `"${stamp.replace(/"/g, '\\"')}"`;
  const { data: matched, error } = await scopedTo(supabase.from(tableName).update(data))
    .or(`${ver}.is.null,${ver}.lte.${quotedStamp}`)
    .select(keyColumn);
  if (error) return { error };
  if (Array.isArray(matched) && matched.length > 0) return { error: null };

  const { data: existing, error: lookupError } = await scopedTo(
    supabase.from(tableName).select(`${keyColumn},${ver}`),
  ).maybeSingle();
  if (lookupError) return { error: lookupError };
  if (existing) {
    console.warn(`[Sync] ${tableName} ${data[keyColumn] ?? ''}: the cloud's copy is newer (${existing[ver]} > ${stamp}); the hub's change was not applied.`);
    return { error: null };
  }
  return supabase.from(tableName).upsert(data);
}

/**
 * Sends a command row to the cloud deployment's own route.
 *
 * Refusals are classified the same way as for a table row: a 401 or 403 is
 * about who is asking — an administrator has to be signed in for a staff
 * change — and stalls the queue without spending an attempt. Anything else
 * counts against the row.
 */
async function sendCommand(
  row: OutboxRow,
  options: PushOptions,
): Promise<{ ok: true } | { ok: false; error: string; unauthenticated?: boolean }> {
  if (!options.accessToken) {
    return { ok: false, error: 'Sign in to send this change', unauthenticated: true };
  }
  if (!options.cloudOrigin) {
    return { ok: false, error: 'No cloud origin configured for command rows' };
  }
  const doFetch = options.fetch ?? fetch;
  try {
    const res = await doFetch(`${options.cloudOrigin}${commandPath(row.table_name)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.accessToken}`,
      },
      body: row.payload,
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    const error = body?.error || `HTTP ${res.status}`;
    return { ok: false, error, unauthenticated: res.status === 401 || res.status === 403 };
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
export async function pushOutbox(db: OutboxDb, supabase: RemoteClient, options: PushOptions = {}): Promise<PushResult> {
  const rows = db
    .prepare('SELECT id, table_name, action, record_id, payload, attempts FROM sync_outbox WHERE dead = 0 ORDER BY id ASC')
    .all() as OutboxRow[];

  const markFailed = db.prepare(
    'UPDATE sync_outbox SET attempts = ?, last_error = ?, last_attempt_at = ?, dead = ? WHERE id = ?',
  );
  const deleteRow = db.prepare('DELETE FROM sync_outbox WHERE id = ?');

  const result: PushResult = { pushed: 0, deadLettered: 0 };

  for (const row of rows) {
    const outcome = await sendRow(supabase, row, options);

    if (outcome.ok) {
      deleteRow.run(row.id);
      result.pushed += 1;
      continue;
    }

    if (outcome.unauthenticated && isCommandRow(row.table_name)) {
      // A command is independent of the rows around it — nothing after it
      // references it — so it waits for a session that can send it without
      // holding up a morning's results. Nothing is counted against it.
      console.warn(`[Sync] Outbox ${row.id} (${row.table_name}) waits for an administrator's session: ${outcome.error}`);
      result.commandsWaiting = (result.commandsWaiting ?? 0) + 1;
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

    // A failed command holds nothing behind it; a failed row does.
    if (isCommandRow(row.table_name)) continue;

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
