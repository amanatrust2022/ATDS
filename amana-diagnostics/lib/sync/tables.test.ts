import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SYNC_TABLES, COMMAND_PREFIX, syncTable, isCommandRow, commandPath } from './tables';

/**
 * The registry is the contract between the hub's schema, the hub's writes,
 * the cloud's migration and the sync itself. These tests hold the four
 * together, so a table added to one and forgotten in another fails here
 * rather than in a clinic.
 */

const root = join(__dirname, '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const localDbSource = readFileSync(join(root, 'lib/localDb.ts'), 'utf8');
const migrationSource = readFileSync(join(root, 'supabase_sync_integrity.sql'), 'utf8');

/** Every table name the hub creates. */
const localTables = new Set(
  [...localDbSource.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]),
);

/** Every table name `queueSync` is ever called with, across the API routes. */
const queuedTables = new Set<string>();
for (const file of [...walk(join(root, 'app/api')), ...walk(join(root, 'pages/api'))]) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/queueSync\(\s*db,\s*(['"`])([^'"`]+)\1/g)) {
    // A template with the command prefix interpolated is a command row.
    queuedTables.add(m[2].replace('${COMMAND_PREFIX}', COMMAND_PREFIX));
  }
}

/** Every table the cloud migration touches. */
const migratedTables = new Set(
  [...migrationSource.matchAll(/^\s*\('(\w+)',\s*'\w+',\s*(?:true|false)\)/gm)].map((m) => m[1]),
);

describe('the sync registry', () => {
  it('registers every table the hub queues for the cloud', () => {
    const registered = new Set(SYNC_TABLES.map((t) => t.name));
    const missing = [...queuedTables].filter((t) => !t.startsWith(COMMAND_PREFIX) && !registered.has(t));
    expect(missing, 'add these to lib/sync/tables.ts').toEqual([]);
  });

  it('registers only tables the hub actually has', () => {
    const unknown = SYNC_TABLES.map((t) => t.name).filter((t) => !localTables.has(t));
    expect(unknown, 'create these in lib/localDb.ts').toEqual([]);
  });

  it('matches the cloud migration table for table', () => {
    const registered = SYNC_TABLES.map((t) => t.name).sort();
    expect([...migratedTables].sort()).toEqual(registered);
  });

  it('pulls a parent before the rows that reference it', () => {
    // From the hub schema: which tables each table's foreign keys point at.
    const order = new Map(SYNC_TABLES.map((t, i) => [t.name, i]));
    const problems: string[] = [];
    for (const [, table, body] of localDbSource.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\);\s*`\)/g)) {
      if (!order.has(table)) continue;
      for (const [, parent] of body.matchAll(/REFERENCES (\w+)\(/g)) {
        if (!order.has(parent)) continue;
        if (order.get(parent)! > order.get(table)!) problems.push(`${table} is pulled before ${parent}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('cursors on a column the hub table has', () => {
    for (const t of SYNC_TABLES) {
      const ddl = localDbSource.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${t.name} \\(([\\s\\S]*?)\\);`))![1];
      if (t.cursorColumn) expect(ddl, `${t.name}.${t.cursorColumn}`).toMatch(new RegExp(`\\b${t.cursorColumn}\\b`));
      if (t.versionColumn) expect(ddl, `${t.name}.${t.versionColumn}`).toMatch(new RegExp(`\\b${t.versionColumn}\\b`));
      for (const k of t.key) expect(ddl, `${t.name}.${k}`).toMatch(new RegExp(`\\b${k}\\b`));
    }
  });

  it('compares versions only where it cursors by updated_at', () => {
    for (const t of SYNC_TABLES) {
      if (t.conflict === 'newer-wins') expect(t.versionColumn, t.name).toBe('updated_at');
      if (t.versionColumn === null) expect(t.conflict, t.name).toBe('cloud-wins');
    }
  });
});

describe('command rows', () => {
  it('are told apart from table rows by their prefix', () => {
    expect(isCommandRow('command:api/staff/update')).toBe(true);
    expect(isCommandRow('patients')).toBe(false);
    expect(commandPath('command:api/staff/update')).toBe('/api/staff/update');
  });

  it('are not tables', () => {
    expect(syncTable('command:api/staff/update')).toBeUndefined();
  });
});
