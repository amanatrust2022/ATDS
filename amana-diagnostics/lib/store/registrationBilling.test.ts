import { describe, it, expect } from 'vitest';
import { Test, TestPrice } from '@/lib/store';
import {
  buildSelectedTestDetails, calculateSubtotal, calculateDiscountAmount,
  commissionForTest, calculateTotalCommission, paymentStatusFor, isReferralVisit,
  SelectedTestDetail,
} from './registrationBilling';

const catalogue: Test[] = [
  { id: 'fbc', name: 'Full Blood Count', department: 'lab', category: 'Haematology', specimen: 'Blood', parameters: [] } as unknown as Test,
  { id: 'usg', name: 'Abdominal Ultrasound', department: 'radiology', category: 'Ultrasound', specimen: 'N/A', parameters: [] } as unknown as Test,
];

const prices: TestPrice[] = [
  { organization_id: 'org-1', test_id: 'fbc', test_name: 'Full Blood Count', price: 5000, commission_type: 'percentage', commission_value: 10 },
  { organization_id: 'org-1', test_id: 'usg', test_name: 'Abdominal Ultrasound', price: 12000, commission_type: 'flat', commission_value: 1500 },
];

const detail = (over: Partial<SelectedTestDetail> = {}): SelectedTestDetail => ({
  testId: 'fbc', testName: 'Full Blood Count', department: 'lab', specimen: 'Blood',
  price: 5000, commissionType: 'percentage', commissionValue: 10, ...over,
});

describe('buildSelectedTestDetails', () => {
  it('joins selected ids against the catalogue and price list', () => {
    const details = buildSelectedTestDetails(['fbc', 'usg'], catalogue, prices);
    expect(details).toHaveLength(2);
    expect(details[0].testName).toBe('Full Blood Count');
    expect(details[0].price).toBe(5000);
    expect(details[1].commissionType).toBe('flat');
  });

  it('falls back to a zero price when the test has no price entry', () => {
    const details = buildSelectedTestDetails(['fbc'], catalogue, []);
    expect(details[0].price).toBe(0);
    expect(details[0].commissionType).toBe('none');
    expect(details[0].commissionValue).toBe(0);
  });

  it('skips ids that are not in the catalogue instead of throwing', () => {
    expect(buildSelectedTestDetails(['ghost'], catalogue, prices)).toEqual([]);
  });
});

describe('calculateSubtotal', () => {
  it('sums the line prices', () => {
    expect(calculateSubtotal([detail({ price: 5000 }), detail({ price: 12000 })])).toBe(17000);
  });

  it('is zero for an empty selection', () => {
    expect(calculateSubtotal([])).toBe(0);
  });
});

describe('calculateDiscountAmount', () => {
  it('takes a percentage of the subtotal', () => {
    expect(calculateDiscountAmount(20000, 'percentage', '10')).toBe(2000);
  });

  it('takes a flat amount as given', () => {
    expect(calculateDiscountAmount(20000, 'flat', '2500')).toBe(2500);
  });

  it('is zero when no discount is applied', () => {
    expect(calculateDiscountAmount(20000, 'none', '10')).toBe(0);
  });

  it('treats a blank or non-numeric value as zero', () => {
    expect(calculateDiscountAmount(20000, 'percentage', '')).toBe(0);
    expect(calculateDiscountAmount(20000, 'flat', 'abc')).toBe(0);
  });
});

describe('commissionForTest', () => {
  it('takes a percentage of the line price', () => {
    expect(commissionForTest(detail({ price: 5000, commissionType: 'percentage', commissionValue: 10 }), true)).toBe(500);
  });

  it('takes a flat commission as given', () => {
    expect(commissionForTest(detail({ commissionType: 'flat', commissionValue: 1500 }), true)).toBe(1500);
  });

  it('pays nothing when the visit is not a referral', () => {
    expect(commissionForTest(detail(), false)).toBe(0);
  });

  it('pays nothing when the test carries no commission', () => {
    expect(commissionForTest(detail({ commissionType: 'none', commissionValue: 10 }), true)).toBe(0);
  });
});

describe('calculateTotalCommission', () => {
  it('sums commission across lines of mixed type', () => {
    const details = [
      detail({ price: 5000, commissionType: 'percentage', commissionValue: 10 }),
      detail({ testId: 'usg', price: 12000, commissionType: 'flat', commissionValue: 1500 }),
    ];
    expect(calculateTotalCommission(details, true)).toBe(2000);
  });

  it('is zero for a non-referral visit', () => {
    expect(calculateTotalCommission([detail()], false)).toBe(0);
  });
});

describe('paymentStatusFor', () => {
  it('is paid when the full amount is covered', () => {
    expect(paymentStatusFor(5000, 5000)).toBe('paid');
  });

  it('is paid when more than the bill is tendered', () => {
    expect(paymentStatusFor(6000, 5000)).toBe('paid');
  });

  it('is partial when something but not everything is paid', () => {
    expect(paymentStatusFor(2000, 5000)).toBe('partial');
  });

  it('is unpaid when nothing is paid', () => {
    expect(paymentStatusFor(0, 5000)).toBe('unpaid');
  });
});

describe('isReferralVisit', () => {
  it('is a referral when a doctor is selected', () => {
    expect(isReferralVisit('doc-1', '')).toBe(true);
  });

  it('is a referral when only a facility is selected', () => {
    expect(isReferralVisit('', 'fac-1')).toBe(true);
  });

  it('treats the explicit walk-in sentinel as not a referral', () => {
    expect(isReferralVisit('none', 'none')).toBe(false);
  });

  it('is not a referral when nothing is selected', () => {
    expect(isReferralVisit('', '')).toBe(false);
  });
});
