/**
 * One connection per tab to the hub's event stream (`/api/events`).
 *
 * The queue screens and the sync badge both listen to the hub. If each
 * opened its own EventSource, a tab would hold two of the six connections a
 * browser allows per host over HTTP/1.1, and a receptionist with three tabs
 * open would find the fourth one's fetches queueing behind the streams.
 * So the stream is opened once per clinic per tab and shared; it closes
 * when the last listener leaves.
 *
 * Browser only. Every listener gets the same three things the stream
 * carries: `change` (something on the hub changed — re-read), `sync` (the
 * engine's state — show it), and open/error (the stream itself came or
 * went — poll, or stop polling).
 */

import type { SyncState } from '@/lib/sync/engine';

export interface HubEventHandlers {
  onChange?: () => void;
  onSync?: (state: SyncState) => void;
  /** The stream is up. Called at once if it already was. */
  onOpen?: () => void;
  /** The stream dropped; the browser reconnects by itself. */
  onError?: () => void;
}

interface Shared {
  source: EventSource;
  listeners: Set<HubEventHandlers>;
  open: boolean;
  lastSync: SyncState | null;
}

const EVENTS_ENDPOINT = '/api/events';
const shared = new Map<string, Shared>();

/** The engine's last reported state on this tab, if the stream has delivered one. */
export function lastKnownSyncState(organizationId: string): SyncState | null {
  return shared.get(organizationId)?.lastSync ?? null;
}

/**
 * Subscribes to the hub's stream for this clinic. Returns the unsubscribe.
 * Where the runtime has no EventSource at all, `onError` is called once so
 * the caller falls back to polling, and nothing is opened.
 */
export function subscribeHubEvents(organizationId: string, handlers: HubEventHandlers): () => void {
  if (typeof EventSource === 'undefined') {
    handlers.onError?.();
    return () => {};
  }

  let s = shared.get(organizationId);
  if (!s) {
    const source = new EventSource(`${EVENTS_ENDPOINT}?organizationId=${organizationId}`);
    const entry: Shared = { source, listeners: new Set(), open: false, lastSync: null };
    source.addEventListener('change', () => {
      entry.listeners.forEach((l) => l.onChange?.());
    });
    source.addEventListener('sync', (event: Event) => {
      const data = (event as MessageEvent).data;
      if (typeof data !== 'string') return;
      try {
        entry.lastSync = JSON.parse(data) as SyncState;
      } catch {
        return;
      }
      entry.listeners.forEach((l) => l.onSync?.(entry.lastSync!));
    });
    source.onopen = () => {
      entry.open = true;
      entry.listeners.forEach((l) => l.onOpen?.());
    };
    source.onerror = () => {
      entry.open = false;
      entry.listeners.forEach((l) => l.onError?.());
    };
    shared.set(organizationId, entry);
    s = entry;
  }

  s.listeners.add(handlers);
  if (s.open) handlers.onOpen?.();
  if (s.lastSync) handlers.onSync?.(s.lastSync);

  return () => {
    const entry = shared.get(organizationId);
    if (!entry) return;
    entry.listeners.delete(handlers);
    if (entry.listeners.size === 0) {
      entry.source.close();
      shared.delete(organizationId);
    }
  };
}
