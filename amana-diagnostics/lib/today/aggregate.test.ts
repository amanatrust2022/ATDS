import { describe, expect, it } from 'vitest';

import type { SyncState } from '@/lib/sync/engine';

import { buildToday, formatAge } from './aggregate';
import type { TodayPayload, TodayTest, TodayVisit } from './types';

// A Monday, mid-morning, local time.
const NOW = new Date(2026, 8, 14, 10, 30, 0);
const MIN = 60_000;
const DAY = 86_400_000;

const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * MIN).toISOString();
const daysAgo = (d: number, hour = 9) => {
  const x = new Date(NOW);
  x.setDate(x.getDate() - d);
  x.setHours(hour, 0, 0, 0);
  return x.toISOString();
};

let seq = 0;
const visit = (over: Partial<TodayVisit> = {}): TodayVisit => ({
  id: `v${++seq}`,
  slip_number: `RD-${seq}`,
  registered_at: at(60),
  first_name: 'Ada',
  surname: 'Okafor',
  referred_by: null,
  referring_doctor_id: null,
  referring_facility_id: null,
  commission_assigned: false,
  commission_amount: 0,
  commission_status: null,
  commission_paid_at: null,
  net_amount: 5000,
  paid_amount: 5000,
  payment_status: 'paid',
  payment_method: 'cash',
  ...over,
});

const test = (over: Partial<TodayTest> = {}): TodayTest => ({
  id: `t${++seq}`,
  patient_id: 'v1',
  test_name: 'FBC',
  department: 'lab',
  status: 'completed',
  completed_by: 'Musa Ibrahim',
  completed_at: at(30),
  price: 3000,
  commission_amount: 0,
  flags: [],
  acknowledged: false,
  registered_at: at(90),
  patient_name: 'Ada Okafor',
  slip_number: 'RD-1',
  ...over,
});

const payload = (over: Partial<TodayPayload> = {}): TodayPayload => ({
  generatedAt: NOW.toISOString(),
  since: daysAgo(61),
  visits: [],
  tests: [],
  ledger: [],
  charges: [],
  staff: [{ id: 's1', full_name: 'Musa Ibrahim', role: 'lab', signature_url: 'sig.png' }],
  doctors: [],
  facilities: [],
  pendingTests: [],
  invites: null,
  truncated: { unpaid: false, pendingCommission: false, unfinished: false },
  ...over,
});

const build = (p: Partial<TodayPayload>, extra: Partial<Parameters<typeof buildToday>[1]> = {}) =>
  buildToday(payload(p), { period: 'today', now: NOW, slug: 'kano', sync: null, ...extra });

describe('money', () => {
  it('bills what was registered in the period and compares with last week', () => {
    const m = build({
      visits: [
        visit({ net_amount: 4000 }),
        visit({ net_amount: 6000 }),
        visit({ net_amount: 5000, registered_at: daysAgo(7) }), // same weekday last week
        visit({ net_amount: 99999, registered_at: daysAgo(61) }), // outside the window
      ],
    });
    expect(m.money.billed.value).toBe(10000);
    expect(m.money.billed.delta).toMatchObject({ value: 100, direction: 'up', sentiment: 'good' });
  });

  it('collects registration cash, deposits and external charges — not charges, refunds or reversals', () => {
    const m = build({
      visits: [visit({ paid_amount: 2000 })],
      ledger: [
        { created_at: at(5), type: 'deposit', amount: 1000, created_by: 'r' },
        { created_at: at(5), type: 'charge', amount: -700, created_by: 'r' },
        { created_at: at(5), type: 'refund', amount: -300, created_by: 'r' },
        { created_at: at(5), type: 'reversal', amount: 300, created_by: 'r' },
      ],
      charges: [{ created_at: at(5), amount: 500, department: 'pharmacy', created_by: 'r' }],
    });
    expect(m.money.collected.value).toBe(3500);
  });

  it('counts outstanding money across all time, and says how much is from this period', () => {
    const m = build({
      visits: [
        visit({ net_amount: 5000, paid_amount: 2000, payment_status: 'partial' }),
        visit({ net_amount: 3000, paid_amount: 0, payment_status: 'unpaid', registered_at: daysAgo(40) }),
        visit({ net_amount: 8000, paid_amount: 8000, payment_status: 'paid' }),
      ],
    });
    expect(m.money.outstanding.value).toBe(6000);
    expect(m.money.outstanding.thisPeriodCount).toBe(1);
    expect(m.money.outstanding.thisPeriodAmount).toBe(3000);
  });

  it('accrues commission only on visits that carry one', () => {
    const m = build({
      visits: [
        visit({ commission_assigned: true, commission_amount: 500 }),
        visit({ commission_assigned: false, commission_amount: 500 }),
      ],
    });
    expect(m.money.commission.value).toBe(500);
  });
});

