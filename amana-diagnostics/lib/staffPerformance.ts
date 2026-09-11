/**
 * The staff performance dashboard's arithmetic.
 *
 * All of this used to live inside a JSX expression: an IIFE roughly 750 lines
 * long, opened in the middle of the staff screen's render and closed just
 * before the profile modal. Nothing in it could be reached from a test, and a
 * number that came out wrong — a commission, a turnaround time, a collection
 * rate — could only be found by reading it.
 *
 * It is moved here unchanged in behaviour. Where a comment below says a rule
 * looks odd, the rule is still the one the screen has always used; the comment
 * marks it rather than fixes it, because these figures are what an
 * administrator has been paying people against.
 */

export type DateRange = 'today' | '7days' | '30days' | 'all';
export type SortField = 'revenue' | 'volume' | 'tat' | 'commission';

export interface CompletedTest {
  /** What the bench called it. Shown in the recent-activity list. */
  test_name?: string | null;
  completed_at?: string | null;
  completed_by?: string | null;
  patient_created_at?: string | null;
  department?: string | null;
  price?: number | null;
  commission_amount?: number | null;
  commission_type?: string | null;
  commission_value?: number | null;
}

export interface LedgerTransaction {
  created_at?: string | null;
  created_by?: string | null;
  type?: string | null;
  amount?: number | null;
}

export interface ExternalCharge {
  created_at?: string | null;
  created_by?: string | null;
  amount?: number | null;
}

export interface PatientBilling {
  created_at?: string | null;
  net_amount?: number | null;
  total_amount?: number | null;
}

export interface PerformanceData {
  completedTests: CompletedTest[];
  ledgerTransactions: LedgerTransaction[];
  externalCharges: ExternalCharge[];
  patientBilling: PatientBilling[];
}

export interface StaffMember {
  id?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  surname?: string | null;
  role?: string | null;
}

/** The empty shape, so a missing or partial API response cannot throw. */
export const EMPTY_PERFORMANCE: PerformanceData = {
  completedTests: [],
  ledgerTransactions: [],
  externalCharges: [],
  patientBilling: [],
};

/* ========================================================================
 * Small rules
 * ==================================================================== */

