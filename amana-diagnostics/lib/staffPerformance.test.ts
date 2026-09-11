import { describe, it, expect } from 'vitest';

import {
  formatTAT,
  withinRange,
  commissionOf,
  tatMinutes,
  averageTat,
  matchesStaff,
  filterByRange,
  totalsFor,
  staffRows,
  sortStaff,
  searchStaff,
  departmentStats,
  trendSeries,
  chartGeometry,
  type PerformanceData,
} from './staffPerformance';

/**
 * These numbers decide what an administrator believes about their staff, and
 * two of them — commissions and collection rate — are what people get paid
 * against. Until this was extracted from the JSX none of it could be checked
 * at all.
 */

const NOW = new Date('2026-09-11T12:00:00.000Z');
const iso = (d: string) => new Date(d).toISOString();

describe('turnaround time', () => {
  it('reads as minutes under an hour and hours above it', () => {
    expect(formatTAT(45)).toBe('45m');
    expect(formatTAT(180)).toBe('3h');
    expect(formatTAT(200)).toBe('3h 20m');
  });

  it('says nothing rather than "0m" when there is nothing to say', () => {
    expect(formatTAT(0)).toBe('—');
  });

  it('drops a test signed off before the patient arrived', () => {
    // Back-dated entries would otherwise count as an instant turnaround and
    // flatter the average.
    expect(
      tatMinutes({ completed_at: iso('2026-09-01T08:00:00Z'), patient_created_at: iso('2026-09-01T09:00:00Z') }),
    ).toBeNull();
  });

  it('ignores those when averaging rather than counting them as zero', () => {
    const avg = averageTat([
      { completed_at: iso('2026-09-01T10:00:00Z'), patient_created_at: iso('2026-09-01T09:00:00Z') }, // 60
      { completed_at: iso('2026-09-01T08:00:00Z'), patient_created_at: iso('2026-09-01T09:00:00Z') }, // dropped
      { completed_at: iso('2026-09-01T11:00:00Z'), patient_created_at: iso('2026-09-01T09:00:00Z') }, // 120
    ]);
    expect(avg).toBe(90);
  });
});

describe('date ranges', () => {
  it('counts today by calendar day, not by 24 hours', () => {
    // Deliberately built in local time: a clinic's "today" is the day on the
    // wall, so the comparison is local and a UTC-shaped fixture would pass or
    // fail depending on where the machine running it sits.
    const earlierToday = new Date(NOW);
    earlierToday.setHours(1, 0, 0, 0);
    const lateYesterday = new Date(NOW);
    lateYesterday.setDate(NOW.getDate() - 1);
    lateYesterday.setHours(23, 0, 0, 0);

    expect(withinRange(earlierToday.toISOString(), 'today', NOW)).toBe(true);
    expect(withinRange(lateYesterday.toISOString(), 'today', NOW)).toBe(false);
  });

  it('counts 7days back from now', () => {
    expect(withinRange(iso('2026-09-05T12:00:00Z'), '7days', NOW)).toBe(true);
    expect(withinRange(iso('2026-09-03T12:00:00Z'), '7days', NOW)).toBe(false);
  });

  it('takes everything for "all", and nothing for a missing date', () => {
    expect(withinRange(iso('2001-01-01T00:00:00Z'), 'all', NOW)).toBe(true);
    expect(withinRange(null, 'all', NOW)).toBe(false);
    expect(withinRange('not a date', '30days', NOW)).toBe(false);
  });
});

describe('commission', () => {
  it('honours an amount agreed at the time over recomputing it', () => {
    // A later change to the price list must not restate what someone was owed.
    expect(commissionOf({ commission_amount: 500, price: 10000, commission_type: 'percentage', commission_value: 10 })).toBe(500);
  });

  it('works out a percentage or a fixed fee when no amount was stored', () => {
    expect(commissionOf({ price: 10000, commission_type: 'percentage', commission_value: 10 })).toBe(1000);
    expect(commissionOf({ price: 10000, commission_type: 'fixed', commission_value: 750 })).toBe(750);
  });

  it('is nothing when no commission was agreed', () => {
    expect(commissionOf({ price: 10000, commission_type: 'none' })).toBe(0);
    expect(commissionOf({})).toBe(0);
  });
});