describe('throughput', () => {
  it('counts waiting tests of any date, and finds the longest wait', () => {
    const m = build({
      tests: [
        test({ status: 'pending', registered_at: daysAgo(3) }),
        test({ status: 'in_progress', registered_at: at(20) }),
        test({ status: 'completed' }),
      ],
    });
    expect(m.throughput.waitingNow).toBe(2);
    expect(m.throughput.longestWait?.minutes).toBeGreaterThan(3 * 24 * 60 - 60);
  });

  it('averages turnaround over the period and reads a slower one as bad', () => {
    const m = build({
      tests: [
        test({ completed_at: at(10), registered_at: at(70) }), // 60 min
        test({ completed_at: at(10), registered_at: at(130) }), // 120 min
        test({ completed_at: daysAgo(7, 10), registered_at: daysAgo(7, 9) }), // 60 min, last week
      ],
    });
    expect(m.throughput.avgTatMinutes).toBe(90);
    expect(m.throughput.avgTatDelta).toMatchObject({ direction: 'up', sentiment: 'bad' });
  });
});

describe('floor', () => {
  it('splits the benches by status and puts unpaid visits on the reception card', () => {
    const m = build({
      visits: [visit({ payment_status: 'unpaid', paid_amount: 0 }), visit()],
      tests: [
        test({ department: 'lab', status: 'pending' }),
        test({ department: 'lab', status: 'in_progress' }),
        test({ department: 'radiology', status: 'completed' }),
      ],
    });
    const [reception, lab, rad] = m.floor;
    expect(reception).toMatchObject({ waiting: 1, doneInPeriod: 2, href: '/kano/reception' });
    expect(lab).toMatchObject({ waiting: 1, inProgress: 1, doneInPeriod: 0, href: '/kano/lab' });
    expect(rad).toMatchObject({ waiting: 0, doneInPeriod: 1 });
  });
});

