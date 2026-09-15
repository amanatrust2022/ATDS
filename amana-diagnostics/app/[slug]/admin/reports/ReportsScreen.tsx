'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RiHandCoinLine, RiLineChartLine } from '@remixicon/react';

import RequireRole from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { useShellSlot } from '@/components/shell';
import { Alert, Badge, Button, Card, CardBody, CardHeader, DescriptionList, Dialog, EmptyState, Field, Input, Select, SkeletonRows, Stat, Table, TabPanel, Tabs } from '@/components/ui';
import type { Tone } from '@/components/ui';
import { StaffPerformance } from '@/components/features/reports/StaffPerformance';
import { bearerHeaders, jsonAuthHeaders } from '@/lib/authHeaders';
import { apiBase } from '@/lib/cloudOrigin';
import { useRuntimeMode } from '@/lib/useRuntimeMode';
import { orgName } from '@/lib/branding';
import {
  AGE_BUCKETS,
  AGE_BUCKET_LABEL,
  ageingBuckets,
  groupByReferrer,
  type AgeBucket,
} from '@/lib/commissionsView';
import { printHtml } from '@/lib/templates';
import { buildStaffAuditHtml } from '@/lib/staffAudit';
import {
  filterByRange,
  searchStaff,
  sortStaff,
  staffRows,
  totalsFor,
  type DateRange,
  type PerformanceData,
  type PerformanceCommissionType,
  type SortField,
} from '@/lib/staffPerformance';
import { fetchCommissionReport, fetchStaff, type CommissionEntry, type StaffMember } from '@/lib/store';

import styles from './reports.module.css';

const money = (n: number) => `₦${(n || 0).toLocaleString('en-NG')}`;

/** A year back is as far as the report reaches; the picker narrows within it. */
const SINCE_DAYS = 365;

/**
 * The business, over a period.
 *
 * This is what was the "Performance" tab under Staff: revenue, turnaround,
 * collection rate and department share — the clinic's figures, filed under
 * personnel because that is where the leaderboard happened to be. The staff
 * screen is about people now; this is about money and work. A second tab
 * ages the commission owed, which nothing showed before.
 */
