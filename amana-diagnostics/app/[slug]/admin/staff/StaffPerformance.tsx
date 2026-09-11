'use client';

import {
  RiAwardLine,
  RiBarChart2Line,
  RiCheckDoubleLine,
  RiCoinsLine,
  RiFileList3Line,
  RiPrinterLine,
  RiTimeLine,
} from '@remixicon/react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LoadingPanel,
  SegmentedControl,
  Select,
  Table,
} from '@/components/ui';
import {
  chartGeometry,
  departmentStats,
  filterByRange,
  formatTAT,
  searchStaff,
  sortStaff,
  staffRows,
  totalsFor,
  trendSeries,
  type DateRange,
  type PerformanceData,
  type SortField,
  type StaffRow,
} from '@/lib/staffPerformance';
import { avatarHue, initialsOf, roleInfo } from '@/lib/staffRoles';

import styles from './performance.module.css';

/** Money, the way this product writes it everywhere else. */
const naira = (n: number) => `₦${(n || 0).toLocaleString('en-NG')}`;

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: '7 days' },
  { value: '30days', label: '30 days' },
  { value: 'all', label: 'All time' },
];

/**
 * What the team got through, and what it earned.
 *
 * The arithmetic is lib/staffPerformance.ts; this only arranges it. The two
 * were one 750-line expression inside the staff screen's render until the
 * figures were pulled out and tested.
 */
