/**
 * Bringing the cloud's changes down to the hub.
 *
 * Driven entirely by the registry in `./tables`: for each table, fetch what
 * changed since that table's cursor (or the whole set, for the few that are
 * fetched whole), write it into SQLite under the table's conflict rule, and
 * move the cursor to the newest stamp actually written. Then the same for
 * the cloud's tombstones, applied as deletes.
 *
 * Things this does that the hand-written pull it replaces did not:
 *
 *   - **Keyset paging.** Pages were taken by offset while ordered by id. A
 *     row whose stamp moved during the pull shifted every row after it one
 *     place earlier, and the first row of the next page was skipped for
 *     good. Pages are now taken by (stamp, id) from the last row seen.
 *   - **Inclusive cursor.** `> cursor` lost any row whose stamp equalled the
 *     cursor's but had not been in the page that set it. `>=` re-reads the
 *     last row each time; the upsert is idempotent, so that costs nothing.
 *   - **Deletes.** A row deleted on the web stayed on the hub for ever. The
 *     cloud now keeps a tombstone for every delete and the hub applies it.
 *   - **Whole-set reconciliation.** A colleague removed from the clinic, or
 *     a price deleted, no longer appears in the cloud's set — and the hub
 *     used to keep its copy. Missing rows are now handled per the registry.
 *   - **A bad row does not stop the table.** One row the hub could not write
 *     (a foreign key the cloud never satisfied) used to hold that table's
 *     cursor and every later row behind it. It is now set aside, retried on
 *     later runs, and after enough attempts reported for someone to look at
 *     — the same policy the push has for a row the cloud will not take.
 *   - **Schema-driven columns.** What is written is the intersection of the
 *     cloud row's keys and the hub table's columns, so a column added to
 *     both schemas syncs with no change here.
 */

import { getPullCursor, setPullCursor, cursorAfter } from './cursors';
import { toLocalValue } from './outboxPayload';
import { SYNC_TABLES, TOMBSTONE_TABLE, syncTable, type SyncTable } from './tables';

export interface PullDb {
  prepare(sql: string): { all: (...a: any[]) => any[]; get: (...a: any[]) => any; run: (...a: any[]) => any };
  exec(sql: string): void;
}

export interface RemoteReader {
  from(table: string): any;
}

export interface PullTableResult {
  table: string;
  fetched: number;
  written: number;
  /** Rows the hub could not write this run. Their identities are recorded for retry. */
  failedRows: number;
  error?: string;
}

export interface PullResult {
  tables: PullTableResult[];
  /** Tables whose fetch failed outright; their cursors were held. */
  failedTables: string[];
  /** Rows written or deleted, so the caller can tell the screens. */
  changed: number;
  deleted: number;
  /** Rows set aside after repeated write failures. Need a person. */
  deadRows: number;
}

/** Rows per page from PostgREST. Its default cap is 1000. */
const PAGE = 1000;

/** Write attempts before a pulled row is set aside as un-writable. */
export const MAX_PULL_ATTEMPTS = 5;

/* ── Local schema ──────────────────────────────────────────────────────────── */

const columnCache = new WeakMap<object, Map<string, string[]>>();