function Reports() {
  const { organization, profile } = useAuth();
  const runtimeMode = useRuntimeMode();
  const params = useParams();
  const slug = (params?.slug as string) ?? organization?.slug ?? '';

  const [tab, setTab] = useState<'performance' | 'ageing'>('performance');
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('volume');

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [commissionType, setCommissionType] = useState<PerformanceCommissionType>('none');
  const [commissionValue, setCommissionValue] = useState('0');
  const [savingCommission, setSavingCommission] = useState(false);
  const [commissionMessage, setCommissionMessage] = useState<{ tone: 'critical' | 'success'; text: string } | null>(null);
  const [perf, setPerf] = useState<PerformanceData | null>(null);
  const [perfError, setPerfError] = useState<string | null>(null);
  const [loadingPerf, setLoadingPerf] = useState(true);

  const [entries, setEntries] = useState<CommissionEntry[] | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(false);

  useShellSlot({ subtitle: 'What the clinic did and earned, and what it still owes.' });

  const loadPerformance = useCallback(async () => {
    if (!organization) return;
    setLoadingPerf(true);
    setPerfError(null);
    try {
      const since = new Date(Date.now() - SINCE_DAYS * 86_400_000).toISOString();
      const [res, people] = await Promise.all([
        fetch(`/api/admin/performance?organizationId=${organization.id}&since=${encodeURIComponent(since)}`, {
          headers: await bearerHeaders(),
        }),
        fetchStaff(organization.id),
      ]);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `The report could not be loaded (${res.status}).`);
      }
      const data = await res.json();
      setPerf({
        completedTests: data?.completedTests ?? [],
        ledgerTransactions: data?.ledgerTransactions ?? [],
        externalCharges: data?.externalCharges ?? [],
        patientBilling: data?.patientBilling ?? [],
      });
      setStaff(people);
    } catch (err) {
      setPerfError(err instanceof Error ? err.message : 'The report could not be loaded.');
      setPerf(null);
    } finally {
      setLoadingPerf(false);
    }
  }, [organization]);

  useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  useEffect(() => {
    if (!selectedStaff) return;
    setCommissionType(selectedStaff.performance_commission_type ?? 'none');
    setCommissionValue(String(selectedStaff.performance_commission_value ?? 0));
    setCommissionMessage(null);
    // Re-opening a person resets the form; saving the same person must not
    // immediately clear the success message by re-running this initializer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaff?.id]);

  useEffect(() => {
    if (tab !== 'ageing' || entries !== null || !organization) return;
    setLoadingEntries(true);
    fetchCommissionReport(organization.id)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoadingEntries(false));
  }, [tab, entries, organization]);

  const handleExport = () => {
    if (!perf) return;
    const now = new Date();
    const filtered = filterByRange(perf, dateRange, now);
    printHtml(
      buildStaffAuditHtml({
        clinicName: orgName(organization),
        range: dateRange,
        totals: totalsFor(filtered),
        rows: sortStaff(searchStaff(staffRows(staff, filtered), searchQuery), sortField),
        now,
      }),
    );
  };

  const now = useMemo(() => new Date(), [entries]);
  const buckets = useMemo(() => (entries ? ageingBuckets(entries, now) : null), [entries, now]);
  const groups = useMemo(
    () => (entries ? groupByReferrer(entries.filter((e) => e.commissionStatus !== 'paid')) : []),
    [entries],
  );
  const owedTotal = buckets ? AGE_BUCKETS.reduce((s, b) => s + buckets[b].amount, 0) : 0;
  const selectedPerformance = useMemo(() => {
    if (!selectedStaff || !perf) return null;
    return staffRows([selectedStaff], filterByRange(perf, dateRange, new Date()))[0] ?? null;
  }, [selectedStaff, perf, dateRange]);

  const saveCommissionPlan = async () => {
    if (!selectedStaff) return;
    const value = commissionType === 'none' ? 0 : Number(commissionValue);
    if (!Number.isFinite(value) || value < 0 || (commissionType === 'percentage' && value > 100)) {
      setCommissionMessage({ tone: 'critical', text: commissionType === 'percentage' ? 'Enter a percentage from 0 to 100.' : 'Enter an amount of zero or more.' });
      return;
    }

    setSavingCommission(true);
    setCommissionMessage(null);
    try {
      const path = runtimeMode === 'local' ? '/api/staff/hub' : `${apiBase()}/api/staff/update`;
      const headers = runtimeMode === 'local'
        ? { 'Content-Type': 'application/json' }
        : await jsonAuthHeaders();
      const response = await fetch(path, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'update_performance_commission',
          staffId: selectedStaff.id,
          performanceCommissionType: commissionType,
          performanceCommissionValue: value,
          auditId: crypto.randomUUID(),
          actorId: profile?.id,
          actorName: profile?.full_name,
          entityLabel: selectedStaff.full_name,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'The commission plan could not be saved.');

      const changed = {
        ...selectedStaff,
        performance_commission_type: commissionType,
        performance_commission_value: value,
      };
      setStaff((people) => people.map((person) => person.id === changed.id ? changed : person));
      setSelectedStaff(changed);
      setCommissionMessage({
        tone: 'success',
        text: body?.queued ? 'Saved on this hub and queued for cloud sync.' : 'Commission plan saved.',
      });
    } catch (error) {
      setCommissionMessage({ tone: 'critical', text: error instanceof Error ? error.message : 'The commission plan could not be saved.' });
    } finally {
      setSavingCommission(false);
    }
  };

  return (
    <div className={styles['screen']}>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'performance' | 'ageing')}
        ariaLabel="Report"
        items={[
          { value: 'performance', label: 'Workload and revenue', icon: <RiLineChartLine size={16} /> },
          { value: 'ageing', label: 'Commission owed', icon: <RiHandCoinLine size={16} /> },
        ]}
      >
        <TabPanel value="performance">
          {perfError && (
            <Alert tone="critical" title="The report could not be loaded" live>
              {perfError}
              <Button intent="secondary" onClick={() => void loadPerformance()}>Retry</Button>
            </Alert>
          )}
          {!perfError && <StaffPerformance
            data={perf}
            loading={loadingPerf}
            staff={staff}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortField={sortField}
            onSortChange={setSortField}
            onExport={handleExport}
            onSelect={setSelectedStaff}
          />}
        </TabPanel>

        <TabPanel value="ageing">
          <div className={styles['ageing']}>
            <div className={styles['buckets']}>
              {AGE_BUCKETS.map((b) => (
                <Stat
                  key={b}
                  label={AGE_BUCKET_LABEL[b]}
                  value={buckets ? money(buckets[b].amount) : ''}
                  note={buckets ? `${buckets[b].count} referral${buckets[b].count === 1 ? '' : 's'}` : undefined}
                  tone={toneFor(b, buckets?.[b].amount ?? 0)}
                  loading={loadingEntries || buckets === null}
                  href={`/${slug}/admin/referrals/commissions?status=pending&age=${ageParam(b)}`}
                />
              ))}
            </div>

            <Card>
              <CardHeader
                title="Owed, by referrer"
                subtitle={buckets ? `${money(owedTotal)} outstanding in all` : undefined}
                actions={
                  <Link href={`/${slug}/admin/referrals/commissions?status=pending`} className={styles['link']}>
                    Pay out
                  </Link>
                }
              />
              <CardBody flush>
                {loadingEntries || entries === null ? (
                  <div className={styles['loading']}>
                    <SkeletonRows rows={5} columns={[3, 1, 1, 1]} />
                  </div>
                ) : (
                  <Table
                    caption="Referrers owed commission"
                    rows={groups}
                    rowKey={(g) => g.name}
                    empty={<EmptyState title="Nothing is owed" compact>Every commission has been settled.</EmptyState>}
                    columns={[
                      { key: 'name', header: 'Referrer', render: (g) => g.name },
                      {
                        key: 'type',
                        header: 'Type',
                        render: (g) => (
                          <Badge tone={g.type === 'doctor' ? 'accent' : 'info'}>
                            {g.type === 'doctor' ? 'Doctor' : 'Facility'}
                          </Badge>
                        ),
                      },
                      { key: 'n', header: 'Referrals', numeric: true, render: (g) => String(g.patients.length) },
                      {
                        key: 'oldest',
                        header: 'Oldest',
                        numeric: true,
                        render: (g) => {
                          const days = Math.max(
                            ...g.patients.map((p) => Math.floor((now.getTime() - new Date(p.registeredAt).getTime()) / 86_400_000)),
                          );
                          return `${days}d`;
                        },
                      },
                      { key: 'owed', header: 'Owed', numeric: true, render: (g) => money(g.outstanding) },
                    ]}
                  />
                )}
              </CardBody>
            </Card>
          </div>
        </TabPanel>
      </Tabs>
      <Dialog open={selectedStaff !== null} onOpenChange={(open) => { if (!open) setSelectedStaff(null); }} title={selectedStaff?.full_name || 'Staff details'} description={selectedStaff?.email || 'No email on file'}>
        {selectedStaff && <>
          <DescriptionList items={[
            { label: 'Role', value: selectedStaff.role || 'Not assigned' },
            { label: 'Signature', value: selectedStaff.signature_url ? 'On file' : 'Not uploaded' },
            { label: 'Investigations in this period', value: String(selectedPerformance?.testCount ?? 0) },
            { label: 'Revenue credited', value: money(selectedPerformance?.testRev ?? 0) },
            { label: 'Commission already earned', value: money(selectedPerformance?.bonusSum ?? 0) },
          ]} />
          <Alert tone="info" title="Performance commission">
            This plan applies to investigations completed after it is saved. Earned commission is recorded on each investigation and historical payouts are not recalculated. An individual plan overrides the catalogue-wide staff bonus for that work.
          </Alert>
          {commissionMessage && <Alert tone={commissionMessage.tone} live>{commissionMessage.text}</Alert>}
          <Field label="Commission plan">
            <Select value={commissionType} onChange={(event) => setCommissionType(event.target.value as PerformanceCommissionType)}>
              <option value="none">Use test catalogue bonus</option>
              <option value="percentage">Percentage of test revenue</option>
              <option value="flat">Flat amount per completed investigation</option>
            </Select>
          </Field>
          {commissionType !== 'none' && (
            <Field
              label={commissionType === 'percentage' ? 'Commission percentage' : 'Amount per investigation'}
              hint={commissionType === 'percentage' ? 'Between 0 and 100 percent.' : 'Amount in naira.'}
            >
              <Input
                type="number"
                min="0"
                max={commissionType === 'percentage' ? '100' : undefined}
                step="0.01"
                value={commissionValue}
                onChange={(event) => setCommissionValue(event.target.value)}
              />
            </Field>
          )}
          <Button intent="primary" loading={savingCommission} onClick={() => void saveCommissionPlan()}>
            Save commission plan
          </Button>
          <Link href={`/${slug}/admin/staff`} className={styles['link']}>Manage people</Link>
        </>}
      </Dialog>
    </div>
  );
}

const toneFor = (b: AgeBucket, amount: number): Tone =>
  amount <= 0 ? 'neutral' : 'neutral';

const ageParam = (b: AgeBucket) => (b === '0-30' ? 0 : b === '31-60' ? 31 : b === '61-90' ? 61 : 91);

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedReports() {
  return (
    <RequireRole allow={['admin']}>
      <Reports />
    </RequireRole>
  );
}
