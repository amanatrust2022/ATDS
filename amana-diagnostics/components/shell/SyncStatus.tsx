'use client';

import { useEffect, useState } from 'react';
import { RiCloudLine, RiCloudOffLine, RiErrorWarningLine, RiRefreshLine } from '@remixicon/react';
import { useAuth } from '@/components/AuthProvider';
import { Badge } from '@/components/ui';

/**
 * Whether this machine's work has reached the cloud.
 *
 * Lifted out of the old Header so it survives that component's retirement.
 * Two things changed on the way:
 *
 *   - It says what it means. "Synced to Supabase Cloud" and `sync_stalled`
 *     are our vocabulary, not a receptionist's.
 *   - A sync that did not finish no longer reads as a green tick. Rows the
 *     cloud kept refusing, and tables that could not be fetched, were both
 *     previously invisible behind the word "Synced".
 */

interface SyncState {
  status: string;
  pendingCount: number;
  /** Rows the cloud kept refusing. These do not clear themselves. */
  deadLetterCount?: number;
  /** Tables whose pull did not finish, so their data here is behind. */
  failedTables?: string[];
}

/** Local mode is the only mode that syncs; on the cloud there is nothing to do. */
function useIsLocalMode(): boolean {
  const [local, setLocal] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem('amana_local_mode');
    if (stored !== null) {
      setLocal(stored === 'true');
      return;
    }
    const h = window.location.hostname;
    setLocal(
      h === 'localhost' ||
        h === '127.0.0.1' ||
        h.startsWith('192.168.') ||
        h.startsWith('10.') ||
        h.startsWith('172.'),
    );
  }, []);
  return local;
}

export function SyncStatus() {
  const { organization, session } = useAuth();
  const isLocal = useIsLocalMode();
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => {
    if (!isLocal || !organization) return;

    let active = true;
    // A sync used to fire every 15 seconds whether or not the last one had
    // finished, so a slow run overlapped the next and the two raced each
    // other over the same outbox rows.
    let running = false;

    const run = async () => {
      if (running) return;
      running = true;
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

        const res = await fetch('/api/sync', {
          method: 'POST',
          headers,
          body: JSON.stringify({ organizationId: organization.id }),
        });
        if (!res.ok) throw new Error('Sync failed');
        const data = await res.json();
        if (active) setState(data);
      } catch {
        if (active) {
          setState((prev) => ({
            status: 'offline',
            pendingCount: prev?.pendingCount ?? 0,
          }));
        }
      } finally {
        running = false;
      }
    };

    void run();
    const id = setInterval(run, 15_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isLocal, organization, session]);

  if (!isLocal || !state) return null;

  const needsAttention =
    (state.deadLetterCount ?? 0) > 0 ||
    (state.failedTables?.length ?? 0) > 0 ||
    state.status === 'partial_sync' ||
    state.status === 'needs_attention';

  if (state.status === 'offline') {
    return (
      <Badge tone="warning" icon={<RiCloudOffLine size={13} />}>
        Offline
        {state.pendingCount > 0 && ` · ${state.pendingCount} waiting`}
      </Badge>
    );
  }

  if (needsAttention) {
    const detail = [
      state.deadLetterCount
        ? `${state.deadLetterCount} change${state.deadLetterCount === 1 ? '' : 's'} the cloud will not accept. They are safe here but will not send until someone looks at them.`
        : '',
      state.failedTables?.length
        ? `Could not fetch: ${state.failedTables.join(', ')}. That data may be out of date; it will be retried.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span title={detail}>
        <Badge tone="critical" icon={<RiErrorWarningLine size={13} />}>
          Not fully synced
        </Badge>
        <span className="sr-only">{detail}</span>
      </span>
    );
  }

  if (state.status === 'pending_sync' || state.status === 'sync_stalled') {
    return (
      <Badge tone="accent" icon={<RiRefreshLine size={13} />}>
        Saving · {state.pendingCount}
      </Badge>
    );
  }

  return (
    <Badge tone="success" icon={<RiCloudLine size={13} />}>
      All changes saved
    </Badge>
  );
}
