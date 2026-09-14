'use client';

import { RiCloudLine, RiCloudOffLine, RiErrorWarningLine, RiRefreshLine, RiFlashlightLine } from '@remixicon/react';
import { useAuth } from '@/components/AuthProvider';
import { Badge } from '@/components/ui';
import { useSyncState } from '@/lib/sync/useSyncState';

/**
 * Whether this clinic's work has reached the cloud, and whether the cloud's
 * has reached here.
 *
 * This component used to *run* the sync — a fetch every fifteen seconds
 * from every open tab — and its "Offline" was the only place in the app
 * that knew whether the cloud was reachable. The hub's engine owns both
 * now (lib/sync/engine.ts); this shows what the engine says, delivered
 * over the event stream the moment it changes.
 *
 * Words, not our vocabulary: a receptionist reads "Offline · 3 waiting",
 * not "sync_stalled".
 */
export function SyncStatus() {
  const { organization, session } = useAuth();
  const state = useSyncState(organization?.id, session?.access_token);

  // Cloud deployment, or no answer from the hub yet.
  if (!state || !state.enabled) return null;

  const waiting = state.pendingCount > 0 ? ` · ${state.pendingCount} waiting` : '';

  // The cloud will not take this machine's changes from nobody. They are
  // safe on the hub and go up untouched once someone signs in.
  if (state.status === 'signed_out') {
    return (
      <Badge tone="warning" icon={<RiErrorWarningLine size={13} />}>
        Sign in to sync{waiting}
      </Badge>
    );
  }

  if (state.status === 'offline') {
    return (
      <span title="The hub cannot reach the cloud. Everything keeps working here and goes up when the connection returns.">
        <Badge tone="warning" icon={<RiCloudOffLine size={13} />}>
          Offline{waiting}
        </Badge>
      </span>
    );
  }

  if (state.status === 'needs_attention') {
    const detail = [
      state.deadLetterCount
        ? `${state.deadLetterCount} change${state.deadLetterCount === 1 ? '' : 's'} the cloud will not accept. They are safe here but will not send until someone looks at them.`
        : '',
      state.deadPullRows
        ? `${state.deadPullRows} record${state.deadPullRows === 1 ? '' : 's'} from the cloud could not be saved here.`
        : '',
      state.failedTables.length
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

  if (state.status === 'pending_sync' || state.running) {
    return (
      <Badge tone="accent" icon={<RiRefreshLine size={13} />}>
        Saving · {state.pendingCount}
      </Badge>
    );
  }

  const live = state.realtime === 'connected';
  return (
    <span title={live ? 'Changes made on the web arrive here as they happen.' : 'Checking the cloud every few seconds.'}>
      <Badge tone="success" icon={live ? <RiFlashlightLine size={13} /> : <RiCloudLine size={13} />}>
        All changes saved
      </Badge>
    </span>
  );
}