export function StaffPerformance({
  data,
  loading,
  staff,
  dateRange,
  onDateRangeChange,
  searchQuery,
  onSearchChange,
  sortField,
  onSortChange,
  onExport,
  onSelect,
}: {
  data: PerformanceData | null;
  loading: boolean;
  staff: any[];
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortField: SortField;
  onSortChange: (f: SortField) => void;
  onExport: () => void;
  onSelect: (member: any) => void;
}) {
  if (loading) {
    return <LoadingPanel label="Working out who did what…" />;
  }

  if (!data) {
    return (
      <EmptyState title="No figures to show">
        The performance data could not be loaded. Reload the page to try again.
      </EmptyState>
    );
  }

  const now = new Date();
  const filtered = filterByRange(data, dateRange, now);
  const totals = totalsFor(filtered);
  const rows = sortStaff(searchStaff(staffRows(staff, filtered), searchQuery), sortField);
  const depts = departmentStats(filtered.tests);
  const trend = trendSeries(filtered.tests, dateRange, now);
  const geo = chartGeometry(trend);

  return (
    <div className={styles['page']}>
      <Card>
        <CardBody>
          <div className={styles['toolbar']}>
            <div>
              <p className={styles['eyebrow']}>Auditing</p>
              <h2 className={styles['title']}>Workload and ledger</h2>
            </div>
            <div className={styles['toolbarControls']}>
              <SegmentedControl
                value={dateRange}
                onValueChange={onDateRangeChange}
                options={RANGE_OPTIONS}
                ariaLabel="Period to report on"
              />
              <Button icon={<RiPrinterLine size={15} />} onClick={onExport}>
                Print the audit
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className={styles['kpis']}>
        <Kpi
          label="Tests signed off"
          value={String(totals.totalTestsCount)}
          note="Completed and released in this period"
          icon={<RiFileList3Line size={18} />}
          tone="success"
        />
        <Kpi
          label="Clinical revenue"
          value={naira(totals.totalClinicalRevenue)}
          note={`Commissions: ${naira(totals.totalCommissions)}`}
          icon={<RiCoinsLine size={18} />}
          tone="info"
        />
        <Kpi
          label="Turnaround"
          value={totals.avgTAT > 0 ? formatTAT(totals.avgTAT) : '—'}
          note="Average, arrival to signature"
          icon={<RiTimeLine size={18} />}
          tone="accent"
        />
        <Kpi
          label="Collected"
          value={`${totals.collectionRate.toFixed(1)}%`}
          note={`Still owed: ${naira(totals.outstandingReceivables)}`}
          icon={<RiCoinsLine size={18} />}
          tone={totals.outstandingReceivables > 0 ? 'warning' : 'success'}
        />
      </div>

      <Card>
        <CardHeader
          title="Revenue over time"
          subtitle="Billed value of tests signed off, by day"
        />
        <CardBody>
          {trend.length > 1 ? (
            <div className={styles['chart']}>
              <svg
                viewBox={`0 0 ${geo.width} ${geo.height}`}
                className={styles['chartSvg']}
                role="img"
                aria-label={`Revenue from ${trend[0]?.dateLabel} to ${trend[trend.length - 1]?.dateLabel}, peaking at ${naira(geo.maxRev)}`}
              >
                <defs>
                  <linearGradient id="staffChartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" className={styles['fillTop']} />
                    <stop offset="100%" className={styles['fillBottom']} />
                  </linearGradient>
                </defs>

                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                  const y = geo.paddingTop + ratio * geo.chartHeight;
                  const labelVal = Math.round(geo.maxRev - ratio * geo.maxRev);
                  return (
                    <g key={i}>
                      <line
                        x1={geo.paddingLeft}
                        y1={y}
                        x2={geo.width - geo.paddingRight}
                        y2={y}
                        className={styles['gridLine']}
                        strokeDasharray="4 4"
                      />
                      <text
                        x={geo.paddingLeft - 10}
                        y={y + 4}
                        textAnchor="end"
                        className={styles['axisLabel']}
                      >
                        ₦{labelVal >= 1000 ? `${Math.round(labelVal / 1000)}k` : labelVal}
                      </text>
                    </g>
                  );
                })}

                <path d={geo.areaPath} fill="url(#staffChartFill)" />
                <path d={geo.linePath} className={styles['trendLine']} />

                {geo.points.map((p, idx) => (
                  <g key={idx}>
                    <circle cx={p.x} cy={p.y} r="4" className={styles['node']} />
                    <text
                      x={p.x}
                      y={geo.height - 5}
                      textAnchor="middle"
                      className={styles['axisLabel']}
                    >
                      {p.label}
                    </text>
                    <title>{`${p.label}: ${naira(p.val)}`}</title>
                  </g>
                ))}
              </svg>
            </div>
          ) : (
            <EmptyState title="Not enough history" compact>
              Pick a longer period to see a trend.
            </EmptyState>
          )}
        </CardBody>
      </Card>

      <div className={styles['split']}>
        <Card>
          <CardHeader
            title={
              <span className={styles['cardTitle']}>
                <RiAwardLine size={18} aria-hidden="true" /> Who did what
              </span>
            }
            actions={
              <div className={styles['leaderControls']}>
                <Field label="Search staff" labelHidden>
                  <Input
                    type="search"
                    placeholder="Search staff…"
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                  />
                </Field>
                <Field label="Order by" labelHidden>
                  <Select
                    value={sortField}
                    aria-label="Order the list by"
                    onChange={(e) => onSortChange(e.target.value as SortField)}
                  >
                    <option value="revenue">Most revenue</option>
                    <option value="volume">Most work</option>
                    <option value="tat">Fastest turnaround</option>
                    <option value="commission">Most commission</option>
                  </Select>
                </Field>
              </div>
            }
          />
          <CardBody flush>
            <Table
              caption="Staff ranked by the chosen measure"
              rows={rows}
              rowKey={(r) => String(r.member.id)}
              onRowClick={(r) => onSelect(r.member)}
              empty={
                <EmptyState title="Nobody matches that" compact>
                  Clear the search to see everyone.
                </EmptyState>
              }
              columns={[
                {
                  key: 'rank',
                  header: '#',
                  render: (_r: StaffRow, i: number) => (
                    <span className={i === 0 ? styles['rankTop'] : styles['rank']}>{i + 1}</span>
                  ),
                },
                {
                  key: 'person',
                  header: 'Staff member',
                  render: (r: StaffRow) => (
                    <span className={styles['person']}>
                      <span
                        className={styles['avatar']}
                        style={{ ['--avatar-hue' as string]: avatarHue(r.member.full_name) }}
                        aria-hidden="true"
                      >
                        {initialsOf(r.member.full_name)}
                      </span>
                      {r.member.full_name || 'Not set up yet'}
                    </span>
                  ),
                },
                {
                  key: 'role',
                  header: 'Role',
                  render: (r: StaffRow) => (
                    <Badge tone={roleInfo(r.member.role).tone}>
                      {roleInfo(r.member.role).label}
                    </Badge>
                  ),
                },
                {
                  key: 'volume',
                  header: 'Work',
                  numeric: true,
                  render: (r: StaffRow) =>
                    r.member.role === 'reception'
                      ? `${r.receiptCount} receipts`
                      : `${r.testCount} tests`,
                },
                {
                  key: 'revenue',
                  header: 'Revenue',
                  numeric: true,
                  render: (r: StaffRow) =>
                    naira(r.member.role === 'reception' ? r.collectionSum : r.testRev),
                },
                {
                  key: 'commission',
                  header: 'Commission',
                  numeric: true,
                  render: (r: StaffRow) => naira(r.commissionSum),
                },
                {
                  key: 'tat',
                  header: 'Turnaround',
                  numeric: true,
                  // Reception never signs a report, so there is no arrival-to-
                  // signature time to show. A dash, not a zero.
                  render: (r: StaffRow) =>
                    r.member.role === 'reception' ? '—' : formatTAT(r.avgTat),
                },
              ]}
            />
          </CardBody>
        </Card>

        <div className={styles['side']}>
          <Card>
            <CardHeader
              title={
                <span className={styles['cardTitle']}>
                  <RiBarChart2Line size={18} aria-hidden="true" /> Where the money came from
                </span>
              }
            />
            <CardBody>
              {Object.keys(depts).length === 0 ? (
                <EmptyState title="Nothing billed in this period" compact />
              ) : (
                <ul className={styles['depts']}>
                  {Object.entries(depts).map(([dept, stats]) => {
                    const percent =
                      totals.totalClinicalRevenue > 0
                        ? (stats.rev / totals.totalClinicalRevenue) * 100
                        : 0;
                    return (
                      <li key={dept} className={styles['dept']}>
                        <div className={styles['deptHead']}>
                          <span className={styles['deptName']}>
                            {dept} · {stats.count} test{stats.count === 1 ? '' : 's'}
                          </span>
                          <span className={styles['deptValue']}>
                            {naira(stats.rev)} ({percent.toFixed(0)}%)
                          </span>
                        </div>
                        {/* A meter, not a decorative bar: a screen reader gets
                          * the same figure the sighted reader gets. */}
                        <div
                          className={styles['bar']}
                          role="meter"
                          aria-valuenow={Math.round(percent)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${dept} share of revenue`}
                        >
                          <span
                            className={styles['barFill']}
                            data-dept={dept}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className={styles['cardTitle']}>
                  <RiTimeLine size={18} aria-hidden="true" /> Latest completions
                </span>
              }
            />
            <CardBody>
              {filtered.tests.length === 0 ? (
                <EmptyState title="Nothing completed in this period" compact />
              ) : (
                <ul className={styles['log']}>
                  {filtered.tests.slice(0, 4).map((t, idx) => (
                    <li key={idx} className={styles['logItem']}>
                      <span className={styles['logMark']} aria-hidden="true">
                        <RiCheckDoubleLine size={14} />
                      </span>
                      <span className={styles['logText']}>
                        <span className={styles['logTitle']}>{t.test_name || 'Test'}</span>
                        <span className={styles['logMeta']}>
                          {t.completed_by || 'Unattributed'} · {naira(t.price || 0)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: 'success' | 'info' | 'accent' | 'warning';
}) {
  return (
    <Card as="div" className={styles['kpi']}>
      <CardBody>
        <div className={styles['kpiHead']}>
          <span className={styles['kpiLabel']}>{label}</span>
          <span className={styles['kpiIcon']} data-tone={tone} aria-hidden="true">
            {icon}
          </span>
        </div>
        <p className={styles['kpiValue']}>{value}</p>
        <p className={styles['kpiNote']}>{note}</p>
      </CardBody>
    </Card>
  );
}
