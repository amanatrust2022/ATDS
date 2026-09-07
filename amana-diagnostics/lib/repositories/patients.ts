import { createClient } from '@/lib/supabase';
import { RuntimeMode, RUNTIME_MODE } from '@/lib/runtimeMode';
import { postJson } from './localHttp';
import {
  formatSlipNumber, slipPrefixFor,
  toPatient, toPatientProfile, toProfileRow, toPatientRow, toPatientRowWithBilling,
  toTestRows, toTestRowsWithBilling,
} from './patientMappers';
import { isMissingFunction, parseInsufficientFunds, formatNaira } from './rpcErrors';
import { allocatePatientId, withSlipNumberRetry } from './patientIds';
import type { Patient, PatientProfile, PatientTest } from '@/lib/store';

type NewPatient = Omit<Patient, 'id' | 'tests'> & { id?: number };
type NewTest = Omit<PatientTest, 'id' | 'patient_id'>;

/**
 * Narrows what `list` returns.
 *
 * Every screen used to load the entire history of the clinic and then filter it
 * in the browser, on every change to any of five tables. The cost of that grows
 * with how long the centre has been open rather than with how busy today is, so
 * the system got slower every day it ran. These are the bounds the screens
 * actually want; the database applies them.
 *
 * An empty query still means everything, for the callers that genuinely need it
 * (the commission report over a chosen period, the admin patient list).
 */
export interface PatientQuery {
  /** ISO timestamp. Only patients registered at or after this moment. */
  since?: string;
  /** ISO timestamp. Only patients registered at or before this moment. */
  until?: string;
  /**
   * Only patients with at least one test in this department, carrying only
   * that department's tests. Safe because a department screen never reads
   * another department's tests.
   */
  department?: string;
  /** Only patients attached to a wallet, of any age. Used by the billing screens. */
  withBillingAccount?: boolean;
  /**
   * Free-text match on name or phone, across all patients regardless of date.
   * The wallet screens need to find someone seen months ago, which is why they
   * cannot simply search whatever the queue happens to be showing.
   */
  search?: string;
  /** Caps the rows returned. Always set one on a search. */
  limit?: number;
  /**
   * Every visit belonging to one permanent patient record, of any age.
   * Registration needs a returning patient's history to carry their age and
   * their wallet forward, and that history is older than any date window the
   * queue is showing.
   */
  patientProfileId?: number | string;
}

export interface PatientsRepository {
  nextSlipNumber(organizationId: string): Promise<string>;
  list(organizationId: string, query?: PatientQuery): Promise<Patient[]>;
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
  /** Corrects the permanent record a returning patient is recognised by. */
  updateProfile(profileId: number | string, updates: Partial<Patient>, organizationId: string): Promise<void>;
  updateTestResult(testId: string, updates: Partial<PatientTest>): Promise<void>;
  /** Calls back on any change to this organisation's data. Returns an unsubscribe. */
  subscribe(organizationId: string, callback: () => void): () => void;
}

const ENDPOINT = '/api/patients';

