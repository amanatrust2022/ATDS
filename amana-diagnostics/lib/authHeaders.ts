import { createClient } from '@/lib/supabase';

/**
 * The `Authorization` header a guarded route expects.
 *
 * Four routes hold the Supabase service-role key, which bypasses every
 * row-level-security rule in the database, so each of them calls `requireUser`
 * or `requireAdmin` (lib/apiAuth.ts) and refuses anything that arrives without
 * a bearer token. The guards went in; two of the three call sites did not.
 * `/api/staff/update` was being called with nothing but a `Content-Type`, so
 * every attempt to change a colleague's role or remove them from the workspace
 * came back `401 Authentication required` — which is what the administrator saw
 * on screen, with no way to act on it.
 *
 * Read from the client rather than from React state on purpose. An access token
 * is short-lived; `getSession()` refreshes an expired one first, so an
 * administrator who has had the screen open since this morning is not told to
 * authenticate for a session that is perfectly valid.
 */
export async function bearerHeaders(): Promise<Record<string, string>> {
  const token = await accessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** The live access token, refreshed if it had expired, or null when signed out. */
export async function accessToken(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    // No cloud session — an offline hub, or the client could not be built.
    // The caller decides whether that is fatal; see StaffScreen, which stops
    // before the request rather than showing a failure it already knew about.
    return null;
  }
}

/** `Content-Type: application/json` plus the bearer token, for a POST body. */
export async function jsonAuthHeaders(): Promise<Record<string, string>> {
  return { 'Content-Type': 'application/json', ...(await bearerHeaders()) };
}
