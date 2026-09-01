/**
 * Helpers for the local (on-premise hub) repositories, which reach SQLite through
 * this app's own API routes.
 *
 * The routes share a convention: writes POST a JSON envelope and, on failure,
 * answer with `{ error }`. Reads GET and return the rows directly.
 */

/** POSTs a write envelope, raising the hub's own message when it refuses. */
export const postJson = async (
  url: string,
  body: Record<string, unknown>,
  failureMessage: string,
): Promise<Response> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || failureMessage);
  }
  return res;
};

/** GETs a collection. `tolerateFailure` mirrors the reads that return [] rather than throw. */
export const getJson = async <T>(url: string, tolerateFailure = false): Promise<T | []> => {
  const res = await fetch(url);
  if (tolerateFailure && !res.ok) return [];
  return res.json();
};
