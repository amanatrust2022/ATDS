'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RiDownloadLine, RiPrinterLine } from '@remixicon/react';

import { useNotices } from '@/components/Notices';
import RequireRole from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { useShellSlot } from '@/components/shell';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Field,
  Input,
  SegmentedControl,
  Stat,
  TabPanel,
  Tabs,
} from '@/components/ui';
import { orgName } from '@/lib/branding';
import { printHtml } from '@/lib/templates';
import {
  CommissionEntry,
  fetchCommissionReport,
  markCommissionPaid,
  markCommissionsUnpaid,
  recordAudit,
} from '@/lib/store';
import {
  AGE_BUCKET_LABEL,
  AGE_BUCKETS,
  ageingBuckets,
  buildCommissionCsv,
  buildCommissionStatementHtml,
  filterEntries,
  groupByReferrer,
  settleMany,
  totalsFor,
  type StatusFilter,
  type TypeFilter,
} from '@/lib/commissionsView';
import { SettleReferrerDialog } from '@/components/features/commissions/SettleReferrerDialog';
import type { SettleResult } from '@/lib/commissionsView';

import { CommissionsByReferrer } from './CommissionsByReferrer';
import { CommissionsDetails } from './CommissionsDetails';
import { SettleCommissionDialog } from './SettleCommissionDialog';
import styles from './commissions.module.css';

const money = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (n: number) => `₦${n.toLocaleString('en-NG')}`;

