import { describe, it, expect } from 'vitest';

import { buildReferrers, filterReferrers } from './referrers';
import type { CommissionEntry, ReferringDoctor, ReferringFacility } from './store';

const NOW = new Date('2026-09-14T12:00:00.000Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

const doctor = (over: Partial<ReferringDoctor> = {}): ReferringDoctor => ({
  id: 'd1',
  organization_id: 'org-1',
  name: 'Amina Bello',
  commission_type: 'percentage',
  commission_value: 10,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

const facility = (over: Partial<ReferringFacility> = {}): ReferringFacility => ({
  id: 'f1',
  organization_id: 'org-1',
  name: 'Kano Clinic',
  commission_type: 'percentage',
  commission_value: 5,
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  ...over,
});

const entry = (over: Partial<CommissionEntry> = {}): CommissionEntry => ({
  patientId: 'p1',
  patientName: 'Ada Okoye',
  slipNumber: '00412',
  registeredAt: daysAgo(2),
  referrerName: 'Amina Bello',
  referrerType: 'doctor',
  referrerId: 'd1',
  commissionType: 'percentage',
  commissionValue: 10,
  tests: [],
  totalAmount: 10000,
  commissionAmount: 1000,
  commissionStatus: 'pending',
  ...over,
});

describe('building the unified referrer list', () => {
  it('combines doctors and facilities into one sorted list', () => {
    const rows = buildReferrers([doctor({ name: 'Zainab' })], [facility({ name: 'Amana Clinic' })], []);
    expect(rows.map((r) => r.name)).toEqual(['Amana Clinic', 'Zainab']);
    expect(rows.find((r) => r.name === 'Zainab')?.kind).toBe('doctor');
    expect(rows.find((r) => r.name === 'Amana Clinic')?.kind).toBe('facility');
  });

  it('sums owed from pending commissions only, keyed by referrer id', () => {
    const entries = [
      entry({ patientId: 'p1', commissionAmount: 1000, commissionStatus: 'pending' }),
      entry({ patientId: 'p2', commissionAmount: 500, commissionStatus: 'paid' }),
      entry({ patientId: 'p3', referrerId: 'f1', referrerType: 'facility', commissionAmount: 200, commissionStatus: 'pending' }),
    ];
    const rows = buildReferrers([doctor()], [facility()], entries);

    expect(rows.find((r) => r.id === 'd1')?.owed).toBe(1000);
    expect(rows.find((r) => r.id === 'f1')?.owed).toBe(200);
  });

  it('ignores free-text referrals that carry no referrer id', () => {
    const entries = [entry({ referrerId: undefined, referrerName: 'Some clinic downtown' })];
    const rows = buildReferrers([doctor()], [], entries);
    expect(rows.find((r) => r.id === 'd1')?.owed).toBe(0);
  });

  it('counts referrals within the given period, and lifetime when no period is given', () => {
    const entries = [
      entry({ patientId: 'p1', registeredAt: daysAgo(2) }),
      entry({ patientId: 'p2', registeredAt: daysAgo(40) }),
    ];
    const withPeriod = buildReferrers([doctor()], [], entries, { now: NOW, period: '30days' });
    expect(withPeriod[0]!.referralsInPeriod).toBe(1);

    const lifetime = buildReferrers([doctor()], [], entries, { now: NOW });
    expect(lifetime[0]!.referralsInPeriod).toBe(2);
  });

  it('records the most recent referral date', () => {
    const entries = [
      entry({ patientId: 'p1', registeredAt: daysAgo(10) }),
      entry({ patientId: 'p2', registeredAt: daysAgo(2) }),
    ];
    const rows = buildReferrers([doctor()], [], entries);
    expect(rows[0]!.lastReferralAt).toBe(daysAgo(2));
  });

  it('carries facility and contact details through for a linked doctor', () => {
    const rows = buildReferrers(
      [doctor({ facility_id: 'f1', facility_name: 'Kano Clinic', phone: '080', email: 'a@b.com' })],
      [],
      [],
    );
    expect(rows[0]).toMatchObject({ facilityId: 'f1', facilityName: 'Kano Clinic', phone: '080', email: 'a@b.com' });
  });
});

describe('filtering the list', () => {
  const rows = buildReferrers(
    [doctor({ id: 'd1', name: 'Amina Bello', is_active: true }), doctor({ id: 'd2', name: 'Bala Musa', is_active: false })],
    [facility({ id: 'f1', name: 'Kano Clinic', address: '12 Main St', is_active: true })],
    [],
  );

  it('hides inactive referrers unless asked to show them', () => {
    expect(filterReferrers(rows).map((r) => r.id)).toEqual(['d1', 'f1']);
    expect(filterReferrers(rows, { showInactive: true }).map((r) => r.id).sort()).toEqual(['d1', 'd2', 'f1']);
  });

  it('narrows by kind', () => {
    expect(filterReferrers(rows, { kind: 'doctor' }).map((r) => r.id)).toEqual(['d1']);
    expect(filterReferrers(rows, { kind: 'facility' }).map((r) => r.id)).toEqual(['f1']);
  });

  it('searches name and address', () => {
    expect(filterReferrers(rows, { search: 'amina' })).toHaveLength(1);
    expect(filterReferrers(rows, { search: 'main st' })).toHaveLength(1);
    expect(filterReferrers(rows, { search: 'nowhere' })).toHaveLength(0);
  });
});
