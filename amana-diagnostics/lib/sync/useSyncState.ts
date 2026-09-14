'use client';

import { useEffect, useState } from 'react';
import { getRuntimeMode } from '@/lib/runtimeMode';
import { subscribeHubEvents, lastKnownSyncState } from '@/lib/hubEvents';
import { onSyncNudge } from '@/lib/sync/nudge';
import type { SyncState } from '@/lib/sync/engine';

/**
 * The hub's sync state, as the hub reports it.
 *
 * This is where a screen finds out whether the clinic is online. Not from
 * the hostname, not from `navigator.onLine` (which says whether the laptop
 * has Wi-Fi, not whether the hub can reach the cloud), and not from a fetch
 * of its own — from the engine, over the event stream every screen already
 * holds, so every tab in the building shows the same word at the same
 * moment.
 *
 * Returns null on the cloud deployment, where there is nothing to sync, and
 * until the hub has answered.
 *
 * The hook also does the one thing a browser can do for the engine that the
 * engine cannot do for itself: hand over a session, so a hub without a
 * service key can act as the signed-in user. It does so on mount, whenever
 * the token changes, and when the tab wakes.
 */
export function useSyncState(
  organizationId: string | null | undefined,
  accessToken: string | null | undefined,
): SyncState | null {
  const [state, setState] = useState<SyncState | null>(
    () => (organizationId ? lastKnownSyncState(organizationId) : null),
  );

  useEffect(() => {
    if (!organizationId || getRuntimeMode() !== 'local') {
      setState(null);
      return;
    }

    let active = true;
    let streamUp = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    const read = async () => {
      try {
        const res = await fetch('/api/sync');
        if (!res.ok || !active) return;
        setState(await res.json());
      } catch {
        // The hub itself is unreachable. The stream's error handler owns that.
      }
    };
    const startPolling = () => {
      if (poll) return;
      void read();
      poll = setInterval(read, FALLBACK_POLL_MS);
    };
    const stopPolling = () => {
      if (poll) { clearInterval(poll); poll = null; }
    };

    const leave = subscribeHubEvents(organizationId, {
      onSync: (s) => { if (active) setState(s); },
      onOpen: () => { streamUp = true; stopPolling(); },
      onError: () => { streamUp = false; startPolling(); },
    });
    if (!streamUp) startPolling();

    // Hand over the session, and ask for a run while we are at it.
    const handOver = () => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
      fetch('/api/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ organizationId, action: 'session' }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((s) => { if (s && active && !streamUp) setState(s); })
        .catch(() => { /* the poll and the stream carry on */ });
    };
    handOver();
    const refresh = setInterval(handOver, SESSION_REFRESH_MS);
    // A write from this tab. The hub's engine already runs on its own
    // outbox bell; this is the belt to that brace, and it also brings the
    // engine up if this tab is the first thing to reach a freshly started hub.
    const stopNudges = onSyncNudge(handOver);
    const onWake = () => { if (document.visibilityState === 'visible') handOver(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', handOver);

    return () => {
      active = false;
      clearInterval(refresh);
      stopNudges();
      stopPolling();
      leave();
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', handOver);
    };
  }, [organizationId, accessToken]);

  return state;
}

/** While the stream is down, how often to ask the hub for its state. */
export const FALLBACK_POLL_MS = 15_000;
/** How often to re-hand the session over, so the engine's copy never lapses while a tab is open. */
export const SESSION_REFRESH_MS = 5 * 60_000;

/**
 * The one-word answer a screen usually wants. `null` where there is no hub.
 *
 *   online      the hub can reach the cloud right now
 *   offline     it cannot; changes queue on the hub and go up later
 *   signed_out  it could, but has nobody to act as
 */
export function connectivityOf(state: SyncState | null): 'online' | 'offline' | 'signed_out' | null {
  if (!state || !state.enabled) return null;
  if (state.status === 'signed_out') return 'signed_out';
  if (state.connectivity === 'offline') return 'offline';
  if (state.connectivity === 'online') return 'online';
  return null;
}
