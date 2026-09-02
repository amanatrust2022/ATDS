import type { Patient, PatientProfile, PatientTest } from '@/lib/store';

/**
 * Translation between the app's camelCase domain objects and Postgres'
 * snake_case columns, plus the slip-number format.
 *
 * The local hub stores and returns the domain shape already, so only the cloud
 * implementation needs these. They are pure, so they are tested directly.
 */

/** `ATD/YYYYMMDD/NNNN` — the number printed on the patient's slip. */
export const formatSlipNumber = (date: Date, sequence: number): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `ATD/${y}${m}${d}/${String(sequence).padStart(4, '0')}`;
};

/** The `ATD/YYYYMMDD/` prefix every slip issued on the given day shares. */
export const slipPrefixFor = (date: Date): string => formatSlipNumber(date, 0).slice(0, -4);

/** Patient ids are client-generated 8-digit numbers, not database sequences. */
export const generatePatientId = (): number => Math.floor(10000000 + Math.random() * 90000000);

export const toPatientTest = (t: any): PatientTest => ({
  ...t,
  testId: t.test_id,
  testName: t.test_name,
  completedBy: t.completed_by,
  completedBySignatureUrl: t.completed_by_signature_url,
  completedByTitle: t.completed_by_title,
  completedAt: t.completed_at,
  price: t.price,
  commissionType: t.commission_type,
  commissionValue: t.commission_value,
  commissionAmount: t.commission_amount,
});

export const toPatient = (p: any): Patient => ({
  ...p,
  slipNumber: p.slip_number,
  registeredAt: p.registered_at,
  firstName: p.first_name,
  surname: p.surname,
  middle_name: p.middle_name,
  referredBy: p.referred_by,
  referringFacility: p.referring_facility,
  referringDoctorId: p.referring_doctor_id,
  referringFacilityId: p.referring_facility_id,
  commissionAssigned: p.commission_assigned,
  commissionType: p.commission_type,
  commissionValue: p.commission_value,
  commissionAmount: p.commission_amount,
  commissionStatus: p.commission_status,
  commissionPaidAt: p.commission_paid_at,
  commissionPaidNotes: p.commission_paid_notes,
  totalAmount: p.total_amount,
  discountType: p.discount_type,
  discountValue: p.discount_value,
  discountAmount: p.discount_amount,
  netAmount: p.net_amount,
  paidAmount: p.paid_amount,
  paymentStatus: p.payment_status,
  paymentMethod: p.payment_method,
  billingAccountId: p.billing_account_id,
  patientProfileId: p.patient_profile_id,
  tests: (p.tests || []).map(toPatientTest),
});

export const toPatientProfile = (p: any): PatientProfile => ({
  id: p.id,
  organizationId: p.organization_id,
  firstName: p.first_name,
  surname: p.surname,
  middleName: p.middle_name,
  phone: p.phone,
  email: p.email,
  address: p.address,
  sex: p.sex,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

export const toProfileRow = (patient: Partial<Patient>, profileId: number, organizationId: string) => ({
  id: profileId,
  organization_id: organizationId,
  first_name: patient.firstName,
  surname: patient.surname,
  middle_name: patient.middleName || null,
  phone: patient.phone,
  email: patient.email || null,
  address: patient.address,
  sex: patient.sex,
});

/** The identity and referral columns every patient insert writes. */
const identityColumns = (patient: Partial<Patient>, organizationId: string) => ({
  slip_number: patient.slipNumber,
  // The display name the queue, the search box and the slip all read. It is a
  // real column — `update()` has always written it — but registration never did,
  // so every patient showed a blank name until someone edited them, and a search
  // by name matched nothing.
  name: patient.name || [patient.firstName, patient.middleName, patient.surname].filter(Boolean).join(' '),
  first_name: patient.firstName,
  surname: patient.surname,
  age: patient.age,
  sex: patient.sex,
  phone: patient.phone,
  address: patient.address,
  referring_doctor_id: patient.referringDoctorId || null,
  referring_facility_id: patient.referringFacilityId || null,
  organization_id: organizationId,
  billing_account_id: patient.billingAccountId || null,
});

export const toPatientRow = (
  patient: Partial<Patient>,
  patientId: number,
  profileId: number | null | undefined,
  organizationId: string,
) => ({
  ...identityColumns(patient, organizationId),
  id: patientId,
  // registered_at is deliberately not written: the column default stamps it
  // server-side, which is proven working and does not trust a client clock.
  patient_profile_id: profileId,
  middle_name: patient.middleName,
  email: patient.email,
  referred_by: patient.referredBy,
  referring_facility: patient.referringFacility,
});

/** As above, plus the commission and billing snapshot taken at registration. */
export const toPatientRowWithBilling = (
  patient: Partial<Patient>,
  patientId: number,
  profileId: number | null | undefined,
  organizationId: string,
) => ({
  ...toPatientRow(patient, patientId, profileId, organizationId),
  commission_assigned: patient.commissionAssigned ?? false,
  commission_type: patient.commissionType || null,
  commission_value: patient.commissionValue ?? null,
  commission_amount: patient.commissionAmount ?? null,
  commission_status: patient.commissionAssigned ? 'pending' : null,
  total_amount: patient.totalAmount ?? 0,
  discount_type: patient.discountType || 'none',
  discount_value: patient.discountValue ?? 0,
  discount_amount: patient.discountAmount ?? 0,
  net_amount: patient.netAmount ?? 0,
  paid_amount: patient.paidAmount ?? 0,
  payment_status: patient.paymentStatus || 'paid',
  payment_method: patient.paymentMethod || 'cash',
});

export const toTestRows = (
  tests: Omit<PatientTest, 'id' | 'patient_id'>[],
  patientId: number,
  organizationId: string,
) => tests.map(t => ({
  patient_id: patientId,
  test_id: t.testId,
  test_name: t.testName,
  department: t.department,
  status: t.status,
  specimen: t.specimen,
  organization_id: organizationId,
}));

/** As above, plus the per-test price and commission snapshot. */
export const toTestRowsWithBilling = (
  tests: Omit<PatientTest, 'id' | 'patient_id'>[],
  patientId: number,
  organizationId: string,
) => tests.map(t => ({
  ...toTestRows([t], patientId, organizationId)[0],
  price: t.price ?? 0,
  commission_type: t.commissionType || 'none',
  commission_value: t.commissionValue ?? 0,
  commission_amount: t.commissionAmount ?? 0,
}));