/** The columns the hub's copy of `table` actually has. */
function localColumns(db: PullDb, table: string): string[] {
  let perDb = columnCache.get(db);
  if (!perDb) { perDb = new Map(); columnCache.set(db, perDb); }
  let cols = perDb.get(table);
  if (!cols) {
    cols = (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
    perDb.set(table, cols);
  }
  return cols;
}

/* ── Fetching ──────────────────────────────────────────────────────────────── */

/** PostgREST filter value, quoted so a timestamp's characters survive an `or()`. */
const quoted = (v: unknown) => `"${String(v).replace(/"/g, '\\"')}"`;

/** The key column that breaks ties within one stamp. Within a clinic the last key column is unique. */
const tiebreaker = (t: SyncTable) => t.key[t.key.length - 1];

function scoped(query: any, t: SyncTable, organizationId: string) {
  return t.scope === 'id' ? query.eq('id', organizationId) : query.eq('organization_id', organizationId);
}

/**
 * Every row of `table` in this clinic changed at or after `cursor`, in
 * (stamp, key) order, paged by keyset.
 */
async function fetchSince(
  supabase: RemoteReader,
  t: SyncTable,
  organizationId: string,
  cursor: string,
): Promise<Record<string, any>[]> {
  const stamp = t.cursorColumn!;
  const key = tiebreaker(t);
  const rows: Record<string, any>[] = [];
  let after: { stamp: string; key: unknown } | null = null;

  for (;;) {
    let q = scoped(supabase.from(t.name).select('*'), t, organizationId);
    q = after
      ? q.or(`${stamp}.gt.${quoted(after.stamp)},and(${stamp}.eq.${quoted(after.stamp)},${key}.gt.${quoted(after.key)})`)
      : q.gte(stamp, cursor);
    const { data, error } = await q.order(stamp, { ascending: true }).order(key, { ascending: true }).limit(PAGE);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    const last = data[data.length - 1];
    after = { stamp: last[stamp], key: last[key] };
  }
  return rows;
}

/** The clinic's entire set of `table`, paged by key. */
async function fetchWhole(supabase: RemoteReader, t: SyncTable, organizationId: string): Promise<Record<string, any>[]> {
  const key = tiebreaker(t);
  const rows: Record<string, any>[] = [];
  let afterKey: unknown = null;

  for (;;) {
    let q = scoped(supabase.from(t.name).select('*'), t, organizationId);
    if (afterKey !== null) q = q.gt(key, afterKey);
    const { data, error } = await q.order(key, { ascending: true }).limit(PAGE);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    afterKey = data[data.length - 1][key];
  }
  return rows;
}

/** Specific rows by key, for retrying ones that would not write. */
async function fetchByKeys(
  supabase: RemoteReader,
  t: SyncTable,
  organizationId: string,
  keys: string[],
): Promise<Record<string, any>[]> {
  const key = tiebreaker(t);
  const values = keys.map((k) => (t.key.length === 1 ? k : k.split(':').pop()));
  const { data, error } = await scoped(supabase.from(t.name).select('*'), t, organizationId).in(key, values);
  if (error) throw error;
  return data ?? [];
}

/* ── Writing ───────────────────────────────────────────────────────────────── */

/** The outbox-style identity of a row: the id, or "org:key" for a pair. */
export function recordKeyOf(t: SyncTable, row: Record<string, any>): string {
  return t.key.map((c) => String(row[c])).join(':');
}

/**
 * The upsert for one row, built from the columns it actually carries. The
 * statement is per (table, column set), and SQLite caches the prepared form.
 */
function upsertSql(t: SyncTable, columns: string[], hasVersion: boolean): string {
  const nonKey = columns.filter((c) => !t.key.includes(c));
  const ver = t.versionColumn;
  const setClause = nonKey.length === 0
    ? `${t.key[0]} = ${t.name}.${t.key[0]}` // nothing to update; keeps the statement valid
    : nonKey
        .map((c) =>
          t.conflict === 'newer-wins' && hasVersion && ver
            ? `${c} = CASE WHEN ${t.name}.${ver} IS NULL OR excluded.${ver} >= ${t.name}.${ver} THEN excluded.${c} ELSE ${t.name}.${c} END`
            : `${c} = excluded.${c}`,
        )
        .join(',\n    ');
  return `INSERT INTO ${t.name} (${columns.join(', ')})
  VALUES (${columns.map(() => '?').join(', ')})
  ON CONFLICT(${t.key.join(', ')}) DO UPDATE SET
    ${setClause}`;
}

interface WriteOutcome {
  written: number;
  failed: Array<{ recordKey: string; error: string }>;
  /** The newest stamp among rows that were written, in registry order. */
  lastGoodStamp: string | null;
}

/**
 * Writes rows in order, one statement each, inside one transaction. A row
 * that fails is skipped and reported; the rows around it still land.
 */
function writeRows(db: PullDb, t: SyncTable, rows: Record<string, any>[]): WriteOutcome {
  const columns = localColumns(db, t.name);
  const outcome: WriteOutcome = { written: 0, failed: [], lastGoodStamp: null };
  if (rows.length === 0) return outcome;

  const statements = new Map<string, { run: (...a: any[]) => any }>();

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const present = columns.filter((c) => row[c] !== undefined);
      if (!t.key.every((k) => present.includes(k))) {
        outcome.failed.push({ recordKey: recordKeyOf(t, row), error: 'row has no key' });
        continue;
      }
      const hasVersion = !!t.versionColumn && present.includes(t.versionColumn);
      const sig = present.join(',') + (hasVersion ? '|v' : '');
      let stmt = statements.get(sig);
      if (!stmt) {
        stmt = db.prepare(upsertSql(t, present, hasVersion));
        statements.set(sig, stmt);
      }
      try {
        // A savepoint so one failed row rolls back only itself.
        db.exec('SAVEPOINT sp_row');
        stmt.run(...present.map((c) => toLocalValue(row[c])));
        db.exec('RELEASE sp_row');
        outcome.written += 1;
        if (t.cursorColumn && typeof row[t.cursorColumn] === 'string') {
          outcome.lastGoodStamp = row[t.cursorColumn];
        }
      } catch (err: any) {
        try { db.exec('ROLLBACK TO sp_row'); db.exec('RELEASE sp_row'); } catch { /* savepoint already gone */ }
        outcome.failed.push({ recordKey: recordKeyOf(t, row), error: err?.message || String(err) });
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* nothing to roll back */ }
    throw err;
  }
  return outcome;
}

