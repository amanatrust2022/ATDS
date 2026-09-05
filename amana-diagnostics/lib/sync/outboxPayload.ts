/**
 * Shape a local SQLite row into what Supabase expects.
 *
 * SQLite has no boolean and no JSON type: booleans are stored as 0/1 and JSON
 * columns as text. Postgres wants the real thing. This is the one place that
 * conversion happens — it used to be copied once for UPDATE and once for
 * INSERT, which is how a column could end up converted on one path and not the
 * other.
 */

/** Columns held as JSON text locally and as jsonb remotely. */
const JSON_COLUMNS: Record<string, string[]> = {
  patient_tests: ['results'],
  custom_tests: ['parameters'],
};

/** Columns held as 0/1 locally and as boolean remotely. */
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  patients: ['commission_assigned'],
  referring_doctors: ['is_active'],
  referring_facilities: ['is_active'],
  custom_tests: ['is_active'],
};

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

  for (const col of JSON_COLUMNS[tableName] ?? []) {
    if (typeof out[col] === 'string') {
      try {
        out[col] = JSON.parse(out[col]);
      } catch {
        // Leave the raw text in place; Postgres will reject it and the row is
        // recorded as failed rather than silently dropped.
      }
    }
  }

  for (const col of BOOLEAN_COLUMNS[tableName] ?? []) {
    if (col in out) {
      out[col] = out[col] === 1 || out[col] === true || out[col] === '1';
    }
  }

  return out;
}
