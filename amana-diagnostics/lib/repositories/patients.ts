import { createClient } from '@/lib/supabase';
import { RuntimeMode, RUNTIME_MODE } from '@/lib/runtimeMode';
import { postJson } from './localHttp';
import {
  formatSlipNumber, slipPrefixFor, generatePatientId,
  toPatient, toPatientProfile, toProfileRow, toPatientRow, toPatientRowWithBilling,
  toTestRows, toTestRowsWithBilling,
} from './patientMappers';
import { isMissingFunction, parseInsufficientFunds, formatNaira } from './rpcErrors';
import type { Patient, PatientProfile, PatientTest } from '@/lib/store';

type NewPatient = Omit<Patient, 'id' | 'tests'> & { id?: number };
type NewTest = Omit<PatientTest, 'id' | 'patient_id'>;

export interface PatientsRepository {
  nextSlipNumber(organizationId: string): Promise<string>;
  list(organizationId: string): Promise<Patient[]>;
  listProfiles(organizationId: string): Promise<PatientProfile[]>;
  add(patient: NewPatient, tests: NewTest[], organizationId: string): Promise<void>;
  /**
   * Registration proper: also takes payment and records the commission snapshot.
   * Returns the new patient's id so the caller can put the row on screen
   * immediately instead of refetching the whole queue.
   */
  addWithReferral(patient: NewPatient, tests: NewTest[], organizationId: string): Promise<number | string>;
  registerAndGetId(patient: Omit<Patient, 'id' | 'tests'>, organizationId: string): Promise<number | string>;
  update(id: number | string, updates: Partial<Patient>): Promise<void>;
  updateTestResult(testId: string, updates: Partial<PatientTest>): Promise<void>;
  /** Calls back on any change to this organisation's data. Returns an unsubscribe. */
  subscribe(organizationId: string, callback: () => void): () => void;
}

const ENDPOINT = '/api/patients';

// ─── LOCAL (on-premise hub) ───────────────────────────────────────────────────

export const localPatientsRepository: PatientsRepository = {
  async nextSlipNumber(organizationId) {
    const res = await fetch(`${ENDPOINT}?organizationId=${organizationId}`);
    const patients = await res.json();
    const today = new Date();
    const prefix = slipPrefixFor(today);
    // Counted from slips actually issued today, so a restored backup does not reissue numbers.
    const issuedToday = patients.filter((p: any) => p.slipNumber && p.slipNumber.startsWith(prefix));
    return formatSlipNumber(today, issuedToday.length + 1);
  },

  async list(organizationId) {
    const res = await fetch(`${ENDPOINT}?organizationId=${organizationId}`);
    return res.json();
  },

  async listProfiles(organizationId) {
    const res = await fetch(`${ENDPOINT}?action=getPatientProfiles&organizationId=${organizationId}`);
    if (!res.ok) return [];
    return res.json();
  },

  async add(patient, tests, organizationId) {
    await postJson(ENDPOINT, { action: 'addPatient', patient, tests, organizationId }, 'Failed to add patient locally');
  },

  async addWithReferral(patient, tests, organizationId) {
    const res = await postJson(ENDPOINT, { action: 'addPatient', patient, tests, organizationId }, 'Failed to add patient referral locally');
    const data = await res.json();
    return data.id;
  },

  async registerAndGetId(patient, organizationId) {
    const res = await postJson(ENDPOINT, { action: 'addPatient', patient, tests: [], organizationId }, 'Failed to register patient locally');
    const data = await res.json();
    return data.id;
  },

  async update(id, updates) {
    await postJson(ENDPOINT, { action: 'updatePatient', patientId: id, updates }, 'Failed to update patient locally');
  },

  async updateTestResult(testId, updates) {
    await postJson(ENDPOINT, { action: 'updateTestResult', testId, updates }, 'Failed to update test result locally');
  },

  subscribe(_organizationId, callback) {
    // No realtime channel on the hub; poll instead.
    const interval = setInterval(callback, 5000);
    return () => clearInterval(interval);
  },
};

// ─── CLOUD (Supabase) ─────────────────────────────────────────────────────────

/** Tables whose changes should refresh a reception or department screen. */
const REALTIME_TABLES = [
  'patients',
  'patient_tests',
  'billing_accounts',
  'billing_ledger_transactions',
  'external_department_charges',
];

