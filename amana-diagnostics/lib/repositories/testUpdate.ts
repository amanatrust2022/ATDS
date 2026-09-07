/**
 * Building a partial update to a `patient_tests` row.
 *
 * The hub used to write all eight result columns on every update, filling in
 * `null` for anything the caller had not sent. Opening a pending test sends
 * nothing but `{ status: 'in_progress' }`, so the act of opening a test to type
 * its result erased the specimen it was taken from — which is why specimens
 * went missing from reports. Results, notes and the signature went the same way
 * on any other partial update.
 *
 * The cloud never had this problem: an undefined field disappears when the
 * request body is serialised, so the column is simply left alone. This makes
 * the hub behave the same way, and puts the rule somewhere it can be tested.
 */

/** Domain field → column, in the order they are written. */
const COLUMNS: Array<{ field: string; column: string; toColumn: (v: any) => any }> = [
  { field: 'status', column: 'status', toColumn: v => v },
  { field: 'results', column: 'results', toColumn: v => (v ? JSON.stringify(v) : null) },
  { field: 'completedBy', column: 'completed_by', toColumn: v => v ?? null },
  { field: 'completedBySignatureUrl', column: 'completed_by_signature_url', toColumn: v => v ?? null },
  { field: 'completedByTitle', column: 'completed_by_title', toColumn: v => v ?? null },
  { field: 'completedAt', column: 'completed_at', toColumn: v => v ?? null },
  { field: 'notes', column: 'notes', toColumn: v => v ?? null },
  { field: 'specimen', column: 'specimen', toColumn: v => v ?? null },
];

export interface PartialTestUpdate {
  /** `status = ?, specimen = ?, updated_at = ?` — never empty. */
  setClause: string;
  /** Values for the placeholders in `setClause`, in order. */
  values: any[];
  /** The same change, shaped for the sync outbox, so the cloud copy is not blanked either. */
  syncPayload: Record<string, any>;
}

/**
 * A field is written only when the caller sent it. `null` counts as sent — that
 * is how a note or a specimen is deliberately cleared. `undefined` does not.
 */
export function partialTestUpdate(updates: Record<string, any>, now: string): PartialTestUpdate {
  const present = COLUMNS.filter(({ field }) => updates[field] !== undefined);

  const setClause = [...present.map(({ column }) => `${column} = ?`), 'updated_at = ?'].join(', ');
  const values = [...present.map(({ field, toColumn }) => toColumn(updates[field])), now];

  const syncPayload: Record<string, any> = { updated_at: now };
  present.forEach(({ field, column }) => {
    // The outbox carries the domain value, not the serialised one: the push
    // encodes it again on the way out.
    syncPayload[column] = updates[field] ?? null;
  });

  return { setClause, values, syncPayload };
}
