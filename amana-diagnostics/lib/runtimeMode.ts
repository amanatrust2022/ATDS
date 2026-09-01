/**
 * Which back end the app talks to.
 *
 * - `local`  — an on-premise hub. Data goes through this app's own API routes to a
 *              SQLite database, and changes queue in sync_outbox for later upload.
 * - `cloud`  — Supabase/Postgres directly from the browser, under RLS.
 *
 * The detection below is the one `lib/store.ts` has always used. Several page
 * components still carry their own copy of it; those should move here too, but
 * note they omit the NODE_ENV clause, so they are NOT interchangeable yet.
 */
export type RuntimeMode = 'local' | 'cloud';

const detect = (): RuntimeMode => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('amana_local_mode');
    if (stored !== null) return stored === 'true' ? 'local' : 'cloud';

    const host = window.location.hostname;
    const isLanHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.');
    return isLanHost ? 'local' : 'cloud';
  }

  const serverLocal =
    process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true' ||
    process.env.NODE_ENV === 'development';
  return serverLocal ? 'local' : 'cloud';
};

/**
 * Resolved once at module load, matching the previous `const IS_LOCAL_MODE = …`
 * behaviour: a mid-session change to the localStorage flag does not take effect
 * until reload. `RootWrapper` and `AuthProvider` write that flag and reload.
 */
export const RUNTIME_MODE: RuntimeMode = detect();

export const isLocalMode = (): boolean => RUNTIME_MODE === 'local';