/** The fallback write path is not part of the interface; only this implementation has one. */
type CloudPatientsRepository = PatientsRepository & {
  addWithReferralSequentially(patient: NewPatient, tests: NewTest[], organizationId: string): Promise<number | string>;
};

export const cloudPatientsRepository: CloudPatientsRepository = {
  async nextSlipNumber(organizationId) {
    const supabase = createClient();
    const today = new Date();
    // Counted by registration timestamp rather than by slip prefix.
    const { count } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .gte('registered_at', new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString());
    return formatSlipNumber(today, (count || 0) + 1);
  },

  async list(organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('patients')
      .select('*, tests:patient_tests(*)')
      .eq('organization_id', organizationId)
      .order('registered_at', { ascending: false });
    if (error) { console.error('Error fetching patients:', error); return []; }
    return (data || []).map(toPatient);
  },

  async listProfiles(organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('patient_profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) { console.error('Error fetching patient profiles:', error); return []; }
    return (data || []).map(toPatientProfile);
  },

  async add(patient, tests, organizationId) {
    const supabase = createClient();
    const patientId = patient.id || generatePatientId();
    let profileId = patient.patientProfileId;

    // A returning patient already has a profile; a new one needs creating first.
    if (!profileId) {
      profileId = generatePatientId();
      const { error } = await supabase.from('patient_profiles').insert([toProfileRow(patient, profileId, organizationId)]);
      if (error) throw error;
    }

    const { error: pError } = await supabase
      .from('patients')
      .insert([toPatientRow(patient, patientId, profileId, organizationId)]);
    if (pError) throw pError;

    const { error: tError } = await supabase.from('patient_tests').insert(toTestRows(tests, patientId, organizationId));
    if (tError) throw tError;
  },

  /**
   * Creates the visit and takes payment in one transaction, via the
   * `register_patient_with_wallet` Postgres function (supabase_wallet_atomicity.sql).
   *
   * If that function is not deployed yet, falls back to the previous sequential
   * writes so an app release cannot outrun the migration. The fallback is NOT
   * atomic: a failure after the debit charges a patient for a visit that was
   * never created.
   */
  async addWithReferral(patient, tests, organizationId) {
    const supabase = createClient();
    const patientId = patient.id || generatePatientId();
    const isReturningPatient = !!patient.patientProfileId;
    const profileId = patient.patientProfileId || generatePatientId();
    const payingFromWallet = patient.paymentMethod === 'wallet' && !!patient.billingAccountId;
    const now = new Date().toISOString();

    const { error } = await supabase.rpc('register_patient_with_wallet', {
      p_profile: isReturningPatient ? null : toProfileRow(patient, profileId, organizationId),
      p_patient: toPatientRowWithBilling(patient, patientId, profileId, organizationId),
      p_tests: toTestRowsWithBilling(tests, patientId, organizationId),
      p_ledger: payingFromWallet ? {
        id: crypto.randomUUID(),
        organization_id: organizationId,
        billing_account_id: patient.billingAccountId,
        patient_id: patientId,
        type: 'charge',
        amount: -(patient.netAmount || 0),
        description: `Diagnostics Charge - Slip: ${patient.slipNumber}`,
        reference_id: patient.slipNumber,
        payment_method: 'wallet',
        created_by: 'Reception Desk',
        created_at: now,
      } : null,
    });

    if (!error) return patientId;

    if (isMissingFunction(error)) {
      console.warn(
        '[patients] register_patient_with_wallet is not deployed; falling back to ' +
        'non-atomic writes. Apply supabase_wallet_atomicity.sql to fix this.',
      );
      return cloudPatientsRepository.addWithReferralSequentially(patient, tests, organizationId);
    }

    const shortfall = parseInsufficientFunds(error);
    if (shortfall) {
      throw new Error(`Insufficient wallet balance on "${shortfall.name}". Available: ${formatNaira(shortfall.available)}`);
    }
    if (/BILLING_ACCOUNT_NOT_FOUND/.test(error.message || '')) {
      throw new Error('Billing account not found');
    }
    throw new Error(error.message || 'Failed to register patient');
  },

  /**
   * The pre-atomicity write path, kept only as the fallback for a database
   * where the function has not been applied yet.
   */
  async addWithReferralSequentially(patient: NewPatient, tests: NewTest[], organizationId: string) {
    const supabase = createClient();
    const patientId = patient.id || generatePatientId();
    let profileId = patient.patientProfileId;

    if (!profileId) {
      profileId = generatePatientId();
      const { error } = await supabase.from('patient_profiles').insert([toProfileRow(patient, profileId, organizationId)]);
      if (error) throw error;
    }

    const payingFromWallet = patient.paymentMethod === 'wallet' && !!patient.billingAccountId;

    if (payingFromWallet) {
      const { data: acc, error: accErr } = await supabase
        .from('billing_accounts')
        .select('balance, credit_limit, name')
        .eq('id', patient.billingAccountId)
        .single();
      if (accErr) throw accErr;

      const available = (acc.balance || 0) + (acc.credit_limit || 0);
      const netAmount = patient.netAmount || 0;
      if (available < netAmount) {
        throw new Error(`Insufficient wallet balance on "${acc.name}". Available: ₦${available.toLocaleString('en-NG')}`);
      }

      const { error: upErr } = await supabase
        .from('billing_accounts')
        .update({ balance: (acc.balance || 0) - netAmount, updated_at: new Date().toISOString() })
        .eq('id', patient.billingAccountId);
      if (upErr) throw upErr;
    }

    const { error: pError } = await supabase
      .from('patients')
      .insert([toPatientRowWithBilling(patient, patientId, profileId, organizationId)]);
    if (pError) throw pError;

    if (payingFromWallet) {
      const { error: txError } = await supabase.from('billing_ledger_transactions').insert([{
        id: crypto.randomUUID(),
        organization_id: organizationId,
        billing_account_id: patient.billingAccountId,
        patient_id: patientId,
        type: 'charge',
        amount: -(patient.netAmount || 0),
        description: `Diagnostics Charge - Slip: ${patient.slipNumber}`,
        reference_id: patient.slipNumber,
        payment_method: 'wallet',
        created_by: 'Reception Desk',
        created_at: new Date().toISOString(),
      }]);
      if (txError) throw txError;
    }

    const { error: tError } = await supabase
      .from('patient_tests')
      .insert(toTestRowsWithBilling(tests, patientId, organizationId));
    if (tError) throw tError;

    return patientId;
  },

  async registerAndGetId(patient, organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('patients')
      .insert([{
        slip_number: patient.slipNumber,
        first_name: patient.firstName,
        surname: patient.surname,
        middle_name: patient.middleName || null,
        age: patient.age,
        sex: patient.sex,
        phone: patient.phone,
        email: patient.email || null,
        address: patient.address,
        referred_by: patient.referredBy || null,
        referring_facility: patient.referringFacility || null,
        referring_doctor_id: patient.referringDoctorId || null,
        referring_facility_id: patient.referringFacilityId || null,
        organization_id: organizationId,
        billing_account_id: patient.billingAccountId || null,
      }])
      .select()
      .single();
    if (error) throw error;
    return (data as any).id;
  },

  async update(id, updates) {
    const supabase = createClient();
    // Only the editable biodata and referral fields; billing is never changed here.
    const { error } = await supabase.from('patients').update({
      first_name: updates.firstName,
      surname: updates.surname,
      middle_name: updates.middleName,
      age: updates.age,
      sex: updates.sex,
      phone: updates.phone,
      email: updates.email,
      address: updates.address,
      referred_by: updates.referredBy,
      referring_facility: updates.referringFacility,
    }).eq('id', id);
    if (error) throw error;
  },

  async updateTestResult(testId, updates) {
    const supabase = createClient();
    const { error } = await supabase
      .from('patient_tests')
      .update({
        status: updates.status,
        results: updates.results,
        completed_by: updates.completedBy,
        completed_by_signature_url: updates.completedBySignatureUrl,
        completed_by_title: updates.completedByTitle,
        completed_at: updates.completedAt,
        notes: updates.notes,
        specimen: updates.specimen,
      })
      .eq('id', testId);
    if (error) throw error;
  },

  subscribe(organizationId, callback) {
    const supabase = createClient();
    const channel = REALTIME_TABLES.reduce(
      (ch, table) => ch.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table, filter: `organization_id=eq.${organizationId}` },
        callback,
      ),
      supabase.channel(`patients-org-${organizationId}`) as any,
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  },
};

export const getPatientsRepository = (mode: RuntimeMode = RUNTIME_MODE): PatientsRepository =>
  mode === 'local' ? localPatientsRepository : cloudPatientsRepository;
