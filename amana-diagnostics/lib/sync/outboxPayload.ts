/**
 * Shape a local SQLite row into what Supabase expects.
 *
 * SQLite has no boolean and no JSON type: booleans are stored as 0/1 and JSON
 * columns as text. Postgres wants the real thing. This is the one place that
 * conversion happens — it used to be copied once for UPDATE and once for
 * INSERT, which is how a column could end up converted on one path and not the
 * other. Which columns are which is read from the sync registry, so a table
 * declared there once is converted correctly in both directions.
 */

import { syncTable } from './tables';

/**
 * Returns a copy of `row` with this table's JSON and boolean columns converted.
 * The input is not modified: a row that fails to send is retried later, and it
 * must still be the row that was queued.
 *
 * A JSON column that will not parse is left exactly as it is rather than
 * throwing. The row then fails against Postgres, is recorded with that error,
 * and is visible for repair — which beats taking down the whole sync run.
 */
export function toRemotePayload(tableName: string, row: Record<string, any>): Record<string, any> {
  const out = { ...row };
  const spec = syncTable(tableName);

  for (const col of spec?.json ?? []) {
    if (typeof out[col] === 'string') {
      try {
        out[col] = JSON.parse(out[col]);
      } catch {
        // Leave the raw text in place; Postgres will reject it and the row is
        // recorded as failed rather than silently dropped.
      }
    }
  }

  for (const col of spec?.booleans ?? []) {
    if (col in out) {
      out[col] = out[col] === 1 || out[col] === true || out[col] === '1';
    }
  }

  return out;
}

/**
 * The reverse: a cloud row as SQLite can hold it. Booleans become 0/1, and
 * anything structured becomes JSON text. Typed from the value rather than the
 * registry so a column added to both schemas needs no further declaration.
 */
export function toLocalValue(value: unknown): string | number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'bigint') return Number(value);
  return JSON.stringify(value);
}
