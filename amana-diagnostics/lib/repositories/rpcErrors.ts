/**
 * Shared handling for the atomic wallet functions in supabase_wallet_atomicity.sql.
 *
 * Both functions report a refusal machine-readably as
 * `INSUFFICIENT_FUNDS:{"available":N,"name":"..."}` so the amount can be
 * formatted here, keeping the wording identical to the messages the client
 * produced before those checks moved into the database.
 */

export interface RpcError {
  code?: string;
  message?: string;
}

/**
 * True when the failure is "this function is not in the database", rather than
 * a real error from inside it. PostgREST answers PGRST202 when the name is not
 * in its schema cache; Postgres answers 42883 for an undefined function.
 */
export const isMissingFunction = (error: RpcError): boolean =>
  error.code === 'PGRST202' ||
  error.code === '42883' ||
  /could not find the function|schema cache/i.test(error.message || '');

/** The `{ available, name }` payload of a refusal, or null for any other error. */
export const parseInsufficientFunds = (
  error: RpcError,
): { available: number; name?: string } | null => {
  const match = /INSUFFICIENT_FUNDS:(\{.*?\})/.exec(error.message || '');
  if (!match) return null;
  try {
    const payload = JSON.parse(match[1]);
    return { available: Number(payload.available), name: payload.name };
  } catch {
    return null;
  }
};

export const formatNaira = (amount: number): string => `₦${amount.toLocaleString('en-NG')}`;
