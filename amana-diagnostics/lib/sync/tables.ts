/**
 * The registry of everything that moves between a hub and the cloud.
 *
 * One table, one entry, and both directions read it: the push shapes an
 * outbox row for Postgres from it (JSON and boolean columns), and the pull
 * writes a cloud row into SQLite from it (key, conflict rule, what to do with
 * a row the cloud no longer has). Before this the pull was four hundred lines
 * of hand-written upserts in the sync route, one per table, and a table
 * could be pushed without being pulled — `organizations` and `profiles` were
 * — with nothing to notice.
 *
 * `lib/sync/tables.test.ts` holds the registry to three rules:
 *   - every table `queueSync` is ever called with is registered;
 *   - every registered table exists in the hub's SQLite schema;
 *   - every registered table is ordered after the tables it references.
 *
 * ADDING A TABLE
 *   1. Create it in `lib/localDb.ts` with the same columns as the cloud.
 *   2. Add it to the cloud's `supabase_sync_integrity.sql` list so it gets
 *      the `updated_at` trigger, the delete tombstone and the realtime
 *      publication.
 *   3. Append an entry here, after every table it has a foreign key to.
 *   4. Write to it through `queueSync` on the hub. That is all: the pull,
 *      the badge and the realtime listener follow the registry.
 */

export type ConflictRule =
  /** The row with the newer `updated_at` wins. The rule for anything edited in place. */
  | 'newer-wins'
  /** The cloud's copy is written as-is. For append-only rows that never change. */
  | 'cloud-wins';

export interface SyncTable {
  name: string;
  /** Columns that identify a row on both sides. */
  key: string[];
  /**
   * The column the pull cursor moves on. `null` fetches the whole set every
   * run — only for tables small enough that this is cheaper than being wrong.
   */
  cursorColumn: 'updated_at' | 'created_at' | null;
  /** The column the conflict rule compares. Usually the cursor column. */
  versionColumn: 'updated_at' | null;
  conflict: ConflictRule;
  /** Which column narrows the cloud query to this clinic. */
  scope: 'organization_id' | 'id';
  /** Held as JSON text locally and as jsonb remotely. */
  json: string[];
  /** Held as 0/1 locally and as boolean remotely. */
  booleans: string[];
  /**
   * For whole-set pulls: what to do with a local row that the cloud's set no
   * longer contains. `delete` removes it; `set` writes those columns instead
   * (a staff member removed from the clinic keeps their profile row, without
   * the clinic).
   */
  onMissing?: { action: 'delete' } | { action: 'set'; values: Record<string, unknown> };
  /**
   * Whether the realtime listener should watch this table. Everything is
   * watched by default; a table that changes constantly and matters little
   * could opt out.
   */
  realtime?: boolean;
}

const table = (t: SyncTable): SyncTable => t;

/**
 * In dependency order: a parent is always pulled before the rows that point
 * at it, so a foreign key on the hub is never asked to reference a row that
 * has not arrived yet.
 */
export const SYNC_TABLES: readonly SyncTable[] = [
  table({
    name: 'organizations',
    key: ['id'],
    cursorColumn: null,
    versionColumn: null,
    conflict: 'cloud-wins',
    scope: 'id',
    json: [],
    booleans: [],
  }),
  table({
    name: 'profiles',
    key: ['id'],
    cursorColumn: null,
    versionColumn: null,
    conflict: 'cloud-wins',
    scope: 'organization_id',
    json: [],
    booleans: [],
    // A colleague removed from the clinic on the web no longer appears in the
    // clinic's set. They used to stay on the hub's staff list forever.
    onMissing: { action: 'set', values: { organization_id: null } },
  }),
  table({
    name: 'referring_facilities',
    key: ['id'],
    cursorColumn: 'updated_at',
    versionColumn: 'updated_at',
    conflict: 'newer-wins',
    scope: 'organization_id',
    json: [],
    booleans: ['is_active'],
  }),
  table({
    name: 'referring_doctors',
    key: ['id'],
    cursorColumn: 'updated_at',
    versionColumn: 'updated_at',
    conflict: 'newer-wins',
    scope: 'organization_id',
    json: [],
    booleans: ['is_active'],
  }),
  table({
    name: 'test_prices',
    key: ['organization_id', 'test_id'],
    cursorColumn: null,
    versionColumn: null,
    conflict: 'cloud-wins',
    scope: 'organization_id',
    json: [],
    booleans: [],
    onMissing: { action: 'delete' },
  }),
  table({
    name: 'custom_tests',
    key: ['organization_id', 'id'],
    cursorColumn: 'updated_at',
    versionColumn: 'updated_at',
    conflict: 'newer-wins',
    scope: 'organization_id',
    json: ['parameters'],
    booleans: ['is_active'],
  }),
  table({
    name: 'radiology_templates',
    key: ['id'],
    cursorColumn: 'updated_at',
    versionColumn: 'updated_at',
    conflict: 'newer-wins',
    scope: 'organization_id',
    json: [],
    booleans: [],
  }),
  table({
    name: 'patient_profiles',
    key: ['id'],
    cursorColumn: 'updated_at',
    versionColumn: 'updated_at',
    conflict: 'newer-wins',
    scope: 'organization_id',
    json: [],
    booleans: [],
  }),
  table({
    name: 'patients',
    key: ['id'],
    cursorColumn: 'updated_at',
    versionColumn: 'updated_at',
    conflict: 'newer-wins',
    scope: 'organization_id',
    json: [],
    booleans: ['commission_assigned'],
  }),
  table({
    name: 'patient_tests',
    key: ['id'],
    cursorColumn: 'updated_at',
    versionColumn: 'updated_at',
    conflict: 'newer-wins',
    scope: 'organization_id',
    json: ['results'],
    booleans: [],
  }),
  table({
    name: 'billing_accounts',
    key: ['id'],
    cursorColumn: 'updated_at',
    versionColumn: 'updated_at',
    conflict: 'newer-wins',
    scope: 'organization_id',
    json: [],
    booleans: [],
  }),
  table({
    name: 'billing_ledger_transactions',
    key: ['id'],
    cursorColumn: 'created_at',
    versionColumn: null,
    conflict: 'cloud-wins',
    scope: 'organization_id',
    json: [],
    booleans: [],
  }),
  table({
    name: 'external_department_charges',
    key: ['id'],
    cursorColumn: 'created_at',
    versionColumn: null,
    conflict: 'cloud-wins',
    scope: 'organization_id',
    json: [],
    booleans: [],
  }),
];

/**
 * The cloud's record of rows that were deleted, so a hub can delete them too.
 * Written by a trigger on every table above (see supabase_sync_integrity.sql);
 * pulled by cursor like any other table, but applied as deletes.
 */
export const TOMBSTONE_TABLE = 'sync_tombstones';

const byName = new Map(SYNC_TABLES.map((t) => [t.name, t]));

export function syncTable(name: string): SyncTable | undefined {
  return byName.get(name);
}

/**
 * Outbox rows that are not rows at all but requests for the cloud to do
 * something only it can do — change a colleague's standing, which touches
 * the auth service and not just a table. Their `table_name` carries this
 * prefix and their payload is the request body; the push POSTs them to the
 * cloud deployment's own route under the current session.
 */
export const COMMAND_PREFIX = 'command:';

export function isCommandRow(tableName: string): boolean {
  return tableName.startsWith(COMMAND_PREFIX);
}

/** The route a command row is sent to, relative to the cloud origin. */
export function commandPath(tableName: string): string {
  return '/' + tableName.slice(COMMAND_PREFIX.length);
}
