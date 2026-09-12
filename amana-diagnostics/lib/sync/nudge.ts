/**
 * Asking the cloud sync to run now rather than on its next tick.
 *
 * The hub's changes reach the cloud through `/api/sync`, which the shell's
 * SyncStatus runs every fifteen seconds. That is the whole of the delay
 * between a result saved on a bench here and its arrival at a reception desk
 * on the web — and it is a delay for no reason, because the write itself
 * knows the moment it has happened.
 *
 * A write rings this; SyncStatus listens and runs at once. The fifteen-second
 * tick stays, for anything that arrives without a write on this machine.
 *
 * Browser only, and a plain DOM event so nothing has to import anything from
 * the shell to ask.
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
