import type {
  CommissionEntry, Patient, ReferringDoctor, ReferringFacility, TestPrice,
} from '@/lib/store';

/**
 * Builds the referral commission report from data the repositories return.
 *
 * This is pure derivation — it does not know or care which back end the rows
 * came from — so it is a plain function rather than part of a repository.
 */
export const buildCommissionReport = (
  patients: Patient[],
  prices: TestPrice[],
  doctors: ReferringDoctor[],
  facilities: ReferringFacility[],
  range: { from?: string; to?: string } = {},
): CommissionEntry[] => {
  let filteredPatients = patients.filter(p => p.commissionAssigned);
  if (range.from) filteredPatients = filteredPatients.filter(p => p.registeredAt >= range.from!);
  if (range.to) filteredPatients = filteredPatients.filter(p => p.registeredAt <= range.to!);

  const priceMap = new Map(prices.map(p => [p.test_id || (p as any).testId, p.price]));
  const doctorMap = new Map(doctors.map(d => [d.id, d]));
  const facilityMap = new Map(facilities.map(f => [f.id, f]));

  return filteredPatients.map((p: any) => {
    const tests = (p.tests || []).map((t: any) => ({
      testId: t.testId,
      testName: t.testName,
      // The price recorded on the visit wins; the current price list is only a fallback
      // so an old visit is not re-valued when prices change.
      price: t.price || priceMap.get(t.testId) || 0,
      commissionType: t.commissionType || 'none',
      commissionValue: t.commissionValue || 0,
      commissionAmount: t.commissionAmount || 0,
    }));
    const totalAmount = tests.reduce((sum: number, t: any) => sum + t.price, 0);

    // A referrer still on file gives the current name; otherwise fall back to the
    // free-text name captured at registration.
    let referrerName = p.referredBy || '—';
    let referrerType: 'doctor' | 'facility' = 'doctor';

    if (p.referringDoctorId && doctorMap.has(p.referringDoctorId)) {
      referrerName = doctorMap.get(p.referringDoctorId)!.name;
      referrerType = 'doctor';
    } else if (p.referringFacilityId && facilityMap.has(p.referringFacilityId)) {
      referrerName = facilityMap.get(p.referringFacilityId)!.name;
      referrerType = 'facility';
    } else if (p.referringFacility) {
      referrerName = p.referringFacility;
      referrerType = 'facility';
    }

    return {
      patientId: p.id,
      patientName: `${p.firstName} ${p.surname}`,
      slipNumber: p.slipNumber,
      registeredAt: p.registeredAt,
      referrerName,
      referrerType,
      commissionType: 'varies' as const,
      commissionValue: 0,
      tests,
      totalAmount,
      commissionAmount: p.commissionAmount || 0,
      commissionStatus: p.commissionStatus || 'pending',
      commissionPaidAt: p.commissionPaidAt,
      commissionPaidNotes: p.commissionPaidNotes,
    };
  });
};