/** Whole-set pulls: local rows the cloud no longer has, handled per the registry. */
function reconcileMissing(db: PullDb, t: SyncTable, organizationId: string, present: Record<string, any>[]): number {
  if (!t.onMissing) return 0;
  const scopeCol = t.scope === 'id' ? 'id' : 'organization_id';
  const key = tiebreaker(t);
  const keep = new Set(present.map((r) => String(r[key])));
  const local = db
    .prepare(`SELECT ${key} AS k FROM ${t.name} WHERE ${scopeCol} = ?`)
    .all(organizationId) as Array<{ k: unknown }>;
  const gone = local.map((r) => String(r.k)).filter((k) => !keep.has(k));
  if (gone.length === 0) return 0;

  if (t.onMissing.action === 'delete') {
    const del = db.prepare(`DELETE FROM ${t.name} WHERE ${scopeCol} = ? AND ${key} = ?`);
    gone.forEach((k) => del.run(organizationId, k));
  } else {
    const entries = Object.entries(t.onMissing.values);
    const upd = db.prepare(
      `UPDATE ${t.name} SET ${entries.map(([c]) => `${c} = ?`).join(', ')} WHERE ${scopeCol} = ? AND ${key} = ?`,
    );
    gone.forEach((k) => upd.run(...entries.map(([, v]) => toLocalValue(v)), organizationId, k));
  }
  return gone.length;
}

/* ── Rows that would not write ─────────────────────────────────────────────── */

