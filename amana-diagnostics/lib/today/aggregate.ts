import type { StatDelta } from '@/components/ui/Stat';
import type { SyncState } from '@/lib/sync/engine';
import {
  chartGeometry,
  departmentStats,
  matchesStaff,
  tatMinutes,
  trendSeries,
  type ChartGeometry,
  type CompletedTest,
  type TrendPoint,
} from '@/lib/staffPerformance';

import {
  COMPARISON_LABEL,
  currentRange,
  dailyBuckets,
  delta,
  inRange,
  priorRange,
  type Period,
  type Range,
} from './period';
import type { TodayPayload, TodayTest, TodayVisit } from './types';

/**
 * The dashboard's figures, from the rows the route returns.
 *
 * Everything here is arithmetic over arrays, with `now` injected, so the
 * whole control tower is testable without a browser. The screen only
 * arranges what this returns.
 */

export interface Figure {
  value: number;
  delta: StatDelta;
  /** The last fourteen days, oldest first. */
  spark: number[];
}

export interface MoneyRow {
  billed: Figure;
  collected: Figure;
  outstanding: Figure & { thisPeriodCount: number; thisPeriodAmount: number };
  commission: Figure;
}

export interface Throughput {
  visits: Figure;
  completed: Figure;
  waitingNow: number;
  avgTatMinutes: number | null;
  avgTatDelta: StatDelta;
  longestWait: { minutes: number; test: TodayTest } | null;
}

export interface FloorCard {
  department: 'reception' | 'lab' | 'radiology';
  label: string;
  waiting: number;
  inProgress: number;
  doneInPeriod: number;
  oldestWaitMinutes: number | null;
  href: string;
}

export type ExceptionKind =
  | 'sync'
  | 'critical'
  | 'long_wait'
  | 'unpaid'
  | 'commission_aged'
  | 'unpriced_test'
  | 'no_signature'
  | 'invite_expiring';

export interface Exception {
  key: string;
  kind: ExceptionKind;
  /** 3 needs someone now; 0 is housekeeping. */
  severity: 0 | 1 | 2 | 3;
  title: string;
  detail: string;
  href: string;
  /** Something that can be done from the row itself. */
  action?: { label: string; kind: 'run_sync' };
  /** For ordering within a severity: older first. */
  ageMinutes: number;
}

export interface ReferrerRow {
  id: string | null;
  name: string;
  kind: 'doctor' | 'facility' | 'unknown';
  visits: number;
  billed: number;
  owed: number;
}

export interface StaffActivityRow {
  id: string;
  name: string;
  completed: number;
  departments: string[];
}

export interface TodayModel {
  period: Period;
  range: Range;
  money: MoneyRow;
  throughput: Throughput;
  floor: FloorCard[];
  exceptions: Exception[];
  trend: TrendPoint[];
  chart: ChartGeometry;
  deptShare: Record<string, { count: number; rev: number }>;
  topReferrers: ReferrerRow[];
  topStaff: StaffActivityRow[];
  truncated: TodayPayload['truncated'];
}

export interface BuildOptions {
  period: Period;
  now: Date;
  slug: string;
  sync: SyncState | null;
  /** A test waiting longer than this is flagged. The bench's own threshold. */
  longWaitMinutes?: number;
  /** A commission owed longer than this is flagged. */
  agedCommissionDays?: number;
  /** An invitation expiring sooner than this is flagged. */
  inviteHours?: number;
  /** How long a hub may be offline before that is itself an exception. */
  offlineMinutes?: number;
}

const SPARK_DAYS = 14;
/** How many individual long waits the inbox lists before rolling the rest up. */
const LONG_WAIT_ROWS = 8;
const MINUTE = 60_000;
const DAY_MS = 86_400_000;

