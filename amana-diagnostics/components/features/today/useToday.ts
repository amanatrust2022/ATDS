'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { bearerHeaders } from '@/lib/authHeaders';
import { subscribeToPatients } from '@/lib/store';
import type { TodayPayload } from '@/lib/today';

/**
 * The Today screen's rows, kept fresh.
 *
 * Loads once, then again whenever a patient, test or wallet changes
 * anywhere in the building — the same doorbell the benches answer — and
 * when the tab comes back into view. A refresh keeps the figures already
 * on screen until the new ones arrive: the page must not flash back to
 * skeletons every time reception registers someone.
 */
export interface TodayState {
  payload: TodayPayload | null;
  error: string | null;
  /** True only before the first answer. Later refreshes are silent. */
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  lastLoadedAt: Date | null;
}

const REFRESH_DEBOUNCE_MS = 800;

export function useToday(organizationId: string | undefined): TodayState {
  const [payload, setPayload] = useState<TodayPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    // Two doorbells in quick succession should not race two fetches whose
    // answers could land out of order.
    if (inFlight.current) return inFlight.current;

    const run = (async () => {
      setRefreshing(true);
      try {
        const res = await fetch(`/api/admin/today?organizationId=${organizationId}`, {
          headers: await bearerHeaders(),
        });
        if (!res.ok) {
          let reason = `The figures could not be loaded (${res.status}).`;
          try {
            const body = await res.json();
            if (body?.error) reason = body.error;
          } catch {
            /* not JSON; the status will have to do */
          }
          throw new Error(reason);
        }
        const data = (await res.json()) as TodayPayload;
        setPayload(data);
        setError(null);
        setLastLoadedAt(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The figures could not be loaded.');
      } finally {
        setRefreshing(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    void refresh();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), REFRESH_DEBOUNCE_MS);
    };

    const unsubscribe = subscribeToPatients(organizationId, later);
    const onVisible = () => {
      if (document.visibilityState === 'visible') later();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [organizationId, refresh]);

  return {
    payload,
    error,
    loading: payload === null && error === null,
    refreshing,
    refresh,
    lastLoadedAt,
  };
}