function rememberFailures(db: PullDb, table: string, failed: Array<{ recordKey: string; error: string }>, now: number): number {
  if (failed.length === 0) return 0;
  const upsert = db.prepare(`
    INSERT INTO sync_pull_failures (table_name, record_key, attempts, last_error, last_attempt_at, dead)
    VALUES (?, ?, 1, ?, ?, 0)
    ON CONFLICT(table_name, record_key) DO UPDATE SET
      attempts = sync_pull_failures.attempts + 1,
      last_error = excluded.last_error,
      last_attempt_at = excluded.last_attempt_at,
      dead = CASE WHEN sync_pull_failures.attempts + 1 >= ${MAX_PULL_ATTEMPTS} THEN 1 ELSE 0 END
  `);
  let newlyDead = 0;
  for (const f of failed) {
    upsert.run(table, f.recordKey, f.error, now);
    const row = db.prepare('SELECT dead, attempts FROM sync_pull_failures WHERE table_name = ? AND record_key = ?').get(table, f.recordKey);
    if (row?.dead === 1 && row?.attempts === MAX_PULL_ATTEMPTS) newlyDead += 1;
  }
  return newlyDead;
}

function forgetFailures(db: PullDb, table: string, recordKeys: string[]): void {
  if (recordKeys.length === 0) return;
  const del = db.prepare('DELETE FROM sync_pull_failures WHERE table_name = ? AND record_key = ?');
  recordKeys.forEach((k) => del.run(table, k));
}

function pendingFailures(db: PullDb, table: string): string[] {
  return (db.prepare('SELECT record_key FROM sync_pull_failures WHERE table_name = ? AND dead = 0').all(table) as Array<{ record_key: string }>)
    .map((r) => r.record_key);
}

export function countDeadPullRows(db: PullDb): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM sync_pull_failures WHERE dead = 1').get() as { n: number }).n;
}

/** Puts every set-aside pulled row back for another try. */
export function requeueDeadPullRows(db: PullDb): number {
  return db.prepare('UPDATE sync_pull_failures SET dead = 0, attempts = 0 WHERE dead = 1').run()?.changes ?? 0;
}

/* ── Tombstones ────────────────────────────────────────────────────────────── */

interface Tombstone {
  id: number;
  table_name: string;
  record_key: string;
  deleted_at: string;
}

async function fetchTombstones(supabase: RemoteReader, organizationId: string, cursor: string): Promise<Tombstone[]> {
  const rows: Tombstone[] = [];
  let after: Tombstone | null = null;
  for (;;) {
    let q = supabase.from(TOMBSTONE_TABLE).select('*').eq('organization_id', organizationId);
    q = after
      ? q.or(`deleted_at.gt.${quoted(after.deleted_at)},and(deleted_at.eq.${quoted(after.deleted_at)},id.gt.${after.id})`)
      : q.gte('deleted_at', cursor);
    const { data, error } = await q.order('deleted_at', { ascending: true }).order('id', { ascending: true }).limit(PAGE);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    after = data[data.length - 1];
  }
  return rows;
}

/**
 * Applies a tombstone unless the hub's copy was changed after the delete —
 * the newer edit wins, and the push will put the row back. When the delete
 * wins, any outbox row for the record is dropped too, or the push would
 * resurrect what was just removed.
 */
function applyTombstones(db: PullDb, tombstones: Tombstone[]): number {
  let deleted = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const ts of tombstones) {
      const t = syncTable(ts.table_name);
      if (!t) continue;
      const parts = ts.record_key.split(':');
      const where = t.key.map((c) => `${c} = ?`).join(' AND ');
      const newerLocally = t.versionColumn
        ? ` AND NOT (${t.versionColumn} IS NOT NULL AND ${t.versionColumn} > ?)`
        : '';
      const args = t.versionColumn ? [...parts, ts.deleted_at] : parts;
      const info = db.prepare(`DELETE FROM ${t.name} WHERE ${where}${newerLocally}`).run(...args);
      if (info?.changes > 0) {
        deleted += info.changes;
        db.prepare('DELETE FROM sync_outbox WHERE table_name = ? AND record_id = ?').run(t.name, ts.record_key);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* nothing to roll back */ }
    throw err;
  }
  return deleted;
}

/* ── The run ───────────────────────────────────────────────────────────────── */

/**
 * Pulls every registered table, then the tombstones. A table whose fetch
 * fails is reported and its cursor held; the others still run.
 */