describe('crediting work to a person', () => {
  const bala = { id: 'u2', full_name: 'Bala Yusuf', first_name: 'Bala', surname: 'Yusuf', role: 'lab' };

  it('matches the full name, the id, or a surname inside free text', () => {
    expect(matchesStaff('Bala Yusuf', bala)).toBe(true);
    expect(matchesStaff('u2', bala)).toBe(true);
    expect(matchesStaff('Signed by Yusuf, MLS', bala)).toBe(true);
  });

  it('matches the other way round, when the bench typed less than the roster holds', () => {
    expect(matchesStaff('Bala', bala)).toBe(true);
  });

  it('credits nobody for an empty field', () => {
    expect(matchesStaff('', bala)).toBe(false);
    expect(matchesStaff(null, bala)).toBe(false);
  });

  it('does not match a member who has no name on file against arbitrary text', () => {
    // An empty surname must not turn into "contains empty string", which is
    // true of every string and would credit one person with all the work.
    expect(matchesStaff('Someone Else', { id: 'u9', full_name: '', first_name: '', surname: '' })).toBe(false);
  });
});

/* ── The dashboard as a whole ─────────────────────────────────────────── */

const DATA: PerformanceData = {
  completedTests: [
    { completed_at: iso('2026-09-10T10:00:00Z'), patient_created_at: iso('2026-09-10T09:00:00Z'), completed_by: 'Bala Yusuf', department: 'lab', price: 10000, commission_type: 'percentage', commission_value: 10 },
    { completed_at: iso('2026-09-10T12:00:00Z'), patient_created_at: iso('2026-09-10T09:00:00Z'), completed_by: 'Bala Yusuf', department: 'lab', price: 6000, commission_amount: 900 },
    { completed_at: iso('2026-09-09T12:00:00Z'), patient_created_at: iso('2026-09-09T11:00:00Z'), completed_by: 'Chi Obi', department: 'radiology', price: 20000 },
    { completed_at: iso('2025-01-01T12:00:00Z'), patient_created_at: iso('2025-01-01T11:00:00Z'), completed_by: 'Bala Yusuf', department: 'lab', price: 99999 },
  ],
  ledgerTransactions: [
    { created_at: iso('2026-09-10T10:30:00Z'), created_by: 'Ngozi Ade', type: 'deposit', amount: 15000 },
    { created_at: iso('2026-09-10T11:00:00Z'), created_by: 'Ngozi Ade', type: 'charge', amount: 4000 },
  ],
  externalCharges: [{ created_at: iso('2026-09-10T11:30:00Z'), created_by: 'Ngozi Ade', amount: 5000 }],
  patientBilling: [{ created_at: iso('2026-09-10T09:00:00Z'), net_amount: 36000 }],
};

const STAFF = [
  { id: 'u2', full_name: 'Bala Yusuf', first_name: 'Bala', surname: 'Yusuf', role: 'lab' },
  { id: 'u3', full_name: 'Chi Obi', first_name: 'Chi', surname: 'Obi', role: 'radiology' },
  { id: 'u4', full_name: 'Ngozi Ade', first_name: 'Ngozi', surname: 'Ade', role: 'reception' },
];

describe('the totals', () => {
  const f = filterByRange(DATA, '7days', NOW);

  it('leaves out anything outside the range', () => {
    // The ₦99,999 test from last year must not appear in a 7-day figure.
    expect(f.tests).toHaveLength(3);
    expect(totalsFor(f).totalClinicalRevenue).toBe(36000);
  });

  it('adds stored and computed commissions together', () => {
    // 10% of 10,000 plus a stored 900.
    expect(totalsFor(f).totalCommissions).toBe(1900);
  });

  it('counts deposits and external charges as collected, but not ledger charges', () => {
    // A charge is money owed, not money taken.
    expect(totalsFor(f).totalReceptionCollections).toBe(20000);
  });

  it('never reports collecting more than was billed', () => {
    const over = totalsFor({ ...f, billing: [{ created_at: iso('2026-09-10T09:00:00Z'), net_amount: 1000 }] });
    expect(over.collectionRate).toBe(100);
    expect(over.outstandingReceivables).toBe(0);
  });

  it('says fully collected when nothing was billed, rather than dividing by zero', () => {
    expect(totalsFor({ ...f, billing: [] }).collectionRate).toBe(100);
  });
});

