import { Test, TestPrice } from '@/lib/store';

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

export const paymentStatusFor = (amountPaid: number, netBill: number): 'paid' | 'partial' | 'unpaid' => {
  if (amountPaid >= netBill) return 'paid';
  if (amountPaid > 0) return 'partial';
  return 'unpaid';
};

/** A doctor or facility selection of 'none' means an explicit walk-in, not a referral. */
export const isReferralVisit = (selectedDoctorId: string, selectedFacilityId: string): boolean =>
  !!(selectedDoctorId && selectedDoctorId !== 'none') || !!(selectedFacilityId && selectedFacilityId !== 'none');