/** Minutes as something a person reads: `45m`, `3h`, `3h 20m`. */
export function formatTAT(mins: number): string {
  if (!mins || mins <= 0) return '—';
  if (mins < 60) return `${Math.round(mins)}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = Math.round(mins % 60);
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

/**
 * Whether a timestamp falls inside the selected range.
 *
 * `now` is a parameter rather than a call to `new Date()` so the boundaries
 * are testable. The ranges are counted back from the moment the dashboard is
 * looked at, not from midnight — '7days' means the last seven times twenty-four
 * hours. That is what it has always done.
 */
export function withinRange(dateStr: string | null | undefined, range: DateRange, now: Date = new Date()): boolean {
  if (!dateStr) return false;
  if (range === 'all') return true;

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;

  if (range === 'today') return date.toDateString() === now.toDateString();

  const days = range === '7days' ? 7 : 30;
  const from = new Date(now);
  from.setDate(now.getDate() - days);
  return date >= from;
}

/**
 * What one test earned whoever referred or performed it.
 *
 * A stored `commission_amount` wins over recomputing from type and value, so a
 * commission agreed at the time is not silently restated by a later change to
 * the price list.
 */
export function commissionOf(t: CompletedTest): number {
  if (t.commission_amount) return t.commission_amount;
  if (t.commission_type === 'percentage') {
    return ((t.price || 0) * (t.commission_value || 0)) / 100;
  }
  if (t.commission_type === 'fixed') return t.commission_value || 0;
  return 0;
}

/**
 * Minutes from the patient being registered to the test being signed off.
 *
 * Null when either end is missing, and — deliberately — when the difference is
 * negative or zero, which happens with back-dated entries. Those are dropped
 * rather than counted as instant, which would flatter the average.
 */
export function tatMinutes(t: CompletedTest): number | null {
  if (!t.completed_at || !t.patient_created_at) return null;
  const diff = (new Date(t.completed_at).getTime() - new Date(t.patient_created_at).getTime()) / 60000;
  return diff > 0 ? diff : null;
}

export function averageTat(tests: CompletedTest[]): number {
  const diffs = tests.map(tatMinutes).filter((d): d is number => d !== null);
  if (diffs.length === 0) return 0;
  return diffs.reduce((s, v) => s + v, 0) / diffs.length;
}

/**
 * Whether a free-text "completed by" names this staff member.
 *
 * The field holds whatever the bench typed, so this matches the full name, the
 * id, or a surname or first name appearing anywhere in the string. It is loose
 * on purpose — a missed match silently costs someone credit for their work —
 * and the looseness is why two people sharing a first name can both be
 * credited with one test. That is a known limitation of the data, not of this
 * function.
 */
export function matchesStaff(completedBy: string | null | undefined, member: StaffMember): boolean {
  if (!completedBy) return false;
  const cb = completedBy.toLowerCase().trim();
  const fn = (member.full_name || '').toLowerCase().trim();
  const id = (member.id || '').toLowerCase().trim();
  const sn = (member.surname || '').toLowerCase().trim();
  const first = (member.first_name || '').toLowerCase().trim();

  return (
    cb === fn ||
    cb === id ||
    (!!sn && cb.includes(sn)) ||
    (!!first && cb.includes(first)) ||
    // The other direction too: the bench typed "Bala" and the roster says
    // "Bala Yusuf". Safe against an empty full name, because an empty
    // `completedBy` has already returned above.
    (!!fn && fn.includes(cb))
  );
}

/* ========================================================================
 * The dashboard
 * ==================================================================== */

export interface FilteredData {
  tests: CompletedTest[];
  ledger: LedgerTransaction[];
  charges: ExternalCharge[];
  billing: PatientBilling[];
}

export function filterByRange(data: PerformanceData, range: DateRange, now: Date = new Date()): FilteredData {
  return {
    tests: data.completedTests.filter((t) => withinRange(t.completed_at, range, now)),
    ledger: data.ledgerTransactions.filter((t) => withinRange(t.created_at, range, now)),
    charges: data.externalCharges.filter((c) => withinRange(c.created_at, range, now)),
    billing: data.patientBilling.filter((p) => withinRange(p.created_at, range, now)),
  };
}

export interface Totals {
  totalTestsCount: number;
  totalClinicalRevenue: number;
  totalCommissions: number;
  avgTAT: number;
  totalBilledNet: number;
  totalReceptionCollections: number;
  collectionRate: number;
  outstandingReceivables: number;
}

export function totalsFor(f: FilteredData): Totals {
  const totalBilledNet = f.billing.reduce((sum, p) => sum + (p.net_amount || p.total_amount || 0), 0);
  const ledgerCollections = f.ledger
    .filter((t) => t.type === 'deposit')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const externalCollections = f.charges.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalReceptionCollections = ledgerCollections + externalCollections;

  return {
    totalTestsCount: f.tests.length,
    totalClinicalRevenue: f.tests.reduce((sum, t) => sum + (t.price || 0), 0),
    totalCommissions: f.tests.reduce((sum, t) => sum + commissionOf(t), 0),
    avgTAT: averageTat(f.tests),
    totalBilledNet,
    totalReceptionCollections,
    // Capped at 100: an overpayment or a deposit against an earlier visit
    // should not read as "112% collected".
    collectionRate: totalBilledNet > 0 ? Math.min((totalReceptionCollections / totalBilledNet) * 100, 100) : 100,
    outstandingReceivables: Math.max(totalBilledNet - totalReceptionCollections, 0),
  };
}

export interface StaffRow {
  member: StaffMember;
  testCount: number;
  testRev: number;
  commissionSum: number;
  receiptCount: number;
  collectionSum: number;
  avgTat: number;
}

export function staffRows(staff: StaffMember[], f: FilteredData): StaffRow[] {
  return staff.map((member) => {
    const staffTests = f.tests.filter((t) => matchesStaff(t.completed_by, member));
    const ledgerTx = f.ledger.filter((t) => matchesStaff(t.created_by, member));
    const extTx = f.charges.filter((c) => matchesStaff(c.created_by, member));
    const deposits = ledgerTx.filter((t) => t.type === 'deposit');

    return {
      member,
      testCount: staffTests.length,
      testRev: staffTests.reduce((sum, t) => sum + (t.price || 0), 0),
      commissionSum: staffTests.reduce((sum, t) => sum + commissionOf(t), 0),
      receiptCount: deposits.length + extTx.length,
      collectionSum:
        deposits.reduce((sum, t) => sum + (t.amount || 0), 0) +
        extTx.reduce((sum, c) => sum + (c.amount || 0), 0),
      avgTat: averageTat(staffTests),
    };
  });
}

/** Reception is measured on money taken and receipts written, not on tests. */
export function volumeOf(row: StaffRow): number {
  return row.member.role === 'reception' ? row.receiptCount : row.testCount;
}

export function revenueOf(row: StaffRow): number {
  return row.member.role === 'reception' ? row.collectionSum : row.testRev;
}

export function searchStaff(rows: StaffRow[], query: string): StaffRow[] {
  const q = query.toLowerCase();
  return rows.filter(
    (p) =>
      (p.member.full_name || '').toLowerCase().includes(q) ||
      (p.member.role || '').toLowerCase().includes(q),
  );
}

export function sortStaff(rows: StaffRow[], field: SortField): StaffRow[] {
  const sorted = [...rows];
  if (field === 'volume') return sorted.sort((a, b) => volumeOf(b) - volumeOf(a));
  if (field === 'commission') return sorted.sort((a, b) => b.commissionSum - a.commissionSum);
  if (field === 'tat') {
    // Faster is better, so this one ascends — and anyone with no measurable
    // turnaround sorts to the end rather than to the top.
    return sorted.sort((a, b) => (a.avgTat || 999999) - (b.avgTat || 999999));
  }
  return sorted.sort((a, b) => revenueOf(b) - revenueOf(a));
}

export function departmentStats(tests: CompletedTest[]): Record<string, { count: number; rev: number }> {
  const stats: Record<string, { count: number; rev: number }> = {};
  for (const t of tests) {
    const dept = t.department || 'Other';
    if (!stats[dept]) stats[dept] = { count: 0, rev: 0 };
    stats[dept]!.count += 1;
    stats[dept]!.rev += t.price || 0;
  }
  return stats;
}

/* ========================================================================
 * The trend chart
 * ==================================================================== */

export interface TrendPoint {
  dateLabel: string;
  count: number;
  rev: number;
}

/**
 * One bucket per day, or per month for 'all'.
 *
 * Buckets are matched by their formatted label rather than by date, which is
 * how this has always worked. It has a consequence worth knowing: over 'all',
 * where buckets are month names, a test from the same month two years ago
 * lands in this year's bucket. The 30-day view is capped at 15 buckets for the
 * same reason the chart is 580px wide — it is what fits.
 */
export function trendSeries(tests: CompletedTest[], range: DateRange, now: Date = new Date()): TrendPoint[] {
  const days: TrendPoint[] = [];
  const buckets = range === 'today' ? 1 : range === '7days' ? 7 : range === '30days' ? 15 : 12;

  for (let i = buckets - 1; i >= 0; i--) {
    const d = new Date(now);
    if (range === 'all') {
      d.setMonth(now.getMonth() - i);
      days.push({ dateLabel: d.toLocaleString('en-US', { month: 'short' }), count: 0, rev: 0 });
    } else {
      d.setDate(now.getDate() - i);
      days.push({
        dateLabel: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        count: 0,
        rev: 0,
      });
    }
  }

  for (const t of tests) {
    if (!t.completed_at) continue;
    const testDate = new Date(t.completed_at);
    if (Number.isNaN(testDate.getTime())) continue;

    const label =
      range === 'all'
        ? testDate.toLocaleString('en-US', { month: 'short' })
        : testDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

    for (const day of days) {
      if (day.dateLabel === label) {
        day.count += 1;
        day.rev += t.price || 0;
      }
    }
  }

  return days;
}

export interface ChartGeometry {
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  chartWidth: number;
  chartHeight: number;
  maxRev: number;
  points: { x: number; y: number; val: number; label: string }[];
  linePath: string;
  areaPath: string;
}

/**
 * Where the area chart's marks go.
 *
 * The scale floors at 1,000 so a quiet week does not draw a flat line at the
 * very top of the chart, which is what an auto-scaled axis would do and which
 * reads as a busy one.
 */
export function chartGeometry(trend: TrendPoint[]): ChartGeometry {
  const width = 580;
  const height = 130;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 10;
  const paddingBottom = 25;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxRev = Math.max(...trend.map((d) => d.rev), 1000);

  const points = trend.map((d, idx) => ({
    x: paddingLeft + (idx / (trend.length - 1 || 1)) * chartWidth,
    y: paddingTop + chartHeight - (d.rev / maxRev) * chartHeight,
    val: d.rev,
    label: d.dateLabel,
  }));

  const linePath = points.length > 0 ? `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')}` : '';
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1]!.x} ${paddingTop + chartHeight} L ${points[0]!.x} ${paddingTop + chartHeight} Z`
      : '';

  return {
    width,
    height,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    chartWidth,
    chartHeight,
    maxRev,
    points,
    linePath,
    areaPath,
  };
}

export const RANGE_LABEL: Record<DateRange, string> = {
  today: 'Today',
  '7days': 'Last 7 Days',
  '30days': 'Last 30 Days',
  all: 'All Time',
};
