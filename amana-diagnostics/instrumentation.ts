/**
 * Runs once when the server process starts.
 *
 * On a hub this is where the sync engine is brought up, so the hub syncs
 * from the moment it is running — with no browser open, before anyone has
 * signed in — rather than only while a tab happened to have the badge
 * mounted. On the cloud deployment the engine declines to start.
 *
 * The import is inside the runtime check rather than after an early
 * return on purpose: Next compiles this file for the edge runtime as well,
 * and only a branch webpack can see is constant-false keeps the engine —
 * and node:sqlite behind it — out of that bundle.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { isHubServer } = await import('./lib/runtimeMode');
    if (isHubServer()) {
      const { startSyncEngine } = await import('./lib/sync/engine');
      startSyncEngine();
    }
  }
}