/** The one place a PatientQuery becomes a query string, so both ends agree. */
export function patientQueryParams(organizationId: string, query: PatientQuery = {}): string {
  const params = new URLSearchParams({ organizationId });
  if (query.since) params.set('since', query.since);
  if (query.until) params.set('until', query.until);
  if (query.department) params.set('department', query.department);
  if (query.withBillingAccount) params.set('withBillingAccount', '1');
  if (query.search) params.set('search', query.search);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.patientProfileId != null) params.set('patientProfileId', String(query.patientProfileId));
  return params.toString();
}

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

  async list(organizationId, query = {}) {
    const res = await fetch(`${ENDPOINT}?${patientQueryParams(organizationId, query)}`);
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
    // The hub settles the slip number under its write lock and may have moved
    // it on, so the slip about to be printed must be the one it recorded.
    if (data.slipNumber) patient.slipNumber = data.slipNumber;
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

  async updateProfile(profileId, updates, organizationId) {
    await postJson(
      ENDPOINT,
      { action: 'updatePatientProfile', profileId, updates, organizationId },
      'Failed to update patient profile locally',
    );
  },

  async updateTestResult(testId, updates) {
    await postJson(ENDPOINT, { action: 'updateTestResult', testId, updates }, 'Failed to update test result locally');
  },

  subscribe(organizationId, callback) {
    // No realtime channel on the hub, so it polls — but it polls a cheap
    // version stamp rather than reloading the whole queue every five seconds,
    // which is what it used to do on every open screen, forever.
    let lastVersion: string | null = null;
    let stopped = false;

    const check = async () => {
      try {
        const res = await fetch(`${ENDPOINT}?action=version&organizationId=${organizationId}`);
        if (!res.ok || stopped) return;
        const { version } = await res.json();
        if (lastVersion !== null && version !== lastVersion) callback();
        lastVersion = version;
      } catch {
        // Offline or the hub is restarting; the next tick tries again.
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => { stopped = true; clearInterval(interval); };
  },
};

/**
 * Collapses a burst of changes into one call.
 *
 * Registering a patient with five tests writes to three tables and produces
 * roughly seven separate realtime events. Each of those used to reload
 * everything on every open screen in the building. They now arrive as one.
 */
export function debounce(fn: () => void, ms: number): (() => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
  run.cancel = () => { if (timer) clearTimeout(timer); };
  return run;
}

/** How long to wait for a burst to finish. Long enough to catch the tail of a
 *  registration, short enough that the queue still feels live. */
export const REALTIME_DEBOUNCE_MS = 400;

/**
 * How often to re-read the queue while the realtime channel is down. Slow
 * enough not to be the old five-second whole-clinic refetch, often enough that
 * a result reaching reception is noticed within a patient's patience.
 */
export const REALTIME_FALLBACK_POLL_MS = 20000;

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

  async list(organizationId, query = {}) {
    const supabase = createClient();

    // `!inner` makes the department a condition on the patient, not just a
    // filter on the tests that come back — without it every patient would be
    // returned, most of them carrying an empty test list.
    let request = supabase
      .from('patients')
      .select(query.department ? '*, tests:patient_tests!inner(*)' : '*, tests:patient_tests(*)')
      .eq('organization_id', organizationId);

    if (query.department) request = request.eq('tests.department', query.department);
    if (query.since) request = request.gte('registered_at', query.since);
    if (query.until) request = request.lte('registered_at', query.until);
    if (query.withBillingAccount) request = request.not('billing_account_id', 'is', null);
    if (query.patientProfileId != null) request = request.eq('patient_profile_id', query.patientProfileId);
    if (query.search) {
      // Commas and parentheses would be read as more filter clauses.
      const term = query.search.replace(/[,()]/g, ' ').trim();
      request = request.or(`first_name.ilike.%${term}%,surname.ilike.%${term}%,phone.ilike.%${term}%`);
    }

    request = request.order('registered_at', { ascending: false });
    if (query.limit) request = request.limit(query.limit);

    const { data, error } = await request;
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
    const patientId = patient.id || await allocatePatientId(supabase, organizationId, 'patients');
    let profileId = patient.patientProfileId;

    // A returning patient already has a profile; a new one needs creating first.
    if (!profileId) {
      profileId = await allocatePatientId(supabase, organizationId, 'patient_profiles');
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
    const isReturningPatient = !!patient.patientProfileId;
    const payingFromWallet = patient.paymentMethod === 'wallet' && !!patient.billingAccountId;

    // Allocated rather than drawn at random, so two registrations cannot be
    // handed the same id. Both at once: it is one wait, not two.
    const [patientId, profileId] = await Promise.all([
      patient.id ? Promise.resolve(patient.id) : allocatePatientId(supabase, organizationId, 'patients'),
      isReturningPatient
        ? Promise.resolve(patient.patientProfileId!)
        : allocatePatientId(supabase, organizationId, 'patient_profiles'),
    ]);

    // The whole registration is one transaction, so a refused slip number
    // leaves nothing behind and retrying with the next one is safe.
    const error = await withSlipNumberRetry(
      patient.slipNumber,
      () => cloudPatientsRepository.nextSlipNumber(organizationId),
      async (slip) => {
        const withSlip = { ...patient, slipNumber: slip };
        const now = new Date().toISOString();

        const { error: rpcError } = await supabase.rpc('register_patient_with_wallet', {
          p_profile: isReturningPatient ? null : toProfileRow(withSlip, profileId, organizationId),
          p_patient: toPatientRowWithBilling(withSlip, patientId, profileId, organizationId),
          p_tests: toTestRowsWithBilling(tests, patientId, organizationId),
          p_ledger: payingFromWallet ? {
            id: crypto.randomUUID(),
            organization_id: organizationId,
            billing_account_id: withSlip.billingAccountId,
            patient_id: patientId,
            type: 'charge',
            amount: -(withSlip.netAmount || 0),
            description: `Diagnostics Charge - Slip: ${slip}`,
            reference_id: slip,
            payment_method: 'wallet',
            created_by: 'Reception Desk',
            created_at: now,
          } : null,
        });

        // A duplicate slip must reach the retry as a throw; everything else is
        // handled below exactly as before.
        if (rpcError && /23505|slip_number|patients_org_slip_number_key/i.test(`${rpcError.code} ${rpcError.message}`)) {
          throw rpcError;
        }
        patient.slipNumber = slip;
        return rpcError;
      },
    );

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
    const patientId = patient.id || await allocatePatientId(supabase, organizationId, 'patients');
    let profileId = patient.patientProfileId;

    if (!profileId) {
      profileId = await allocatePatientId(supabase, organizationId, 'patient_profiles');
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

    // Retried around the insert alone, deliberately. This path is not atomic:
    // the wallet has already been debited above, so re-running the whole
    // registration would charge the patient a second time.
    await withSlipNumberRetry(
      patient.slipNumber,
      () => cloudPatientsRepository.nextSlipNumber(organizationId),
      async (slip) => {
        const { error: pError } = await supabase
          .from('patients')
          .insert([toPatientRowWithBilling({ ...patient, slipNumber: slip }, patientId, profileId, organizationId)]);
        if (pError) throw pError;
        patient.slipNumber = slip;
      },
    );

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

  /**
   * Registers someone reached through a side door — a wallet owner, or a
   * dependant being added to a family account.
   *
   * This used to write a bare patients row: no registered_at, no profile, no
   * link to one. Two things followed. The queue drops any patient without a
   * registration time before it does anything else, so these people were
   * invisible on every screen; and with no profile they could never be found
   * again as a returning patient, so the next visit created a duplicate.
   *
   * It is a real registration now — same allocated ids and same profile as the
   * front desk creates.
   */
  async registerAndGetId(patient, organizationId) {
    const supabase = createClient();
    const [patientId, profileId] = await Promise.all([
      allocatePatientId(supabase, organizationId, 'patients'),
      allocatePatientId(supabase, organizationId, 'patient_profiles'),
    ]);

    const { error: profileError } = await supabase
      .from('patient_profiles')
      .insert([toProfileRow(patient, profileId, organizationId)]);
    if (profileError) throw profileError;

    const { error } = await supabase
      .from('patients')
      .insert([{
        id: patientId,
        patient_profile_id: profileId,
        // Without this the patient exists but appears nowhere.
        registered_at: patient.registeredAt || new Date().toISOString(),
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
      }]);
    if (error) throw error;
    return patientId;
  },

  /**
   * Corrects the permanent record behind a patient.
   *
   * Nothing used to update patient_profiles at all — it was insert-only. The
   * admin edit screen wrote the visit row, so a correction lasted exactly one
   * visit and the next registration re-applied the old spelling from the
   * profile. A wrong email there also decides whether the right person can see
   * their results in the portal.
   */
  async updateProfile(profileId, updates, organizationId) {
    const supabase = createClient();
    const { error } = await supabase
      .from('patient_profiles')
      .update({
        first_name: updates.firstName,
        surname: updates.surname,
        middle_name: updates.middleName ?? null,
        phone: updates.phone,
        email: updates.email ?? null,
        address: updates.address,
        sex: updates.sex,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId)
      .eq('organization_id', organizationId);
    if (error) throw error;
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
    const onChange = debounce(callback, REALTIME_DEBOUNCE_MS);

    // A realtime channel is not something the app can assume it has. The tables
    // have to be in the `supabase_realtime` publication, the project has to
    // have realtime enabled, and the websocket has to survive whatever sits
    // between the clinic and the internet. When any of that is missing the
    // channel simply never comes up — no error, no events — and reception sits
    // looking at a queue that stopped changing, which is how a completed result
    // goes unnoticed.
    //
    // So: poll while the channel is down, and stop the moment it is up.
    let stopped = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (stopped || poll) return;
      poll = setInterval(callback, REALTIME_FALLBACK_POLL_MS);
    };
    const stopPolling = () => {
      if (poll) { clearInterval(poll); poll = null; }
    };

    const channel = REALTIME_TABLES.reduce(
      (ch, table) => ch.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table, filter: `organization_id=eq.${organizationId}` },
        onChange,
      ),
      supabase.channel(`patients-org-${organizationId}`) as any,
    ).subscribe((status: string) => {
      if (status === 'SUBSCRIBED') stopPolling();
      else startPolling();
    });

    return () => {
      stopped = true;
      onChange.cancel();
      stopPolling();
      supabase.removeChannel(channel);
    };
  },
};

export const getPatientsRepository = (mode: RuntimeMode = RUNTIME_MODE): PatientsRepository =>
  mode === 'local' ? localPatientsRepository : cloudPatientsRepository;