describe('the leaderboard', () => {
  const f = filterByRange(DATA, '7days', NOW);
  const rows = staffRows(STAFF, f);

  it('measures reception on receipts and money, and the bench on tests', () => {
    const ngozi = rows.find((r) => r.member.id === 'u4')!;
    expect(ngozi.receiptCount).toBe(2);
    expect(ngozi.collectionSum).toBe(20000);
    expect(ngozi.testCount).toBe(0);

    const bala = rows.find((r) => r.member.id === 'u2')!;
    expect(bala.testCount).toBe(2);
    expect(bala.testRev).toBe(16000);
    expect(bala.commissionSum).toBe(1900);
  });

  it('ranks by revenue, comparing reception on collections', () => {
    const order = sortStaff(rows, 'revenue').map((r) => r.member.id);
    // Ngozi 20,000 collected; Chi 20,000 of tests; Bala 16,000.
    expect(order[2]).toBe('u2');
  });

  it('puts the fastest first and anyone unmeasured last', () => {
    const order = sortStaff(rows, 'tat').map((r) => r.member.id);
    // Chi averages 60m, Bala 120m, Ngozi has no tests at all.
    expect(order).toEqual(['u3', 'u2', 'u4']);
  });

  it('finds someone by name or by role', () => {
    expect(searchStaff(rows, 'ngozi')).toHaveLength(1);
    expect(searchStaff(rows, 'lab')).toHaveLength(1);
    expect(searchStaff(rows, '')).toHaveLength(3);
  });
});

describe('by department', () => {
  it('groups and totals, filing anything undepartmented under Other', () => {
    const stats = departmentStats([
      { department: 'lab', price: 100 },
      { department: 'lab', price: 200 },
      { price: 50 },
    ]);
    expect(stats['lab']).toEqual({ count: 2, rev: 300 });
    expect(stats['Other']).toEqual({ count: 1, rev: 50 });
  });
});

describe('the trend chart', () => {
  it('makes one bucket per day, oldest first', () => {
    const series = trendSeries([], '7days', NOW);
    expect(series).toHaveLength(7);
  });

  it('drops revenue into the day it belongs to', () => {
    const series = trendSeries(
      [{ completed_at: iso('2026-09-11T08:00:00Z'), price: 5000 }],
      '7days',
      NOW,
    );
    expect(series[series.length - 1]!.rev).toBe(5000);
    expect(series[series.length - 1]!.count).toBe(1);
  });

  it('ignores a test with no completion date instead of throwing', () => {
    expect(() => trendSeries([{ price: 100 }], '7days', NOW)).not.toThrow();
    expect(trendSeries([{ price: 100 }], '7days', NOW).every((d) => d.count === 0)).toBe(true);
  });

  it('keeps a flat week off the top of the chart', () => {
    // Without the floor, an auto-scaled axis draws a quiet week as a full one.
    const geo = chartGeometry(trendSeries([], '7days', NOW));
    expect(geo.maxRev).toBe(1000);
    expect(geo.points.every((p) => p.y === geo.paddingTop + geo.chartHeight)).toBe(true);
  });

  it('closes the area path back to the baseline', () => {
    const geo = chartGeometry(trendSeries([{ completed_at: iso('2026-09-11T08:00:00Z'), price: 5000 }], '7days', NOW));
    expect(geo.linePath.startsWith('M ')).toBe(true);
    expect(geo.areaPath.endsWith('Z')).toBe(true);
  });

  it('does not divide by zero on a single bucket', () => {
    const geo = chartGeometry(trendSeries([], 'today', NOW));
    expect(geo.points).toHaveLength(1);
    expect(Number.isFinite(geo.points[0]!.x)).toBe(true);
  });
});
