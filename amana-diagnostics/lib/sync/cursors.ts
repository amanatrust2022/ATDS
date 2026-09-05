/**
 * Where each table's pull got up to.
 *
 * There used to be one timestamp for the whole organisation, advanced at the
 * end of every sync whether or not each table had actually been read. Three of
 * the billing pulls were allowed to fail with only a line in the log, so a
 * single network blip during those meant their rows were never asked for again
 * — wallet balances and payment records quietly missing on that machine with
 * nothing to indicate it.
 *
 * A cursor now belongs to one table and moves only when that table's pull
 * succeeded. A table that fails is simply behind, and catches up next time.
 */

export interface CursorDb {
  prepare(sql: string): { get: (...a: any[]) => any; run: (...a: any[]) => any };
}

export const EPOCH = '1970-01-01T00:00:00.000Z';

const cursorKey = (organizationId: string, table: string) => `last_pull:${organizationId}:${table}`;

/** The pre-per-table key, still read once so an existing hub does not re-pull everything. */
const legacyKey = (organizationId: string) => `last_pull_timestamp:${organizationId}`;

function readKey(db: CursorDb, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM sync_metadata WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

/**
 * The timestamp this table has been read up to. Falls back to the old
 * organisation-wide cursor the first time, then to the epoch.
 */
export function getPullCursor(db: CursorDb, organizationId: string, table: string): string {
  return readKey(db, cursorKey(organizationId, table)) ?? readKey(db, legacyKey(organizationId)) ?? EPOCH;
}

/**
 * Moves one table's cursor forward. Call only once that table's rows are on
 * disk — a cursor ahead of the data it stands for is the bug this exists to
 * prevent.
 *
 * The timestamp passed should be the one captured *before* the read started.
 * Overlapping slightly on the next sync costs a repeated upsert; a gap loses a
 * row.
 */
export function setPullCursor(db: CursorDb, organizationId: string, table: string, timestamp: string): void {
  db.prepare('INSERT INTO sync_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(cursorKey(organizationId, table), timestamp);
}
