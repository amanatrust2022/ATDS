'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import RequireRole from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { useNotices } from '@/components/Notices';
import { useShellSlot } from '@/components/shell/ShellSlot';
import { Alert, Button, Card, CardBody, CardHeader, SegmentedControl } from '@/components/ui';
import { TrendChart } from '@/components/features/reports/TrendChart';
import { ExceptionsInbox } from '@/components/features/today/ExceptionsInbox';
import {
  DeptShare,
  FloorCards,
  MoneyRow,
  ThroughputRow,
  TopReferrers,
  TopStaff,
} from '@/components/features/today/TodayPanels';
import { useToday } from '@/components/features/today/useToday';
import { jsonAuthHeaders } from '@/lib/authHeaders';
import { useSyncState } from '@/lib/sync/useSyncState';
import { buildToday, PERIOD_LABEL, type Period } from '@/lib/today';

import styles from '@/components/features/today/today.module.css';

const PERIOD_KEY = 'amana_today_period';
const PERIODS: Period[] = ['today', '7days', '30days'];
/** The figures are recomputed against the clock this often, so a wait grows without a reload. */
const TICK_MS = 60_000;

/**
 * The control tower.
 *
 * What replaced it: three tiles — staff count, pending invites, and the
 * workspace slug — and a card telling the administrator to use the sidebar.
 * Every figure an owner opens the app for was already in the database and
 * most were already computed, two clicks away under Staff › Performance.
 *
 * This screen answers the five questions in order: what did we make, is
 * anything stuck, who is owed, is the cloud up to date, what needs me. The
 * arithmetic is lib/today; the rows are one bounded call; the page refreshes
 * itself when the building changes.
 */
function Today() {
  const { organization, session } = useAuth();
  const { notify } = useNotices();
  const params = useParams();
  const slug = (params?.slug as string) ?? organization?.slug ?? '';

  const [period, setPeriod] = useState<Period>('today');
  const [now, setNow] = useState(() => new Date());
  const [syncing, setSyncing] = useState(false);

  const { payload, error, loading, refreshing, refresh } = useToday(organization?.id);
  const sync = useSyncState(organization?.id, session?.access_token);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PERIOD_KEY) as Period | null;
      if (saved && PERIODS.includes(saved)) setPeriod(saved);
    } catch {
      /* Site data blocked. Today is the right default. */
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const choosePeriod = (next: Period) => {
    setPeriod(next);
    try {
      localStorage.setItem(PERIOD_KEY, next);
    } catch {
      /* The choice just will not survive a reload. */
    }
  };

  const model = useMemo(
    () => (payload ? buildToday(payload, { period, now, slug, sync }) : null),
    [payload, period, now, slug, sync],
  );

  useShellSlot(
    {
      subtitle: organization ? `${organization.name} · ${PERIOD_LABEL[period].toLowerCase()}` : undefined,
      actions: (
        <SegmentedControl<Period>
          value={period}
          onValueChange={choosePeriod}
          ariaLabel="Period to look at"
          options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
        />
      ),
    },
    [organization?.name, period],
  );

  const runSync = useCallback(async () => {
    if (!organization) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: await jsonAuthHeaders(),
        body: JSON.stringify({ organizationId: organization.id, action: 'requeue' }),
      });
      if (!res.ok) throw new Error(`The hub answered ${res.status}.`);
      notify('Sync asked to run. The badge in the header shows how it goes.', 'success');
      void refresh();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'The hub could not be asked to sync.', 'error');
    } finally {
      setSyncing(false);
    }
  }, [organization, notify, refresh]);

  const deptTotal = model ? Object.values(model.deptShare).reduce((s, d) => s + d.rev, 0) : 0;
  const truncatedNote = model
    ? [
        model.truncated.unfinished && 'the waiting list',
        model.truncated.unpaid && 'the unpaid visits',
        model.truncated.pendingCommission && 'the commissions owed',
      ].filter(Boolean)
    : [];

  return (
    <div className={styles['page']}>
      {error && (
        <Alert
          tone="critical"
          title="The figures could not be loaded"
          live
          actions={
            <Button size="sm" onClick={() => void refresh()} loading={refreshing}>
              Try again
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <MoneyRow money={model?.money ?? null} loading={loading} />
      <ThroughputRow t={model?.throughput ?? null} loading={loading} />

      <div className={styles['twoUp']}>
        <Card>
          <CardHeader
            title="Needs attention"
            subtitle="Worst first. Each line opens where you deal with it."
            actions={
              model && model.exceptions.length > 0 ? (
                <span className={styles['sectionMeta']}>
                  {model.exceptions.length} item{model.exceptions.length === 1 ? '' : 's'}
                </span>
              ) : undefined
            }
          />
          <CardBody flush>
            {model ? (
              <ExceptionsInbox exceptions={model.exceptions} onRunSync={() => void runSync()} syncing={syncing} />
            ) : (
              <p className={styles['allClear']} role="status" aria-live="polite">
                {loading ? 'Looking through the building…' : ''}
              </p>
            )}
          </CardBody>
        </Card>

        <div>
          <div className={styles['sectionHead']}>
            <h2 className={styles['sectionTitle']}>The floor</h2>
            <span className={styles['sectionMeta']}>Right now</span>
          </div>
          {model && <FloorCards floor={model.floor} />}
        </div>
      </div>

      {truncatedNote.length > 0 && (
        <p className={styles['truncNote']} role="note">
          There is more than fits: {truncatedNote.join(', ')} {truncatedNote.length === 1 ? 'is' : 'are'} cut at
          five hundred rows, so those figures are floors rather than totals.
        </p>
      )}

      <div className={styles['twoUp']}>
        <Card>
          <CardHeader
            title="Revenue over time"
            subtitle={
              period === 'today'
                ? 'The week that led to today, by day'
                : `Billed value of tests signed off, by ${period === '30days' ? 'two days' : 'day'}`
            }
          />
          <CardBody>
            {model && <TrendChart trend={model.trend} geo={model.chart} emptyHint="Come back tomorrow." />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Where the money came from" subtitle="Tests signed off in this period" />
          <CardBody>{model && <DeptShare share={model.deptShare} total={deptTotal} />}</CardBody>
        </Card>
      </div>

      <div className={styles['twoUp']}>
        {model && <TopReferrers rows={model.topReferrers} slug={slug} />}
        {model && <TopStaff rows={model.topStaff} slug={slug} />}
      </div>
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedToday() {
  return (
    <RequireRole allow={['admin']}>
      <Today />
    </RequireRole>
  );
}
