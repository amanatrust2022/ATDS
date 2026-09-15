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
  completed_by_profile_id?: string | null;
  patient_created_at?: string | null;
  department?: string | null;
  price?: number | null;
  commission_amount?: number | null;
  commission_type?: string | null;
  commission_value?: number | null;
  average_cost?: number | null;
  staff_bonus_amount?: number | null;
  patient_total_amount?: number | null;
  patient_discount_amount?: number | null;
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
  discount_amount?: number | null;
  paid_amount?: number | null;
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
  performance_commission_type?: PerformanceCommissionType | null;
  performance_commission_value?: number | null;
}

export type PerformanceCommissionType = 'none' | 'percentage' | 'flat';

/**
 * The staff-specific incentive earned when one investigation is completed.
 * A configured staff plan overrides the catalogue default. With no staff plan,
 * the already-snapshotted catalogue bonus remains in force.
 */
export function performanceCommissionForTest(
  price: number,
  type: PerformanceCommissionType | null | undefined,
  value: number | null | undefined,
  catalogueFallback = 0,
): number {
  const safePrice = Math.max(Number(price) || 0, 0);
  const safeValue = Math.max(Number(value) || 0, 0);
  if (type === 'percentage') return safePrice * Math.min(safeValue, 100) / 100;
  if (type === 'flat') return safeValue;
  return Math.max(Number(catalogueFallback) || 0, 0);
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

  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (range !== 'today') from.setDate(from.getDate() - (range === '7days' ? 6 : 29));
  return date >= from && date <= now;
}

/**
 * What one test earned whoever referred or performed it.
 *
 * A stored `commission_amount` wins over recomputing from type and value, so a
 * commission agreed at the time is not silently restated by a later change to
 * the price list.
 */
export function commissionOf(t: CompletedTest): number {
  if (t.commission_amount != null && Number.isFinite(Number(t.commission_amount))) {
    return Math.max(Number(t.commission_amount), 0);
  }
  if (t.commission_type === 'percentage') {
    return ((t.price || 0) * (t.commission_value || 0)) / 100;
  }
  // The price list writes 'flat'; older rows say 'fixed'. Both are a sum.
  if (t.commission_type === 'flat' || t.commission_type === 'fixed') return t.commission_value || 0;
  return 0;
}

