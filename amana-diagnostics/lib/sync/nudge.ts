/**
 * A browser-side hint that this tab just wrote something.
 *
 * The hub's engine (lib/sync/engine.ts) hears every write directly, through
 * the outbox bell in lib/changeBus.ts, and pushes at once — so this is no
 * longer what makes a result leave the bench quickly. It is kept because it
 * costs nothing and covers one gap: a tab that reaches a hub whose engine
 * has not been woken yet hands over its session on the nudge and wakes it.
 *
 * `useSyncState` listens. Browser only, and a plain DOM event so nothing has
 * to import anything from the shell to ask.
 */

export const SYNC_NOW_EVENT = 'redian:sync-now';

export function nudgeSync(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SYNC_NOW_EVENT));
}

/** Runs `fn` each time a nudge arrives. Returns the unsubscribe. */
export function onSyncNudge(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SYNC_NOW_EVENT, fn);
  return () => window.removeEventListener(SYNC_NOW_EVENT, fn);
}