describe('exceptions', () => {
  it('flags a wait past the threshold, not one at it', () => {
    const m = build({
      tests: [
        test({ id: 'ok', status: 'pending', registered_at: at(90) }),
        test({ id: 'late', status: 'pending', registered_at: at(91) }),
      ],
    });
    const waits = m.exceptions.filter((e) => e.kind === 'long_wait');
    expect(waits.map((e) => e.key)).toEqual(['wait:late']);
    expect(waits[0]!.href).toBe('/kano/lab?patient=v1');
  });

  it('puts an unacknowledged critical result at the top, and an acknowledged one lower', () => {
    const m = build({
      tests: [
        test({ id: 'c1', flags: ['N', 'HH'], acknowledged: false }),
        test({ id: 'c2', flags: ['LL'], acknowledged: true }),
        test({ id: 'c3', flags: ['H'] }),
        test({ id: 'old', flags: ['HH'], completed_at: daysAgo(2) }),
      ],
    });
    const crit = m.exceptions.filter((e) => e.kind === 'critical');
    expect(crit.map((e) => [e.key, e.severity])).toEqual([
      ['critical:c1', 3],
      ['critical:c2', 1],
    ]);
    expect(m.exceptions[0]!.key).toBe('critical:c1');
  });

  it('lists unpaid visits with the amount owed, oldest first', () => {
    const m = build({
      visits: [
        visit({ id: 'new', net_amount: 5000, paid_amount: 1000, payment_status: 'partial' }),
        visit({ id: 'old', net_amount: 2000, paid_amount: 0, payment_status: 'unpaid', registered_at: daysAgo(3) }),
      ],
    });
    const unpaid = m.exceptions.filter((e) => e.kind === 'unpaid');
    expect(unpaid.map((e) => e.key)).toEqual(['unpaid:old', 'unpaid:new']);
    expect(unpaid[1]!.title).toBe('₦4,000 unpaid — Ada Okafor');
    expect(unpaid[1]!.href).toBe('/kano/admin/patients?patient=new');
  });

  it('raises the sync row for dead letters, and for a long outage, but not a short one', () => {
    const sync = (over: Partial<SyncState>): SyncState =>
      ({
        enabled: true,
        connectivity: 'online',
        status: 'synced',
        deadLetterCount: 0,
        deadPullRows: 0,
        pendingCount: 0,
        lastOnlineAt: null,
        ...over,
      }) as SyncState;

    expect(build({}, { sync: sync({ deadLetterCount: 2 }) }).exceptions[0]).toMatchObject({
      kind: 'sync',
      severity: 3,
      action: { kind: 'run_sync' },
    });
    expect(
      build({}, { sync: sync({ connectivity: 'offline', lastOnlineAt: NOW.getTime() - 11 * MIN }) }).exceptions,
    ).toHaveLength(1);
    expect(
      build({}, { sync: sync({ connectivity: 'offline', lastOnlineAt: NOW.getTime() - 9 * MIN }) }).exceptions,
    ).toHaveLength(0);
    expect(build({}, { sync: null }).exceptions).toHaveLength(0);
  });

  it('adds up commission owed for longer than a month', () => {
    const m = build({
      visits: [
        visit({ commission_assigned: true, commission_status: 'pending', commission_amount: 400, registered_at: daysAgo(31) }),
        visit({ commission_assigned: true, commission_status: 'pending', commission_amount: 600, registered_at: daysAgo(45) }),
        visit({ commission_assigned: true, commission_status: 'pending', commission_amount: 999, registered_at: daysAgo(29) }),
        visit({ commission_assigned: true, commission_status: 'paid', commission_amount: 999, registered_at: daysAgo(60) }),
      ],
    });
    const aged = m.exceptions.find((e) => e.kind === 'commission_aged')!;
    expect(aged.title).toBe('₦1,000 in commission owed for over 30 days');
    expect(aged.href).toBe('/kano/admin/referrals/commissions?status=pending&age=30');
  });

  it('mentions investigations waiting for a price', () => {
    const m = build({ pendingTests: [{ id: 'x', name: 'Lipid profile', department: 'lab' }] });
    expect(m.exceptions.find((e) => e.kind === 'unpriced_test')).toMatchObject({
      title: '1 investigation waiting for a price',
      href: '/kano/admin/tests?tab=pending',
    });
  });

  it('flags a signer with no signature only if they have signed something', () => {
    const m = build({
      staff: [
        { id: 'a', full_name: 'Musa Ibrahim', role: 'lab', signature_url: null },
        { id: 'b', full_name: 'Idle Person', role: 'lab', signature_url: null },
      ],
      tests: [test({ completed_by: 'Musa Ibrahim' })],
    });
    const sig = m.exceptions.filter((e) => e.kind === 'no_signature');
    expect(sig.map((e) => e.key)).toEqual(['sig:a']);
  });

  it('flags an invitation expiring within two days, not one with longer to run', () => {
    const m = build({
      invites: [
        { id: 'soon', email: 'a@b.c', role: 'lab_tech', expires_at: new Date(NOW.getTime() + 47 * 60 * MIN).toISOString() },
        { id: 'later', email: 'd@e.f', role: 'reception', expires_at: new Date(NOW.getTime() + 49 * 60 * MIN).toISOString() },
        { id: 'never', email: 'g@h.i', role: 'reception', expires_at: null },
      ],
    });
    const inv = m.exceptions.filter((e) => e.kind === 'invite_expiring');
    expect(inv.map((e) => e.key)).toEqual(['invite:soon']);
    expect(inv[0]!.title).toBe('Invitation to a@b.c expires in 47h');
  });
});