function CommissionsPage() {
  const { notify, ask, askFor } = useNotices();
  const { organization, profile } = useAuth();
  const searchParams = useSearchParams();

  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ?referrer=id pre-filters the screen when linked from the Referrers table
  const [search, setSearch] = useState(() => {
    // Will be set after first load once we know the referrer name
    return '';
  });
  const [referrerIdFilter] = useState(() => searchParams?.get('referrer') ?? '');

  const [tab, setTab] = useState<'details' | 'summary'>('details');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payingEntry, setPayingEntry] = useState<CommissionEntry | null>(null);
  const [payNotes, setPayNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [partialAlert, setPartialAlert] = useState<{ failed: SettleResult['failed']; paidCount: number } | null>(null);

  // Batch-referrer dialog
  const [settlingReferrer, setSettlingReferrer] = useState<string | null>(null);

  useShellSlot(
    { subtitle: 'What is owed to the doctors and facilities who send you patients.' },
    [],
  );

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const data = await fetchCommissionReport(
      organization.id,
      dateFrom ? new Date(dateFrom + 'T00:00:00').toISOString() : undefined,
      dateTo ? new Date(dateTo + 'T23:59:59.999').toISOString() : undefined,
    );
    setEntries(data);
    setLoading(false);
  }, [organization?.id, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  // If a referrer= param was passed, find their name from the loaded entries
  // and pre-populate the search so the table is filtered to them.
  useEffect(() => {
    if (!referrerIdFilter || entries.length === 0) return;
    const match = entries.find((e) => e.referrerId === referrerIdFilter);
    if (match && !search) setSearch(match.referrerName);
  }, [referrerIdFilter, entries]);

  const filtered = useMemo(
    () => filterEntries(entries, { type: typeFilter, status: statusFilter, search }),
    [entries, typeFilter, statusFilter, search],
  );
  const totals = useMemo(() => totalsFor(filtered), [filtered]);
  const groups = useMemo(() => groupByReferrer(filtered), [filtered]);
  const ageing = useMemo(() => ageingBuckets(entries, new Date()), [entries]);

  useEffect(() => {
    setSelectedIds([]);
    setPartialAlert(null);
  }, [typeFilter, statusFilter, search, dateFrom, dateTo]);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleSelectAll = () => {
    const pending = filtered.filter((e) => e.commissionStatus === 'pending').map((e) => e.patientId);
    setSelectedIds((prev) => (prev.length === pending.length ? [] : pending));
  };

  const actor = {
    organization_id: organization?.id ?? '',
    actor_id: profile?.id ?? null,
    actor_name: profile?.full_name ?? null,
  };

  /** Write one commission.settled row per paid ID. */
  const writeSettledAudit = async (ids: (string | number)[], reference: string) => {
    const total = entries
      .filter((e) => ids.includes(e.patientId))
      .reduce((s, e) => s + e.commissionAmount, 0);
    await recordAudit({
      ...actor,
      action: 'commission.settled',
      entity_type: 'patient',
      entity_id: String(ids[0] ?? ''),
      entity_label: ids.length === 1
        ? entries.find((e) => e.patientId === ids[0])?.patientName ?? String(ids[0])
        : `${ids.length} visits`,
      after: { reference: reference || null, count: ids.length, amount: total },
    }).catch((err) => console.warn('commission.settled audit failed:', err));
  };

  const writeReversedAudit = async (id: string | number, reason: string, reversesId?: string) => {
    await recordAudit({
      ...actor,
      action: 'commission.reversed',
      entity_type: 'patient',
      entity_id: String(id),
      entity_label: entries.find((e) => e.patientId === id)?.patientName ?? String(id),
      reason,
      reverses_id: reversesId ?? null,
    }).catch((err) => console.warn('commission.reversed audit failed:', err));
  };

  /* ── Bulk settle (checkbox selection) ─── */

  const settleSelected = async () => {
    if (selectedIds.length === 0) return;
    const ok = await ask(
      `Mark ${selectedIds.length} commission${selectedIds.length === 1 ? '' : 's'} as paid?`,
    );
    if (!ok) return;

    setProcessing(true);
    setPartialAlert(null);
    try {
      const result = await settleMany(selectedIds, '', markCommissionPaid);
      if (result.paid.length > 0) {
        await writeSettledAudit(result.paid, '');
        notify(
          `${result.paid.length} commission${result.paid.length === 1 ? '' : 's'} marked as paid.`,
          {
            tone: 'success',
            action: {
              label: 'Undo',
              run: async () => {
                await markCommissionsUnpaid(result.paid);
                for (const id of result.paid) {
                  await writeReversedAudit(id, 'Undone from bulk settle');
                }
                await load();
              },
            },
          },
        );
      }
      if (result.failed.length > 0) {
        setPartialAlert({ failed: result.failed, paidCount: result.paid.length });
      }
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      notify('Could not settle those commissions: ' + e.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  /* ── Single-row settle ─── */

  const settleOne = async () => {
    if (!payingEntry) return;
    setProcessing(true);
    try {
      await markCommissionPaid(payingEntry.patientId, payNotes);
      const auditRow = await writeSettledAuditRow(payingEntry, payNotes);
      const paidId = payingEntry.patientId;
      const paidName = payingEntry.patientName;

      notify(`Commission for ${paidName} marked as paid.`, {
        tone: 'success',
        action: {
          label: 'Undo',
          run: async () => {
            const reason = await askFor('Why is this commission being reversed?');
            if (reason === null) return; // user cancelled
            await markCommissionsUnpaid([paidId]);
            await writeReversedAudit(paidId, reason || 'Reversed', auditRow?.id);
            await load();
          },
        },
      });

      setPayingEntry(null);
      setPayNotes('');
      await load();
    } catch (e: any) {
      notify('Could not record that payment: ' + e.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  /** Write and return one commission.settled audit row. */
  const writeSettledAuditRow = async (entry: CommissionEntry, reference: string) => {
    return recordAudit({
      ...actor,
      action: 'commission.settled',
      entity_type: 'patient',
      entity_id: String(entry.patientId),
      entity_label: entry.patientName,
      after: { reference: reference || null, count: 1, amount: entry.commissionAmount },
    }).catch((err) => {
      console.warn('commission.settled audit failed:', err);
      return null;
    });
  };

  /* ── Referrer batch payout ─── */

  const handleReferrerSettle = async (reference: string, result: SettleResult) => {
    if (result.paid.length > 0) {
      await writeSettledAudit(result.paid, reference);
      const total = entries
        .filter((e) => result.paid.includes(e.patientId))
        .reduce((s, e) => s + e.commissionAmount, 0);

      notify(
        `${result.paid.length} visit${result.paid.length === 1 ? '' : 's'} settled — ${money(total)}.`,
        {
          tone: 'success',
          ...(result.failed.length === 0
            ? {
                action: {
                  label: 'Undo',
                  run: async () => {
                    await markCommissionsUnpaid(result.paid);
                    for (const id of result.paid) {
                      await writeReversedAudit(id, 'Undone from referrer payout');
                    }
                    await load();
                  },
                },
              }
            : {}),
        },
      );
    }
    if (result.failed.length === 0) {
      setSettlingReferrer(null);
    }
    await load();
  };

  const printStatement = (referrerName?: string) =>
    printHtml(
      buildCommissionStatementHtml({
        clinicName: orgName(organization),
        entries: filtered,
        ...(referrerName ? { referrerName } : {}),
      }),
    );

  const exportCsv = () => {
    const blob = new Blob([buildCommissionCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-${dateFrom || 'all'}-to-${dateTo || 'now'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const settlingReferrerEntries = useMemo(() => {
    if (!settlingReferrer) return [];
    return filtered.filter((e) => e.referrerName === settlingReferrer && e.commissionStatus === 'pending');
  }, [filtered, settlingReferrer]);

  return (
    <div className={styles['screen']}>
      {/* Ageing buckets — how long commissions have been owed */}
      <div className={styles['summary']}>
        {AGE_BUCKETS.map((bucket) => (
          <Stat
            key={bucket}
            label={AGE_BUCKET_LABEL[bucket]}
            value={moneyShort(ageing[bucket].amount)}
            note={`${ageing[bucket].count} visit${ageing[bucket].count === 1 ? '' : 's'}`}
          />
        ))}
      </div>

      <Card>
        <CardBody>
          <div className={styles['filters']}>
            <Field label="Search" labelHidden className={styles['searchField']}>
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient, referrer or slip…"
              />
            </Field>

            <SegmentedControl
              value={typeFilter}
              onValueChange={setTypeFilter}
              ariaLabel="Referrer type"
              options={[
                { value: 'all', label: 'Everyone' },
                { value: 'doctor', label: 'Doctors' },
                { value: 'facility', label: 'Facilities' },
              ]}
            />

            <SegmentedControl
              value={statusFilter}
              onValueChange={setStatusFilter}
              ariaLabel="Settlement status"
              options={[
                { value: 'all', label: 'Any status' },
                { value: 'pending', label: 'Owed' },
                { value: 'paid', label: 'Settled' },
              ]}
            />

            <div className={styles['dates']}>
              <Field label="From" className={styles['dateField']}>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </Field>
              <Field label="To" className={styles['dateField']}>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </Field>
            </div>

            <div className={styles['exports']}>
              <Button icon={<RiPrinterLine size={15} />} onClick={() => printStatement()}>
                Print
              </Button>
              <Button icon={<RiDownloadLine size={15} />} onClick={exportCsv}>
                CSV
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Summary totals (overall, not ageing) */}
      <div className={styles['summary']}>
        <Figure label="Referrals" value={String(totals.entries)} />
        <Figure label="Referrers" value={String(totals.referrers)} />
        <Figure label="Billed" value={money(totals.billed)} />
        <Figure label="Commission owed" value={money(totals.outstanding)} tone="owed" />
      </div>

      {selectedIds.length > 0 && (
        <Alert
          tone="info"
          live
          title={`${selectedIds.length} commission${selectedIds.length === 1 ? '' : 's'} selected`}
          actions={
            <>
              <Button intent="primary" size="sm" loading={processing} onClick={settleSelected}>
                Mark as paid
              </Button>
              <Button size="sm" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </>
          }
        >
          You can undo this after settling.
        </Alert>
      )}

      {partialAlert && (
        <Alert
          tone="warning"
          title={`${partialAlert.failed.length} commission${partialAlert.failed.length === 1 ? '' : 's'} could not be settled`}
          actions={
            <Button size="sm" onClick={() => setPartialAlert(null)}>
              Dismiss
            </Button>
          }
        >
          {partialAlert.paidCount > 0 && (
            <p>{partialAlert.paidCount} were settled successfully. The following failed:</p>
          )}
          <ul>
            {partialAlert.failed.map((f) => (
              <li key={String(f.id)}>{f.error}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'details' | 'summary')}
        ariaLabel="How to view the commissions"
        items={[
          { value: 'details', label: 'By visit', count: filtered.length },
          { value: 'summary', label: 'By referrer', count: groups.length },
        ]}
      >
        <TabPanel value="details">
          <Card>
            <CardBody flush>
              <CommissionsDetails
                entries={filtered}
                loading={loading}
                selectedIds={selectedIds}
                onToggle={toggleSelect}
                onToggleAll={toggleSelectAll}
                onSettle={setPayingEntry}
              />
            </CardBody>
          </Card>
        </TabPanel>

        <TabPanel value="summary">
          <CommissionsByReferrer
            groups={groups}
            expanded={expanded}
            onToggle={(name) => setExpanded((p) => ({ ...p, [name]: !p[name] }))}
            onPrint={printStatement}
            onPayOut={(name) => setSettlingReferrer(name)}
          />
        </TabPanel>
      </Tabs>

      <SettleCommissionDialog
        entry={payingEntry}
        notes={payNotes}
        onNotesChange={setPayNotes}
        processing={processing}
        onConfirm={settleOne}
        onClose={() => {
          setPayingEntry(null);
          setPayNotes('');
        }}
      />

      {settlingReferrer && (
        <SettleReferrerDialog
          referrerName={settlingReferrer}
          pendingEntries={settlingReferrerEntries}
          open={Boolean(settlingReferrer)}
          onClose={() => setSettlingReferrer(null)}
          onSettle={handleReferrerSettle}
        />
      )}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'owed' }) {
  return (
    <Card as="div">
      <CardBody>
        <p className={tone === 'owed' ? styles['figureOwed'] : styles['figure']}>{value}</p>
        <p className={styles['figureLabel']}>{label}</p>
      </CardBody>
    </Card>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedCommissionsPage(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <CommissionsPage {...props} />
    </RequireRole>
  );
}
