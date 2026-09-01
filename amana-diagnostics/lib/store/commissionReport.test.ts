import { describe, it, expect } from 'vitest';
import { buildCommissionReport } from './commissionReport';
import type { Patient, ReferringDoctor, ReferringFacility, TestPrice } from '@/lib/store';

const patient = (over: Partial<Patient> = {}): Patient => ({
  id: 1,
  slipNumber: 'ATD-0001',
  registeredAt: '2026-07-15T10:00:00.000Z',
  name: 'Musa Bello',
  firstName: 'Musa',
  surname: 'Bello',
  age: '35yrs',
  sex: 'Male',
  phone: '08030000000',
  address: 'Kano',
  referredBy: 'Dr. Bello',
  commissionAssigned: true,
  commissionAmount: 500,
  tests: [{ testId: 'fbc', testName: 'Full Blood Count', department: 'lab', status: 'completed', price: 5000, commissionAmount: 500 }],
  ...over,
}) as Patient;

const doctors: ReferringDoctor[] = [
  { id: 'doc-1', organization_id: 'org-1', name: 'Adamu', commission_type: 'percentage', commission_value: 10, is_active: true, created_at: '' },
];
const facilities: ReferringFacility[] = [
  { id: 'fac-1', organization_id: 'org-1', name: 'City General', commission_type: 'flat', commission_value: 500, is_active: true, created_at: '' },
];
const prices: TestPrice[] = [
  { organization_id: 'org-1', test_id: 'fbc', test_name: 'Full Blood Count', price: 7000 },
];

const build = (patients: Patient[], range = {}) =>
  buildCommissionReport(patients, prices, doctors, facilities, range);

describe('Which visits appear on the commission report', () => {
  it('includes only visits that were assigned a commission', () => {
    const withCommission = patient({ id: 1 });
    const without = patient({ id: 2, commissionAssigned: false });

    expect(build([withCommission, without]).map(e => e.patientId)).toEqual([1]);
  });

  it('excludes visits before the start of the range', () => {
    const june = patient({ id: 1, registeredAt: '2026-06-01T10:00:00.000Z' });
    const july = patient({ id: 2, registeredAt: '2026-07-15T10:00:00.000Z' });

    expect(build([june, july], { from: '2026-07-01' }).map(e => e.patientId)).toEqual([2]);
  });

  it('excludes visits after the end of the range', () => {
    const july = patient({ id: 1, registeredAt: '2026-07-15T10:00:00.000Z' });
    const august = patient({ id: 2, registeredAt: '2026-08-15T10:00:00.000Z' });

    expect(build([july, august], { to: '2026-08-01' }).map(e => e.patientId)).toEqual([1]);
  });

  it('returns everything commissioned when no range is given', () => {
    expect(build([patient({ id: 1 }), patient({ id: 2 })])).toHaveLength(2);
  });
});

describe('Naming the referrer', () => {
  it('uses the doctor on file when the visit links to one', () => {
    const entry = build([patient({ referringDoctorId: 'doc-1' })])[0];

    expect(entry.referrerName).toBe('Adamu');
    expect(entry.referrerType).toBe('doctor');
  });

  it('uses the facility on file when the visit links to one', () => {
    const entry = build([patient({ referringFacilityId: 'fac-1', referredBy: '' })])[0];

    expect(entry.referrerName).toBe('City General');
    expect(entry.referrerType).toBe('facility');
  });

  it('prefers the doctor when a visit links to both', () => {
    const entry = build([patient({ referringDoctorId: 'doc-1', referringFacilityId: 'fac-1' })])[0];

    expect(entry.referrerName).toBe('Adamu');
  });

  // A referrer can be deleted after the visit; the report must still name someone.
  it('falls back to the name captured at registration when the doctor is gone', () => {
    const entry = build([patient({ referringDoctorId: 'deleted-doc' })])[0];

    expect(entry.referrerName).toBe('Dr. Bello');
  });

  it('falls back to the free-text facility when there is no linked referrer', () => {
    const entry = build([patient({ referredBy: '', referringFacility: 'Walk-in Clinic' })])[0];

    expect(entry.referrerName).toBe('Walk-in Clinic');
    expect(entry.referrerType).toBe('facility');
  });

  it('shows a dash rather than blank when nothing identifies the referrer', () => {
    const entry = build([patient({ referredBy: '', referringFacility: undefined })])[0];

    expect(entry.referrerName).toBe('—');
  });
});

describe('Valuing the visit', () => {
  // Re-pricing a test must not retroactively change what an old visit was worth.
  it('uses the price recorded on the visit, not the current price list', () => {
    const entry = build([patient()])[0];

    expect(entry.tests[0].price).toBe(5000);
    expect(entry.totalAmount).toBe(5000);
  });

  it('falls back to the current price list when the visit recorded none', () => {
    const noPrice = patient({
      tests: [{ testId: 'fbc', testName: 'Full Blood Count', department: 'lab', status: 'completed' }],
    });

    expect(build([noPrice])[0].tests[0].price).toBe(7000);
  });

  it('values a test at zero when neither the visit nor the price list knows it', () => {
    const unknown = patient({
      tests: [{ testId: 'ghost', testName: 'Unknown', department: 'lab', status: 'completed' }],
    });

    expect(build([unknown])[0].tests[0].price).toBe(0);
  });

  it('totals every test on the visit', () => {
    const two = patient({
      tests: [
        { testId: 'fbc', testName: 'FBC', department: 'lab', status: 'completed', price: 5000 },
        { testId: 'usg', testName: 'Ultrasound', department: 'radiology', status: 'completed', price: 12000 },
      ],
    });

    expect(build([two])[0].totalAmount).toBe(17000);
  });

  it('carries the commission recorded at registration', () => {
    expect(build([patient({ commissionAmount: 1750 })])[0].commissionAmount).toBe(1750);
  });

  it('reports a visit with no recorded commission as zero, not undefined', () => {
    expect(build([patient({ commissionAmount: undefined })])[0].commissionAmount).toBe(0);
  });

  it('copes with a visit that has no tests at all', () => {
    const entry = build([patient({ tests: [] })])[0];

    expect(entry.tests).toEqual([]);
    expect(entry.totalAmount).toBe(0);
  });
});

describe('Settlement status', () => {
  it('treats an unsettled commission as pending', () => {
    expect(build([patient({ commissionStatus: undefined })])[0].commissionStatus).toBe('pending');
  });

  it('carries a settled commission through with its payment details', () => {
    const paid = patient({
      commissionStatus: 'paid',
      commissionPaidAt: '2026-08-01T09:00:00.000Z',
      commissionPaidNotes: 'Bank transfer',
    });
    const entry = build([paid])[0];

    expect(entry.commissionStatus).toBe('paid');
    expect(entry.commissionPaidAt).toBe('2026-08-01T09:00:00.000Z');
    expect(entry.commissionPaidNotes).toBe('Bank transfer');
  });
});