export async function pullAll(
  db: PullDb,
  supabase: RemoteReader,
  organizationId: string,
  now: () => number = Date.now,
): Promise<PullResult> {
  const result: PullResult = { tables: [], failedTables: [], changed: 0, deleted: 0, deadRows: 0 };

  for (const t of SYNC_TABLES) {
    const entry: PullTableResult = { table: t.name, fetched: 0, written: 0, failedRows: 0 };
    result.tables.push(entry);
    try {
      // Rows set aside on an earlier run get another chance first.
      const retryKeys = pendingFailures(db, t.name);
      if (retryKeys.length > 0) {
        const rows = await fetchByKeys(supabase, t, organizationId, retryKeys);
        const out = writeRows(db, t, rows);
        forgetFailures(db, t.name, rows.map((r) => recordKeyOf(t, r)).filter((k) => !out.failed.some((f) => f.recordKey === k)));
        // A key the cloud no longer has is not a failure any more.
        forgetFailures(db, t.name, retryKeys.filter((k) => !rows.some((r) => recordKeyOf(t, r) === k)));
        result.deadRows += rememberFailures(db, t.name, out.failed, now());
        entry.written += out.written;
        entry.failedRows += out.failed.length;
        result.changed += out.written;
      }

      if (t.cursorColumn) {
        const cursor = getPullCursor(db, organizationId, t.name);
        const rows = await fetchSince(supabase, t, organizationId, cursor);
        entry.fetched = rows.length;
        const out = writeRows(db, t, rows);
        entry.written += out.written;
        entry.failedRows += out.failed.length;
        result.changed += out.written;
        result.deadRows += rememberFailures(db, t.name, out.failed, now());
        // Every row was attempted; the ones that failed are recorded for
        // retry by key, so the cursor can move past them.
        setPullCursor(db, organizationId, t.name, cursorAfter(rows, t.cursorColumn, cursor));
      } else {
        const rows = await fetchWhole(supabase, t, organizationId);
        entry.fetched = rows.length;
        const out = writeRows(db, t, rows);
        entry.written += out.written;
        entry.failedRows += out.failed.length;
        result.deadRows += rememberFailures(db, t.name, out.failed, now());
        // Reconcile only from a complete, successful read of the set. A
        // fetch that threw never reaches here, so a network blip cannot
        // detach every colleague from the clinic.
        const gone = reconcileMissing(db, t, organizationId, rows);
        result.changed += out.written + gone;
        result.deleted += gone;
      }
    } catch (err: any) {
      entry.error = err?.message || String(err);
      result.failedTables.push(t.name);
      console.error(`[Sync] Pull failed for ${t.name}; cursor held: ${entry.error}`);
    }
  }

  try {
    const cursor = getPullCursor(db, organizationId, TOMBSTONE_TABLE);
    const tombstones = await fetchTombstones(supabase, organizationId, cursor);
    if (tombstones.length > 0) {
      const n = applyTombstones(db, tombstones);
      result.deleted += n;
      result.changed += n;
      setPullCursor(db, organizationId, TOMBSTONE_TABLE, cursorAfter(tombstones, 'deleted_at', cursor));
    }
  } catch (err: any) {
    const message = err?.message || String(err);
    // A project that has not run supabase_sync_integrity.sql has no
    // tombstone table. That is a degraded state, not a failed sync: rows
    // still flow, deletes do not. Say so once per run.
    const missing = /sync_tombstones/.test(message) && /(does not exist|schema cache|relation)/i.test(message);
    if (missing) {
      console.warn('[Sync] The cloud has no sync_tombstones table; deletes will not reach this hub until supabase_sync_integrity.sql is applied.');
    } else {
      result.failedTables.push(TOMBSTONE_TABLE);
      console.error(`[Sync] Pull failed for ${TOMBSTONE_TABLE}; cursor held: ${message}`);
    }
  }

  return result;
}
