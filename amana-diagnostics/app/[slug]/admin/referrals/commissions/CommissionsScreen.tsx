'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RiDownloadLine, RiPrinterLine } from '@remixicon/react';

import { useNotices } from '@/components/Notices';
import RequireRole from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { useShellSlot } from '@/components/shell';
import { Alert, Button, Card, CardBody, Field, Input, SegmentedControl, TabPanel, Tabs } from '@/components/ui';
import { orgName } from '@/lib/branding';
import { printHtml } from '@/lib/templates';
import { CommissionEntry, fetchCommissionReport, markCommissionPaid } from '@/lib/store';
import {
  buildCommissionCsv,
  buildCommissionStatementHtml,
  filterEntries,
  groupByReferrer,
  totalsFor,
  type StatusFilter,
  type TypeFilter,
} from '@/lib/commissionsView';

import { CommissionsByReferrer } from './CommissionsByReferrer';
import { CommissionsDetails } from './CommissionsDetails';
import { SettleCommissionDialog } from './SettleCommissionDialog';
import styles from './commissions.module.css';

const money = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function CommissionsPage() {
  const { notify, ask } = useNotices();
  const { organization } = useAuth();

  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'details' | 'summary'>('details');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [payingEntry, setPayingEntry] = useState<CommissionEntry | null>(null);
  const [payNotes, setPayNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useShellSlot(
    { subtitle: 'What is owed to the doctors and facilities who send you patients.' },
    [],
  );

  const load = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    const data = await fetchCommissionReport(
      organization.id,
      // Both ends read as local time. A bare "YYYY-MM-DD" is parsed as UTC
      // midnight while "YYYY-MM-DDTHH:MM:SS" is parsed as local, so the old
      // pair silently dropped the first hour of the opening day — in Nigeria,
      // every visit registered between midnight and 1am.
      dateFrom ? new Date(dateFrom + 'T00:00:00').toISOString() : undefined,
      dateTo ? new Date(dateTo + 'T23:59:59.999').toISOString() : undefined,
    );
    setEntries(data);
    setLoading(false);
  }, [organization?.id, dateFrom, dateTo]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => filterEntries(entries, { type: typeFilter, status: statusFilter, search }),
    [entries, typeFilter, statusFilter, search],
  );
  const totals = useMemo(() => totalsFor(filtered), [filtered]);
  const groups = useMemo(() => groupByReferrer(filtered), [filtered]);

  /**
   * Anything selected is dropped the moment the visible set changes.
   *
   * It used to survive: select five rows, narrow the filter, press "Mark
   * selected as paid", and commissions that were no longer on screen were
   * settled. Settling is not reversible from this screen.
   */
  useEffect(() => {
    setSelectedIds([]);
  }, [typeFilter, statusFilter, search, dateFrom, dateTo]);

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleSelectAll = () => {
    const pending = filtered.filter((e) => e.commissionStatus === 'pending').map((e) => e.patientId);
    setSelectedIds((prev) => (prev.length === pending.length ? [] : pending));
  };

  const settleSelected = async () => {
    if (selectedIds.length === 0) return;
    const ok = await ask(
      `Mark ${selectedIds.length} commission${selectedIds.length === 1 ? '' : 's'} as paid? This cannot be undone here.`,
    );
    if (!ok) return;

    setProcessing(true);
    try {
      await Promise.all(selectedIds.map((id) => markCommissionPaid(id, 'Bulk settlement')));
      setSelectedIds([]);
      await load();
    } catch (e: any) {
      notify('Could not settle those commissions: ' + e.message, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const settleOne = async () => {
    if (!payingEntry) return;
    setProcessing(true);
    try {
      await markCommissionPaid(payingEntry.patientId, payNotes);
      setPayingEntry(null);
      setPayNotes('');
      await load();
    } catch (e: any) {
      notify('Could not record that payment: ' + e.message, 'error');
    } finally {
      setProcessing(false);
    }
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
    // The old version never revoked this, so every export leaked its blob for
    // the lifetime of the tab.
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles['screen']}>
      <div className={styles['summary']}>
        <Figure label="Referrals" value={String(totals.entries)} />
        <Figure label="Referrers" value={String(totals.referrers)} />
        <Figure label="Billed" value={money(totals.billed)} />
        <Figure label="Commission owed" value={money(totals.outstanding)} tone="owed" />
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
          Settling cannot be undone from this screen.
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
