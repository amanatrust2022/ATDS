import { isInvestigationPackage, Test, TestPrice, type PatientTest } from '@/lib/store';

export type DiscountType = 'none' | 'flat' | 'percentage';
export type CommissionType = NonNullable<TestPrice['commission_type']>;

export interface SelectedTestDetail {
  testId: string;
  testName: string;
  department: Test['department'];
  specimen: Test['specimen'];
  price: number;
  commissionType: CommissionType;
  commissionValue: number;
  averageCost?: number;
  staffBonusType?: CommissionType;
  staffBonusValue?: number;
  kind?: 'investigation' | 'package';
  investigationIds?: string[];
}

/** Joins the chosen test ids against the catalogue and the org's price list. */
export const buildSelectedTestDetails = (
  selectedTests: string[],
  catalogue: Test[],
  testPrices: TestPrice[],
): SelectedTestDetail[] =>
  selectedTests.flatMap(tid => {
    const test = catalogue.find(t => t.id === tid);
    if (!test) return [];
    const catalog = testPrices.find(p => p.test_id === tid);
    return [{
      testId: test.id,
      testName: test.name,
      department: test.department,
      specimen: test.specimen,
      price: catalog ? catalog.price : 0,
      commissionType: catalog?.commission_type ?? 'none',
      commissionValue: catalog?.commission_value ?? 0,
      averageCost: catalog?.average_cost ?? 0,
      staffBonusType: catalog?.staff_bonus_type ?? 'none',
      staffBonusValue: catalog?.staff_bonus_value ?? 0,
      kind: isInvestigationPackage(test) ? 'package' : 'investigation',
      investigationIds: test.investigationIds ?? [],
    }];
  });

export const calculateSubtotal = (details: SelectedTestDetail[]): number =>
  details.reduce((sum, t) => sum + t.price, 0);

export const calculateDiscountAmount = (
  subtotal: number,
  discountType: DiscountType,
  discountValue: string,
): number => {
  const discVal = parseFloat(discountValue) || 0;
  if (discountType === 'percentage') return (subtotal * discVal) / 100;
  if (discountType === 'flat') return discVal;
  return 0;
};

/** Commission owed on a single test line. Returns 0 when the visit is not a referral. */
export const commissionForTest = (detail: SelectedTestDetail, isReferral: boolean): number => {
  if (!isReferral || detail.commissionType === 'none') return 0;
  if (detail.commissionType === 'percentage') return (detail.price * (detail.commissionValue || 0)) / 100;
  if (detail.commissionType === 'flat') return detail.commissionValue || 0;
  return 0;
};

export const calculateTotalCommission = (details: SelectedTestDetail[], isReferral: boolean): number =>
  details.reduce((sum, t) => sum + commissionForTest(t, isReferral), 0);

export const staffBonusFor = (price: number, type: CommissionType, value: number): number => {
  if (type === 'percentage') return Math.max(0, price * value / 100);
  if (type === 'flat') return Math.max(0, value);
  return 0;
};

/** Expand package bill lines into independently routed clinical work items. */
export const buildPatientTests = (
  details: SelectedTestDetail[],
  catalogue: Test[],
  isReferral: boolean,
  testPrices: TestPrice[] = [],
): Omit<PatientTest, 'id' | 'patient_id'>[] => details.flatMap((detail) => {
  if (detail.kind !== 'package') {
    return [{
      testId: detail.testId, testName: detail.testName, department: detail.department,
      status: 'pending' as const, specimen: detail.specimen, price: detail.price,
      commissionType: detail.commissionType, commissionValue: detail.commissionValue,
      commissionAmount: commissionForTest(detail, isReferral),
      averageCost: detail.averageCost ?? 0,
      staffBonusType: detail.staffBonusType ?? 'none',
      staffBonusValue: detail.staffBonusValue ?? 0,
      staffBonusAmount: staffBonusFor(detail.price, detail.staffBonusType ?? 'none', detail.staffBonusValue ?? 0),
    }];
  }

  const memberIds = [...new Set(detail.investigationIds ?? [])];
  const missing = memberIds.filter((id) => !catalogue.some((candidate) => candidate.id === id && !isInvestigationPackage(candidate)));
  if (missing.length > 0) {
    throw new Error(`Package "${detail.testName}" is incomplete. Missing investigation${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`);
  }
  const members = memberIds.flatMap((id) => {
    const test = catalogue.find((candidate) => candidate.id === id && !isInvestigationPackage(candidate));
    return test ? [test] : [];
  });
  return members.map((member, index) => {
    const memberPrice = testPrices.find((price) => price.test_id === member.id);
    const bonusType = memberPrice?.staff_bonus_type ?? 'none';
    const bonusValue = memberPrice?.staff_bonus_value ?? 0;
    return ({
    testId: member.id, testName: member.name, department: member.department,
    status: 'pending' as const, specimen: member.specimen,
    price: index === 0 ? detail.price : 0,
    commissionType: index === 0 ? detail.commissionType : 'none',
    commissionValue: index === 0 ? detail.commissionValue : 0,
    commissionAmount: index === 0 ? commissionForTest(detail, isReferral) : 0,
    averageCost: memberPrice?.average_cost ?? 0,
    staffBonusType: bonusType,
    staffBonusValue: bonusValue,
    staffBonusAmount: staffBonusFor(memberPrice?.price ?? 0, bonusType, bonusValue),
    packageId: detail.testId,
    packageName: detail.testName,
  });
  });
});

export const paymentStatusFor = (amountPaid: number, netBill: number): 'paid' | 'partial' | 'unpaid' => {
  if (amountPaid >= netBill) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
};

/** A doctor or facility selection of 'none' means an explicit walk-in, not a referral. */
export const isReferralVisit = (selectedDoctorId: string, selectedFacilityId: string): boolean =>
  !!(selectedDoctorId && selectedDoctorId !== 'none') || !!(selectedFacilityId && selectedFacilityId !== 'none');