/** Visit discounts are allocated pro-rata to priced test lines. */
export function discountOf(t: CompletedTest): number {
  const total = t.patient_total_amount || 0;
  if (total <= 0) return 0;
  return (t.price || 0) * (t.patient_discount_amount || 0) / total;
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
export function matchesStaff(
  completedBy: string | null | undefined,
  member: StaffMember,
  completedByProfileId?: string | null,
): boolean {
  // New records carry an immutable profile id. When present it is authoritative:
  // two colleagues with the same first name must never both earn the same work.
  if (completedByProfileId) return completedByProfileId === member.id;
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
  totalDiscounts: number;
  totalAverageCost: number;
  totalStaffBonuses: number;
  grossProfit: number;
  netProfit: number;
}

export function totalsFor(f: FilteredData): Totals {
  const totalBilledNet = f.billing.reduce((sum, p) => sum + (p.net_amount ?? p.total_amount ?? 0), 0);
  const ledgerCollections = f.ledger
    .filter((t) => t.type === 'deposit')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const externalCollections = f.charges.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalReceptionCollections = ledgerCollections + externalCollections;
  const patientCollections = f.billing.reduce((sum, p) => {
    const billed = Math.max(p.net_amount ?? p.total_amount ?? 0, 0);
    return sum + Math.min(Math.max(p.paid_amount ?? 0, 0), billed);
  }, 0);
  const outstandingReceivables = f.billing.reduce((sum, p) => {
    const billed = Math.max(p.net_amount ?? p.total_amount ?? 0, 0);
    return sum + Math.max(billed - Math.max(p.paid_amount ?? 0, 0), 0);
  }, 0);
  const totalDiscounts = f.tests.reduce((sum, t) => sum + discountOf(t), 0);
  const totalAverageCost = f.tests.reduce((sum, t) => sum + (t.average_cost || 0), 0);
  const totalStaffBonuses = f.tests.reduce((sum, t) => sum + (t.staff_bonus_amount || 0), 0);
  const totalCommissions = f.tests.reduce((sum, t) => sum + commissionOf(t), 0);
  const totalClinicalRevenue = f.tests.reduce((sum, t) => sum + (t.price || 0), 0);
  const grossProfit = totalClinicalRevenue - totalDiscounts - totalAverageCost;

  return {
    totalTestsCount: f.tests.length,
    totalClinicalRevenue,
    totalCommissions,
    avgTAT: averageTat(f.tests),
    totalBilledNet,
    totalReceptionCollections,
    // Capped at 100: an overpayment or a deposit against an earlier visit
    // should not read as "112% collected".
    collectionRate: totalBilledNet > 0 ? (patientCollections / totalBilledNet) * 100 : 100,
    outstandingReceivables,
    totalDiscounts,
    totalAverageCost,
    totalStaffBonuses,
    grossProfit,
    netProfit: grossProfit - totalCommissions - totalStaffBonuses,
  };
}

export interface StaffRow {
  member: StaffMember;
  testCount: number;
  testRev: number;
  commissionSum: number;
  bonusSum: number;
  receiptCount: number;
  collectionSum: number;
  avgTat: number;
}

export function staffRows(staff: StaffMember[], f: FilteredData): StaffRow[] {
  return staff.map((member) => {
    const staffTests = f.tests.filter((t) => matchesStaff(t.completed_by, member, t.completed_by_profile_id));
    const ledgerTx = f.ledger.filter((t) => matchesStaff(t.created_by, member));
    const extTx = f.charges.filter((c) => matchesStaff(c.created_by, member));
    const deposits = ledgerTx.filter((t) => t.type === 'deposit');

    return {
      member,
      testCount: staffTests.length,
      testRev: staffTests.reduce((sum, t) => sum + (t.price || 0), 0),
      commissionSum: staffTests.reduce((sum, t) => sum + commissionOf(t), 0),
      bonusSum: staffTests.reduce((sum, t) => sum + (t.staff_bonus_amount || 0), 0),
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
  if (field === 'commission') return sorted.sort((a, b) => b.bonusSum - a.bonusSum);
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
  type Bucket = TrendPoint & { start: number; end: number };
  const days: Bucket[] = [];
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);

  if (range === 'all') {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      days.push({
        dateLabel: start.toLocaleString('en-US', { month: 'short' }),
        count: 0,
        rev: 0,
        start: start.getTime(),
        end: end.getTime(),
      });
    }
  } else {
    const bucketDays = range === '30days' ? 2 : 1;
    const bucketCount = range === 'today' ? 1 : range === '7days' ? 7 : 15;
    const first = new Date(midnight);
    first.setDate(first.getDate() - (bucketCount * bucketDays - 1));
    for (let i = 0; i < bucketCount; i++) {
      const start = new Date(first);
      start.setDate(first.getDate() + i * bucketDays);
      const end = new Date(start);
      end.setDate(start.getDate() + bucketDays);
      const last = new Date(end);
      last.setDate(last.getDate() - 1);
      days.push({
        dateLabel: bucketDays === 1
          ? start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
          : `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}â€“${last.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`,
        count: 0,
        rev: 0,
        start: start.getTime(),
        end: end.getTime(),
      });
    }
  }

  for (const t of tests) {
    if (!t.completed_at) continue;
    const testDate = new Date(t.completed_at);
    if (Number.isNaN(testDate.getTime())) continue;

    const bucket = days.find((day) => testDate.getTime() >= day.start && testDate.getTime() < day.end);
    if (bucket) {
      bucket.count += 1;
      bucket.rev += t.price || 0;
    }
  }

  return days.map(({ dateLabel, count, rev }) => ({ dateLabel, count, rev }));
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
  all: 'Past Year',
};
