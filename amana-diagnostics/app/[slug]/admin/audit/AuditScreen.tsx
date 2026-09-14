'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiArrowDownSLine, RiArrowRightSLine, RiRefreshLine } from '@remixicon/react';

import RequireRole from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { useShellSlot } from '@/components/shell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Field,
  Input,
  Select,
  SkeletonRows,
  Table,
} from '@/components/ui';
import { describeAudit, type AuditEntry } from '@/lib/audit';
import type { AuditAction } from '@/lib/audit';
import { fetchAuditLog } from '@/lib/store';

import styles from './audit.module.css';

/** Groups of actions shown in the action filter. */
const ACTION_GROUPS: { label: string; actions: AuditAction[] }[] = [
  {
    label: 'Staff',
    actions: ['staff.role_changed', 'staff.removed'],
  },
  {
    label: 'Catalogue & prices',
    actions: ['catalogue.test_added', 'catalogue.test_updated', 'catalogue.test_retired', 'price.changed'],
  },
  {
    label: 'Referrers',
    actions: ['referrer.added', 'referrer.updated', 'referrer.deactivated', 'referrer.reactivated'],
  },
  {
    label: 'Commissions',
    actions: ['commission.settled', 'commission.reversed'],
  },
  {
    label: 'Settings',
    actions: ['settings.saved', 'letterhead.saved'],
  },
];

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  ...ACTION_GROUPS.flatMap((g) =>
    g.actions.map((a) => ({ value: a, label: a.replace('.', ' — ').replace(/_/g, ' ') })),
  ),
];

const ENTITY_LABELS: Record<string, string> = {
  profile: 'Staff member',
  test_price: 'Test price',
  custom_test: 'Test',
  referring_doctor: 'Doctor',
  referring_facility: 'Facility',
  patient: 'Patient',
  organization: 'Organisation',
};

function fmt(dt: string): string {
  return new Date(dt).toLocaleString('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function DiffPanel({ entry }: { entry: AuditEntry }) {
  const hasDiff = (entry.before && Object.keys(entry.before).length > 0) ||
    (entry.after && Object.keys(entry.after).length > 0);

  if (!hasDiff && !entry.reason) return null;

  return (
    <div className={styles['expandBody']}>
      {entry.reason && (
        <p className={styles['what']}>Reason: {entry.reason}</p>
      )}
      {hasDiff && (
        <div className={styles['diffGrid']}>
          <div>
            <p className={styles['diffLabel']}>Before</p>
            <pre className={styles['diffCode']}>
              {JSON.stringify(entry.before ?? {}, null, 2)}
            </pre>
          </div>
          <div>
            <p className={styles['diffLabel']}>After</p>
            <pre className={styles['diffCode']}>
              {JSON.stringify(entry.after ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditPage() {
  const { organization } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [actorSearch, setActorSearch] = useState('');
  const [since, setSince] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useShellSlot({ subtitle: 'Every admin change recorded — who did it, and what changed.' }, []);

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const data = await fetchAuditLog(organization.id, {
      since: since ? new Date(since + 'T00:00:00').toISOString() : undefined,
      action: actionFilter || undefined,
      limit: 200,
    });
    setEntries(data);
    setLoading(false);
  }, [organization?.id, actionFilter, since]);

  useEffect(() => {
    void load();
  }, [load]);

  // Re-fetch when the browser tab regains focus (another tab may have written rows).
  useEffect(() => {
    const handler = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [load]);

  const filtered = useMemo(() => {
    const q = actorSearch.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        (e.actor_name ?? '').toLowerCase().includes(q) ||
        (e.entity_label ?? '').toLowerCase().includes(q),
    );
  }, [entries, actorSearch]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const columns = [
    {
      key: 'when',
      header: 'When',
      render: (e: AuditEntry) => (
        <span className={styles['when']}>{fmt(e.created_at)}</span>
      ),
    },
    {
      key: 'who',
      header: 'Who',
      render: (e: AuditEntry) => (
        <span className={styles['who']}>{e.actor_name ?? 'System'}</span>
      ),
    },
    {
      key: 'what',
      header: 'What',
      render: (e: AuditEntry) => (
        <span className={styles['what']}>{describeAudit(e)}</span>
      ),
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (e: AuditEntry) => (
        <span className={styles['entity']}>
          {ENTITY_LABELS[e.entity_type] ?? e.entity_type}
        </span>
      ),
    },
    {
      key: 'origin',
      header: 'Origin',
      render: (e: AuditEntry) => (
        <Badge tone={e.origin === 'hub' ? 'accent' : 'info'}>
          {e.origin === 'hub' ? 'Hub' : 'Cloud'}
        </Badge>
      ),
    },
    {
      key: 'undo',
      header: '',
      render: (e: AuditEntry) =>
        e.reverses_id ? (
          <Badge tone="neutral">Undo</Badge>
        ) : null,
    },
    {
      key: 'expand',
      header: '',
      actions: true,
      render: (e: AuditEntry) => {
        const hasDiff =
          (e.before && Object.keys(e.before).length > 0) ||
          (e.after && Object.keys(e.after).length > 0) ||
          Boolean(e.reason);
        if (!hasDiff) return null;
        const isOpen = expanded.has(e.id);
        return (
          <button
            type="button"
            className={styles['expandToggle']}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Collapse details' : 'Expand details'}
            onClick={() => toggleExpand(e.id)}
          >
            {isOpen ? <RiArrowDownSLine size={16} /> : <RiArrowRightSLine size={16} />}
          </button>
        );
      },
    },
  ];

  return (
    <div className={styles['screen']}>
      <Card>
        <CardBody>
          <div className={styles['filters']}>
            <Field label="Search" labelHidden className={styles['searchField']}>
              <Input
                type="search"
                value={actorSearch}
                onChange={(e) => setActorSearch(e.target.value)}
                placeholder="Search by who or what…"
              />
            </Field>

            <Field label="Action" className={styles['actionField']}>
              <Select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Since" className={styles['dateField']}>
              <Input
                type="date"
                value={since}
                onChange={(e) => setSince(e.target.value)}
              />
            </Field>

            <div className={styles['toolbar']}>
              <Button
                icon={<RiRefreshLine size={15} />}
                loading={loading}
                onClick={load}
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody flush>
          {loading ? (
            <div className={styles['loading']}>
              <SkeletonRows rows={8} columns={[2, 1, 3, 1, 1, 1, 1]} />
            </div>
          ) : (
            <>
              <Table
                caption="Audit log"
                rows={filtered}
                rowKey={(e: AuditEntry) => e.id}
                empty={
                  <EmptyState title="Nothing to show here">
                    {actionFilter || actorSearch || since
                      ? 'Try widening the filters.'
                      : 'Admin changes will appear here once they are made.'}
                  </EmptyState>
                }
                columns={columns}
              />
              {/* Expand panels are rendered below the table row they belong to.
                  Since Table doesn't support expandable rows, we overlay the
                  diff panel immediately after a row's card. This is the simplest
                  approach that avoids touching the shared Table component. */}
              {filtered.map((e) =>
                expanded.has(e.id) ? (
                  <DiffPanel key={`diff-${e.id}`} entry={e} />
                ) : null,
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** Only admins may read the audit trail. */
export default function GuardedAuditPage(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <AuditPage {...props} />
    </RequireRole>
  );
}