export function buildToday(payload: TodayPayload, opts: BuildOptions): TodayModel {
  const {
    period,
    now,
    slug,
    sync,
    longWaitMinutes = 90,
    agedCommissionDays = 30,
    inviteHours = 48,
    offlineMinutes = 10,
  } = opts;

  const range = currentRange(period, now);
  const prior = priorRange(period, now);
  const cmp = COMPARISON_LABEL[period];

  const visitsIn = (r: Range) => payload.visits.filter((v) => inRange(v.registered_at, r));
  const completedIn = (r: Range) =>
    payload.tests.filter((t) => t.status === 'completed' && inRange(t.completed_at, r));

  const nowVisits = visitsIn(range);
  const priorVisits = visitsIn(prior);
  const nowCompleted = completedIn(range);
  const priorCompleted = completedIn(prior);

  /* --- Money --------------------------------------------------------- */

  const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + (f(r) || 0), 0);

  const billedOf = (rows: TodayVisit[]) => sum(rows, (v) => v.net_amount);
  const collectedOf = (r: Range) =>
    sum(visitsIn(r), (v) => v.paid_amount) +
    sum(payload.ledger.filter((l) => l.type === 'deposit' && inRange(l.created_at, r)), (l) => l.amount) +
    sum(payload.charges.filter((c) => inRange(c.created_at, r)), (c) => c.amount);
  const commissionOf = (rows: TodayVisit[]) =>
    sum(rows.filter((v) => v.commission_assigned), (v) => v.commission_amount);

  const owing = payload.visits.filter((v) => v.payment_status !== 'paid');
  const owedOf = (v: TodayVisit) => Math.max((v.net_amount || 0) - (v.paid_amount || 0), 0);
  const outstandingTotal = sum(owing, owedOf);
  const owingThisPeriod = owing.filter((v) => inRange(v.registered_at, range));
  const owingPrior = owing.filter((v) => inRange(v.registered_at, prior));

  const spark = (items: { at: string | null | undefined; value: number }[]) =>
    dailyBuckets(items, SPARK_DAYS, now);

  const money: MoneyRow = {
    billed: {
      value: billedOf(nowVisits),
      delta: delta(billedOf(nowVisits), billedOf(priorVisits), { label: cmp }),
      spark: spark(payload.visits.map((v) => ({ at: v.registered_at, value: v.net_amount }))),
    },
    collected: {
      value: collectedOf(range),
      delta: delta(collectedOf(range), collectedOf(prior), { label: cmp }),
      spark: spark([
        ...payload.visits.map((v) => ({ at: v.registered_at, value: v.paid_amount })),
        ...payload.ledger.filter((l) => l.type === 'deposit').map((l) => ({ at: l.created_at, value: l.amount })),
        ...payload.charges.map((c) => ({ at: c.created_at, value: c.amount })),
      ]),
    },
    outstanding: {
      value: outstandingTotal,
      delta: delta(sum(owingThisPeriod, owedOf), sum(owingPrior, owedOf), { label: cmp, higherIsGood: false }),
      spark: spark(owing.map((v) => ({ at: v.registered_at, value: owedOf(v) }))),
      thisPeriodCount: owingThisPeriod.length,
      thisPeriodAmount: sum(owingThisPeriod, owedOf),
    },
    commission: {
      value: commissionOf(nowVisits),
      delta: delta(commissionOf(nowVisits), commissionOf(priorVisits), { label: cmp, higherIsGood: false }),
      spark: spark(
        payload.visits
          .filter((v) => v.commission_assigned)
          .map((v) => ({ at: v.registered_at, value: v.commission_amount })),
      ),
    },
  };

  /* --- Throughput ---------------------------------------------------- */

  const unfinished = payload.tests.filter((t) => t.status !== 'completed');
  const waitOf = (t: TodayTest) => Math.max(Math.floor((now.getTime() - new Date(t.registered_at).getTime()) / MINUTE), 0);

  const avgTat = (tests: TodayTest[]): number | null => {
    const mins = tests
      .map((t) => tatMinutes({ completed_at: t.completed_at, patient_created_at: t.registered_at }))
      .filter((m): m is number => m !== null);
    return mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null;
  };
  const tatNow = avgTat(nowCompleted);
  const tatPrior = avgTat(priorCompleted);

  const longest = unfinished.reduce<{ minutes: number; test: TodayTest } | null>((best, t) => {
    const minutes = waitOf(t);
    return !best || minutes > best.minutes ? { minutes, test: t } : best;
  }, null);

  const throughput: Throughput = {
    visits: {
      value: nowVisits.length,
      delta: delta(nowVisits.length, priorVisits.length, { label: cmp }),
      spark: spark(payload.visits.map((v) => ({ at: v.registered_at, value: 1 }))),
    },
    completed: {
      value: nowCompleted.length,
      delta: delta(nowCompleted.length, priorCompleted.length, { label: cmp }),
      spark: spark(
        payload.tests.filter((t) => t.status === 'completed').map((t) => ({ at: t.completed_at, value: 1 })),
      ),
    },
    waitingNow: unfinished.length,
    avgTatMinutes: tatNow,
    avgTatDelta: delta(tatNow ?? 0, tatPrior ?? 0, { label: cmp, higherIsGood: false }),
    longestWait: longest,
  };

  /* --- Floor --------------------------------------------------------- */

  const deptCard = (dept: 'lab' | 'radiology', label: string): FloorCard => {
    const mine = unfinished.filter((t) => t.department === dept);
    const oldest = mine.reduce<number | null>((m, t) => (m === null ? waitOf(t) : Math.max(m, waitOf(t))), null);
    return {
      department: dept,
      label,
      waiting: mine.filter((t) => t.status === 'pending').length,
      inProgress: mine.filter((t) => t.status === 'in_progress').length,
      doneInPeriod: nowCompleted.filter((t) => t.department === dept).length,
      oldestWaitMinutes: oldest,
      href: `/${slug}/${dept}`,
    };
  };

  const floor: FloorCard[] = [
    {
      department: 'reception',
      label: 'Reception',
      waiting: owingThisPeriod.length,
      inProgress: 0,
      doneInPeriod: nowVisits.length,
      oldestWaitMinutes: null,
      href: `/${slug}/reception`,
    },
    deptCard('lab', 'Laboratory'),
    deptCard('radiology', 'Radiology'),
  ];

  /* --- Exceptions ---------------------------------------------------- */

  const exceptions: Exception[] = [];

  if (sync && sync.enabled) {
    const offlineFor =
      sync.connectivity === 'offline' && sync.lastOnlineAt
        ? (now.getTime() - new Date(sync.lastOnlineAt).getTime()) / MINUTE
        : 0;
    const stuck = (sync.deadLetterCount ?? 0) + (sync.deadPullRows ?? 0);
    if (stuck > 0 || offlineFor > offlineMinutes) {
      const parts: string[] = [];
      if (sync.deadLetterCount) parts.push(`${sync.deadLetterCount} change${sync.deadLetterCount === 1 ? '' : 's'} the cloud refused`);
      if (sync.deadPullRows) parts.push(`${sync.deadPullRows} row${sync.deadPullRows === 1 ? '' : 's'} the hub could not take`);
      if (offlineFor > offlineMinutes) parts.push(`offline for ${formatAge(offlineFor)}`);
      if (sync.pendingCount) parts.push(`${sync.pendingCount} waiting to send`);
      exceptions.push({
        key: 'sync',
        kind: 'sync',
        severity: 3,
        title: stuck > 0 ? 'Some changes are not reaching the cloud' : 'This hub has been offline for a while',
        detail: parts.join(' · '),
        href: `/${slug}/admin`,
        action: { label: 'Run sync now', kind: 'run_sync' },
        ageMinutes: offlineFor,
      });
    }
  }

  for (const t of payload.tests) {
    if (!t.flags.some(isCriticalFlag)) continue;
    if (!inRange(t.completed_at, range)) continue;
    exceptions.push({
      key: `critical:${t.id}`,
      kind: 'critical',
      severity: t.acknowledged ? 1 : 3,
      title: `${t.acknowledged ? 'Critical result' : 'Critical result not acknowledged'} — ${t.patient_name}`,
      detail: `${t.test_name} · ${t.slip_number} · ${t.flags.filter(isCriticalFlag).join(', ')}`,
      href: `/${slug}/${t.department}?patient=${t.patient_id}`,
      ageMinutes: t.completed_at ? (now.getTime() - new Date(t.completed_at).getTime()) / MINUTE : 0,
    });
  }

  const lateTests = unfinished
    .map((t) => ({ t, minutes: waitOf(t) }))
    .filter((x) => x.minutes > longWaitMinutes)
    .sort((a, b) => b.minutes - a.minutes);
  for (const { t, minutes } of lateTests.slice(0, LONG_WAIT_ROWS)) {
    exceptions.push({
      key: `wait:${t.id}`,
      kind: 'long_wait',
      severity: 2,
      title: `Waiting ${formatAge(minutes)} — ${t.patient_name}`,
      detail: `${t.test_name} · ${t.department === 'lab' ? 'Laboratory' : 'Radiology'} · ${t.slip_number}`,
      href: `/${slug}/${t.department}?patient=${t.patient_id}`,
      ageMinutes: minutes,
    });
  }
  if (lateTests.length > LONG_WAIT_ROWS) {
    // One row for the rest, not sixty: a bench with a backlog needs the
    // bench, not a page of the same line. Goes to the busier department.
    const rest = lateTests.slice(LONG_WAIT_ROWS);
    const labCount = rest.filter((x) => x.t.department === 'lab').length;
    const dept = labCount >= rest.length - labCount ? 'lab' : 'radiology';
    exceptions.push({
      key: 'wait:more',
      kind: 'long_wait',
      severity: 2,
      title: `${rest.length} more test${rest.length === 1 ? '' : 's'} waiting over ${formatAge(longWaitMinutes)}`,
      detail: `${labCount} in the laboratory · ${rest.length - labCount} in radiology · oldest ${formatAge(rest[0]!.minutes)}`,
      href: `/${slug}/${dept}`,
      ageMinutes: rest[0]!.minutes,
    });
  }

  const owingSorted = [...owing].sort(
    (a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime(),
  );
  for (const v of owingSorted.slice(0, 20)) {
    const age = (now.getTime() - new Date(v.registered_at).getTime()) / MINUTE;
    exceptions.push({
      key: `unpaid:${v.id}`,
      kind: 'unpaid',
      severity: 1,
      title: `${naira(owedOf(v))} unpaid — ${visitName(v)}`,
      detail: `${v.slip_number} · ${v.payment_status === 'partial' ? 'part paid' : 'nothing paid'} · ${formatAge(age)} ago`,
      href: `/${slug}/admin/patients?patient=${v.id}`,
      ageMinutes: age,
    });
  }

  const agedCommission = payload.visits.filter(
    (v) =>
      v.commission_assigned &&
      v.commission_status === 'pending' &&
      v.commission_amount > 0 &&
      now.getTime() - new Date(v.registered_at).getTime() > agedCommissionDays * DAY_MS,
  );
  if (agedCommission.length > 0) {
    const total = sum(agedCommission, (v) => v.commission_amount);
    const oldest = Math.max(...agedCommission.map((v) => now.getTime() - new Date(v.registered_at).getTime()));
    exceptions.push({
      key: 'commission_aged',
      kind: 'commission_aged',
      severity: 1,
      title: `${naira(total)} in commission owed for over ${agedCommissionDays} days`,
      detail: `${agedCommission.length} referral${agedCommission.length === 1 ? '' : 's'} · oldest ${formatAge(oldest / MINUTE)}`,
      href: `/${slug}/admin/referrals/commissions?status=pending&age=${agedCommissionDays}`,
      ageMinutes: oldest / MINUTE,
    });
  }

  if (payload.pendingTests.length > 0) {
    const names = payload.pendingTests.slice(0, 3).map((t) => t.name).join(', ');
    exceptions.push({
      key: 'unpriced',
      kind: 'unpriced_test',
      severity: 0,
      title: `${payload.pendingTests.length} investigation${payload.pendingTests.length === 1 ? '' : 's'} waiting for a price`,
      detail: payload.pendingTests.length > 3 ? `${names} and more` : names,
      href: `/${slug}/admin/tests?tab=pending`,
      ageMinutes: 0,
    });
  }

  const completedSinceWindow = payload.tests.filter((t) => t.status === 'completed');
  for (const s of payload.staff) {
    if (s.signature_url) continue;
    const signed = completedSinceWindow.filter((t) => matchesStaff(t.completed_by, s)).length;
    if (signed === 0) continue;
    exceptions.push({
      key: `sig:${s.id}`,
      kind: 'no_signature',
      severity: 0,
      title: `${s.full_name || 'A staff member'} releases reports without a signature on file`,
      detail: `${signed} report${signed === 1 ? '' : 's'} in the last ${TODAY_WINDOW_LABEL}`,
      href: `/${slug}/admin/staff`,
      ageMinutes: 0,
    });
  }

  for (const inv of payload.invites ?? []) {
    if (!inv.expires_at) continue;
    const hoursLeft = (new Date(inv.expires_at).getTime() - now.getTime()) / (60 * MINUTE);
    if (hoursLeft < 0 || hoursLeft >= inviteHours) continue;
    exceptions.push({
      key: `invite:${inv.id}`,
      kind: 'invite_expiring',
      severity: 0,
      title: `Invitation to ${inv.email} expires in ${Math.max(Math.round(hoursLeft), 1)}h`,
      detail: `As ${inv.role.replace('_', ' ')} · resend it or let it lapse`,
      href: `/${slug}/admin/staff`,
      ageMinutes: -hoursLeft * 60,
    });
  }

  exceptions.sort((a, b) => b.severity - a.severity || b.ageMinutes - a.ageMinutes);

  /* --- Trend, referrers, staff --------------------------------------- */

  // One bucket is not a trend: "today" draws the week that led up to it.
  const trendRange = period === 'today' ? '7days' : period;
  const completedAsPerf: CompletedTest[] = payload.tests
    .filter((t) => t.status === 'completed')
    .map((t) => ({
      test_name: t.test_name,
      completed_at: t.completed_at,
      completed_by: t.completed_by,
      completed_by_profile_id: t.completed_by_profile_id,
      patient_created_at: t.registered_at,
      department: t.department,
      price: t.price,
      commission_amount: t.commission_amount,
    }));
  const trend = trendSeries(completedAsPerf, trendRange, now);
  const chart = chartGeometry(trend);
  const deptShare = departmentStats(completedAsPerf.filter((t) => inRange(t.completed_at, range)));

  const doctorName = new Map(payload.doctors.map((d) => [d.id, d.name]));
  const facilityName = new Map(payload.facilities.map((f) => [f.id, f.name]));
  const referrers = new Map<string, ReferrerRow>();
  for (const v of nowVisits) {
    let id: string | null = null;
    let kind: ReferrerRow['kind'] = 'unknown';
    let name = v.referred_by || '';
    if (v.referring_doctor_id && doctorName.has(v.referring_doctor_id)) {
      id = v.referring_doctor_id;
      kind = 'doctor';
      name = doctorName.get(id)!;
    } else if (v.referring_facility_id && facilityName.has(v.referring_facility_id)) {
      id = v.referring_facility_id;
      kind = 'facility';
      name = facilityName.get(id)!;
    }
    if (!name.trim() || isWalkIn(name)) continue;
    const key = id ?? `name:${name.trim().toLowerCase()}`;
    const row = referrers.get(key) ?? { id, name: name.trim(), kind, visits: 0, billed: 0, owed: 0 };
    row.visits += 1;
    row.billed += v.net_amount || 0;
    if (v.commission_assigned && v.commission_status === 'pending') row.owed += v.commission_amount || 0;
    referrers.set(key, row);
  }
  const topReferrers = [...referrers.values()].sort((a, b) => b.billed - a.billed || b.visits - a.visits).slice(0, 5);

  const topStaff: StaffActivityRow[] = payload.staff
    .map((s) => {
      const mine = nowCompleted.filter((t) => matchesStaff(t.completed_by, s, t.completed_by_profile_id));
      return {
        id: s.id,
        name: s.full_name || 'Not set up yet',
        completed: mine.length,
        departments: [...new Set(mine.map((t) => t.department))],
      };
    })
    .filter((r) => r.completed > 0)
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 5);

  return {
    period,
    range,
    money,
    throughput,
    floor,
    exceptions,
    trend,
    chart,
    deptShare,
    topReferrers,
    topStaff,
    truncated: payload.truncated,
  };
}

const TODAY_WINDOW_LABEL = 'two months';

const isCriticalFlag = (f: string) => f === 'HH' || f === 'LL';

/**
 * What reception writes when nobody referred the patient. The registration
 * form stores the words rather than a null, so "Not referred by anyone"
 * would otherwise rank as the clinic's busiest referrer.
 */
const WALK_IN = new Set(['not referred by anyone', 'none', 'none / walk-in', 'walk-in', 'walk in', 'self', 'n/a', '-']);
const isWalkIn = (name: string) => WALK_IN.has(name.trim().toLowerCase());

const visitName = (v: TodayVisit) => [v.first_name, v.surname].filter(Boolean).join(' ') || v.slip_number;

/** Money, the way this product writes it everywhere else. */
export const naira = (n: number) => `₦${Math.round(n || 0).toLocaleString('en-NG')}`;

/** "45m", "3h 20m", "2d 4h" — how long something has been waiting. */
export function formatAge(minutes: number): string {
  const m = Math.max(Math.round(minutes), 0);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
}
