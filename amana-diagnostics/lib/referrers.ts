/**
 * Doctors and facilities, as one list of referrers.
 *
 * They were two screens with near-identical tables, two "delete" buttons that
 * were really irreversible deletes, and a commission rate field on the
 * referrer record that nothing ever read — test_prices.commission_* wins
 * unconditionally, so a rate set here was a number an admin could type and
 * never see used. This module only builds the unified row; the commission
 * fields still exist on the underlying records (the hub's columns are
 * NOT NULL) and are carried through unread, not removed.
 */

import type { CommissionEntry, ReferringDoctor, ReferringFacility } from './store';
import { currentRange, inRange, type Period } from './today/period';

export type ReferrerKind = 'doctor' | 'facility';

export interface Referrer {
  id: string;
  kind: ReferrerKind;
  name: string;
  facilityId?: string;
  facilityName?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  referralsInPeriod: number;
  /** Pending commission only — a settled one is not still owed. */
  owed: number;
  lastReferralAt?: string;
}

export function buildReferrers(
  doctors: ReferringDoctor[],
  facilities: ReferringFacility[],
  entries: CommissionEntry[],
  opts: { now?: Date; period?: Period } = {},
): Referrer[] {
  const now = opts.now ?? new Date();
  const range = opts.period ? currentRange(opts.period, now) : null;

  const byReferrer = new Map<string, CommissionEntry[]>();
  for (const e of entries) {
    if (!e.referrerId) continue;
    const list = byReferrer.get(e.referrerId);
    if (list) list.push(e);
    else byReferrer.set(e.referrerId, [e]);
  }

  const rowFor = (
    id: string,
    kind: ReferrerKind,
    name: string,
    isActive: boolean,
    extra: Partial<Pick<Referrer, 'facilityId' | 'facilityName' | 'phone' | 'email' | 'address'>>,
  ): Referrer => {
    const own = byReferrer.get(id) ?? [];
    const referralsInPeriod = (range ? own.filter((e) => inRange(e.registeredAt, range)) : own).length;
    const owed = own
      .filter((e) => e.commissionStatus !== 'paid')
      .reduce((sum, e) => sum + e.commissionAmount, 0);
    const lastReferralAt = own.reduce<string | undefined>(
      (latest, e) => (!latest || e.registeredAt > latest ? e.registeredAt : latest),
      undefined,
    );
    return { id, kind, name, isActive, referralsInPeriod, owed, lastReferralAt, ...extra };
  };

  const doctorRows = doctors.map((d) =>
    rowFor(d.id, 'doctor', d.name, d.is_active, {
      facilityId: d.facility_id,
      facilityName: d.facility_name,
      phone: d.phone,
      email: d.email,
    }),
  );
  const facilityRows = facilities.map((f) =>
    rowFor(f.id, 'facility', f.name, f.is_active, { phone: f.phone, email: f.email, address: f.address }),
  );

  return [...doctorRows, ...facilityRows].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterReferrers(
  rows: Referrer[],
  opts: { search?: string; kind?: ReferrerKind | 'all'; showInactive?: boolean } = {},
): Referrer[] {
  const q = (opts.search ?? '').trim().toLowerCase();
  return rows.filter((r) => {
    if (!opts.showInactive && !r.isActive) return false;
    if (opts.kind && opts.kind !== 'all' && r.kind !== opts.kind) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      (r.facilityName ?? '').toLowerCase().includes(q) ||
      (r.address ?? '').toLowerCase().includes(q)
    );
  });
}