describe('referrers and staff', () => {
  it('names referrers by id when it can, and by the typed name when it cannot', () => {
    const m = build({
      doctors: [{ id: 'd1', name: 'Amina Bello', is_active: true }],
      facilities: [{ id: 'f1', name: 'Kano General', is_active: true }],
      visits: [
        visit({ referring_doctor_id: 'd1', referred_by: 'Dr A', net_amount: 4000, commission_assigned: true, commission_status: 'pending', commission_amount: 400 }),
        visit({ referring_doctor_id: 'd1', referred_by: 'Dr A', net_amount: 1000 }),
        visit({ referring_facility_id: 'f1', net_amount: 3000 }),
        visit({ referred_by: 'Someone typed', net_amount: 500 }),
        visit({ net_amount: 500 }),
      ],
    });
    expect(m.topReferrers).toEqual([
      { id: 'd1', name: 'Amina Bello', kind: 'doctor', visits: 2, billed: 5000, owed: 400 },
      { id: 'f1', name: 'Kano General', kind: 'facility', visits: 1, billed: 3000, owed: 0 },
      { id: null, name: 'Someone typed', kind: 'unknown', visits: 1, billed: 500, owed: 0 },
    ]);
  });

  it('ranks staff by tests signed off in the period, five at most', () => {
    const staff = ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => ({
      id: n, full_name: `${n} Person`, role: 'lab', signature_url: 's',
    }));
    const tests = staff.flatMap((s, i) =>
      Array.from({ length: i + 1 }, () => test({ completed_by: s.full_name })),
    );
    const m = build({ staff, tests });
    expect(m.topStaff).toHaveLength(5);
    expect(m.topStaff[0]).toMatchObject({ id: 'F', completed: 6, departments: ['lab'] });
    expect(m.topStaff.map((r) => r.id)).not.toContain('A');
  });

  it('draws a week of trend for today, and passes the truncation through', () => {
    const m = build({ truncated: { unpaid: true, pendingCommission: false, unfinished: false } });
    expect(m.trend).toHaveLength(7);
    expect(m.truncated.unpaid).toBe(true);
  });
});

describe('formatAge', () => {
  it('reads minutes, hours and days', () => {
    expect(formatAge(45)).toBe('45m');
    expect(formatAge(200)).toBe('3h 20m');
    expect(formatAge(180)).toBe('3h');
    expect(formatAge(52 * 60)).toBe('2d 4h');
  });
});

describe('real-data lessons', () => {
  it('does not rank the walk-in placeholder as a referrer', () => {
    const m = build({
      visits: [visit({ referred_by: 'Not referred by anyone', net_amount: 9000 }), visit({ referred_by: 'Dr Typed', net_amount: 100 })],
    });
    expect(m.topReferrers.map((r) => r.name)).toEqual(['Dr Typed']);
  });

  it('lists the eight longest waits and rolls the rest into one row', () => {
    const tests = Array.from({ length: 12 }, (_, i) =>
      test({ id: `w${i}`, status: 'pending', department: i < 9 ? 'lab' : 'radiology', registered_at: at(100 + i * 60) }),
    );
    const m = build({ tests });
    const waits = m.exceptions.filter((e) => e.kind === 'long_wait');
    expect(waits).toHaveLength(9);
    expect(waits[0]!.key).toBe('wait:w11');
    expect(waits[8]).toMatchObject({ key: 'wait:more', title: '4 more tests waiting over 1h 30m', href: '/kano/lab' });
  });
});
