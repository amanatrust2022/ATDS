import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const createClientMock = vi.fn();
vi.mock('@/lib/supabase', () => ({ createClient: () => createClientMock() }));

import { getPatientsRepository, localPatientsRepository, cloudPatientsRepository } from './patients';
import {
  formatSlipNumber, slipPrefixFor, toPatient, toPatientProfile,
  toPatientRow, toPatientRowWithBilling, toTestRows, toTestRowsWithBilling,
} from './patientMappers';

const fetchMock = vi.fn();
const bodyOf = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = fetchMock as any;
});

describe('Slip numbers', () => {
  it('formats as ATD/YYYYMMDD/NNNN', () => {
    expect(formatSlipNumber(new Date(2026, 6, 27), 1)).toBe('ATD/20260727/0001');
  });

  it('zero-pads the month and day', () => {
    expect(formatSlipNumber(new Date(2026, 0, 5), 12)).toBe('ATD/20260105/0012');
  });

  it('keeps four digits for a busy day', () => {
    expect(formatSlipNumber(new Date(2026, 6, 27), 1234)).toBe('ATD/20260727/1234');
  });

  it('shares a prefix with every slip issued the same day', () => {
    const prefix = slipPrefixFor(new Date(2026, 6, 27));

    expect(prefix).toBe('ATD/20260727/');
    expect(formatSlipNumber(new Date(2026, 6, 27), 7).startsWith(prefix)).toBe(true);
  });
});

describe('Issuing the next slip number', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 27, 12, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('counts only slips issued today on the hub', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { slipNumber: 'ATD/20260727/0001' },
        { slipNumber: 'ATD/20260726/0009' }, // yesterday
        { slipNumber: 'ATD/20260727/0002' },
      ],
    });

    await expect(localPatientsRepository.nextSlipNumber('org-1')).resolves.toBe('ATD/20260727/0003');
  });

  it('issues the first number of the day when none have been issued', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });

    await expect(localPatientsRepository.nextSlipNumber('org-1')).resolves.toBe('ATD/20260727/0001');
  });

  it('ignores patients with no slip number at all', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [{ slipNumber: null }, { id: 3 }] });

    await expect(localPatientsRepository.nextSlipNumber('org-1')).resolves.toBe('ATD/20260727/0001');
  });
});

describe('Mapping a patient row out of Postgres', () => {
  it('renames the snake_case columns the app reads', () => {
    const patient = toPatient({
      id: 1, slip_number: 'ATD/20260727/0001', registered_at: '2026-07-27T10:00:00Z',
      first_name: 'Musa', surname: 'Bello', referred_by: 'Dr. Adamu',
      referring_facility: 'City General', patient_profile_id: 42, billing_account_id: 'acc-1',
    });

    expect(patient).toMatchObject({
      slipNumber: 'ATD/20260727/0001',
      registeredAt: '2026-07-27T10:00:00Z',
      firstName: 'Musa',
      referredBy: 'Dr. Adamu',
      referringFacility: 'City General',
      patientProfileId: 42,
      billingAccountId: 'acc-1',
    });
  });

  it('carries the billing snapshot across', () => {
    const patient = toPatient({
      id: 1, total_amount: 17000, discount_amount: 2550, net_amount: 14450,
      paid_amount: 14450, payment_status: 'paid', payment_method: 'wallet',
    });

    expect(patient).toMatchObject({
      totalAmount: 17000, discountAmount: 2550, netAmount: 14450,
      paidAmount: 14450, paymentStatus: 'paid', paymentMethod: 'wallet',
    });
  });

  it('maps the nested tests too', () => {
    const patient = toPatient({
      id: 1,
      tests: [{ id: 't1', test_id: 'fbc', test_name: 'Full Blood Count', completed_by: 'Ada', commission_amount: 500 }],
    });

    expect(patient.tests[0]).toMatchObject({
      testId: 'fbc', testName: 'Full Blood Count', completedBy: 'Ada', commissionAmount: 500,
    });
  });

  it('gives a patient with no tests an empty list rather than undefined', () => {
    expect(toPatient({ id: 1 }).tests).toEqual([]);
  });

  it('maps a patient profile', () => {
    expect(toPatientProfile({
      id: 42, organization_id: 'org-1', first_name: 'Musa', surname: 'Bello',
      middle_name: 'Ibrahim', created_at: 'x', updated_at: 'y',
    })).toMatchObject({
      id: 42, organizationId: 'org-1', firstName: 'Musa', middleName: 'Ibrahim', createdAt: 'x',
    });
  });
});

describe('Mapping a patient into Postgres', () => {
  const patient = {
    slipNumber: 'ATD/20260727/0001', firstName: 'Musa', surname: 'Bello',
    age: '35yrs', sex: 'Male' as const, phone: '0803', address: 'Kano',
  };

  it('writes the identity columns and scopes the row to the organisation', () => {
    const row = toPatientRow(patient, 111, 42, 'org-1');

    expect(row).toMatchObject({
      id: 111, patient_profile_id: 42, organization_id: 'org-1',
      slip_number: 'ATD/20260727/0001', first_name: 'Musa',
    });
  });

  it('nulls an absent referrer rather than sending undefined', () => {
    const row = toPatientRow(patient, 111, 42, 'org-1');

    expect(row.referring_doctor_id).toBeNull();
    expect(row.referring_facility_id).toBeNull();
    expect(row.billing_account_id).toBeNull();
  });

  it('adds the commission and billing snapshot on a registration', () => {
    const row = toPatientRowWithBilling(
      { ...patient, commissionAssigned: true, commissionAmount: 500, totalAmount: 17000, netAmount: 14450 },
      111, 42, 'org-1',
    );

    expect(row).toMatchObject({
      commission_assigned: true, commission_amount: 500,
      commission_status: 'pending', total_amount: 17000, net_amount: 14450,
    });
  });

  // An unassigned commission must be null, not 'pending', or it would show as owed.
  it('leaves commission_status null when no commission was assigned', () => {
    const row = toPatientRowWithBilling({ ...patient, commissionAssigned: false }, 111, 42, 'org-1');

    expect(row.commission_status).toBeNull();
  });

  /**
   * The queue, the search box and the slip all read `patients.name`. Only
   * `update()` used to write it, so a newly registered patient showed a blank
   * name and could not be found by searching for it.
   */
  it('writes the display name that the queue and the search box read', () => {
    expect(toPatientRowWithBilling(
      { ...patient, firstName: 'Aisha', middleName: 'Bello', surname: 'Musa', name: undefined },
      111, 42, 'org-1',
    ).name).toBe('Aisha Bello Musa');
  });

  it('keeps a name the caller supplied rather than rebuilding it', () => {
    expect(toPatientRowWithBilling(
      { ...patient, name: 'Hajiya Aisha Musa', firstName: 'Aisha', surname: 'Musa' },
      111, 42, 'org-1',
    ).name).toBe('Hajiya Aisha Musa');
  });

  it('defaults the money columns to zero rather than null', () => {
    const row = toPatientRowWithBilling(patient, 111, 42, 'org-1');

    expect(row).toMatchObject({
      total_amount: 0, discount_value: 0, discount_amount: 0, net_amount: 0, paid_amount: 0,
      discount_type: 'none', payment_status: 'paid', payment_method: 'cash',
    });
  });

  it('writes one test row per selected test', () => {
    const rows = toTestRows(
      [{ testId: 'fbc', testName: 'FBC', department: 'lab', status: 'pending' }],
      111, 'org-1',
    );

    expect(rows).toEqual([{
      patient_id: 111, test_id: 'fbc', test_name: 'FBC', department: 'lab',
      status: 'pending', specimen: undefined, organization_id: 'org-1',
    }]);
  });

  it('adds the per-test price and commission on a registration', () => {
    const [row] = toTestRowsWithBilling(
      [{ testId: 'fbc', testName: 'FBC', department: 'lab', status: 'pending', price: 5000, commissionAmount: 500 }],
      111, 'org-1',
    );

    expect(row).toMatchObject({ price: 5000, commission_amount: 500, commission_type: 'none' });
  });
});

describe('Local patients repository', () => {
  it('picks an implementation by runtime mode', () => {
    expect(getPatientsRepository('local')).toBe(localPatientsRepository);
    expect(getPatientsRepository('cloud')).toBe(cloudPatientsRepository);
  });

  it('reads profiles through the dedicated action', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });

    await localPatientsRepository.listProfiles('org-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/patients?action=getPatientProfiles&organizationId=org-1');
  });

  it('returns no profiles rather than throwing when the hub refuses', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    await expect(localPatientsRepository.listProfiles('org-1')).resolves.toEqual([]);
  });

  it('registers a patient with its tests in one write', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await localPatientsRepository.addWithReferral({ slipNumber: 'S1' } as any, [{ testId: 'fbc' } as any], 'org-1');

    expect(bodyOf()).toMatchObject({ action: 'addPatient', organizationId: 'org-1' });
  });

  it('returns the new id when registering for a wallet flow', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 777 }) });

    await expect(localPatientsRepository.registerAndGetId({} as any, 'org-1')).resolves.toBe(777);
  });

  it('surfaces the hub error when registration fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Slip already exists' }) });

    await expect(localPatientsRepository.add({} as any, [], 'org-1')).rejects.toThrow('Slip already exists');
  });

  it('polls for changes and stops when unsubscribed', () => {
    vi.useFakeTimers();
    const callback = vi.fn();

    const unsubscribe = localPatientsRepository.subscribe('org-1', callback);
    vi.advanceTimersByTime(11000);
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
    vi.advanceTimersByTime(10000);
    expect(callback).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

describe('Cloud realtime subscription', () => {
  it('watches every table a reception screen depends on, then unsubscribes cleanly', () => {
    const on = vi.fn().mockReturnThis();
    const channel = { on, subscribe: vi.fn().mockReturnValue('channel-handle') };
    const removeChannel = vi.fn();
    createClientMock.mockReturnValue({ channel: () => channel, removeChannel });

    const unsubscribe = cloudPatientsRepository.subscribe('org-1', vi.fn());

    const watched = on.mock.calls.map(c => c[1].table);
    expect(watched).toEqual([
      'patients', 'patient_tests', 'billing_accounts',
      'billing_ledger_transactions', 'external_department_charges',
    ]);
    expect(on.mock.calls.every(c => c[1].filter === 'organization_id=eq.org-1')).toBe(true);

    unsubscribe();
    expect(removeChannel).toHaveBeenCalledWith('channel-handle');
  });
});

/**
 * Registration takes payment, so it goes through the register_patient_with_wallet
 * Postgres function: the profile, the debit, the visit, the ledger entry and the
 * tests commit together or not at all.
 *
 * The balance rules live in SQL now and cannot be asserted from here — see the
 * VERIFY block in supabase_wallet_atomicity.sql. What is asserted is the payload
 * the function receives, and how its refusals reach the receptionist.
 */
describe('Registering a patient who pays from a wallet', () => {
  const walletPatient = {
    slipNumber: 'ATD/20260727/0001', firstName: 'Musa', surname: 'Bello',
    age: '35yrs', sex: 'Male' as const, phone: '0803', address: 'Kano',
    paymentMethod: 'wallet', billingAccountId: 'acc-1', netAmount: 14450,
  };
  const someTests = [{ testId: 'fbc', testName: 'FBC', department: 'lab' as const, status: 'pending' as const, price: 5000 }];

  const rpcStub = (error: any = null) => {
    const calls: Array<{ fn: string; args: any }> = [];
    createClientMock.mockReturnValue({
      rpc: (fn: string, args: any) => { calls.push({ fn, args }); return Promise.resolve({ data: null, error }); },
      from: () => { throw new Error('should not write directly when the function is available'); },
    });
    return calls;
  };

  it('sends the whole registration to the database in one call', async () => {
    const calls = rpcStub();

    await cloudPatientsRepository.addWithReferral(walletPatient as any, someTests, 'org-1');

    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe('register_patient_with_wallet');
  });

  /**
   * Reception puts the new patient straight onto the queue from this id, rather
   * than refetching. Returning nothing is what made a registration only appear
   * after a manual reload.
   */
  it('returns the new patient id so the caller need not refetch', async () => {
    rpcStub();

    const id = await cloudPatientsRepository.addWithReferral(
      { ...walletPatient, id: 123456 } as any, someTests, 'org-1');

    expect(id).toBe(123456);
  });

  it('sends the ledger entry as a negative charge against the wallet', async () => {
    const calls = rpcStub();

    await cloudPatientsRepository.addWithReferral(walletPatient as any, someTests, 'org-1');

    expect(calls[0].args.p_ledger).toMatchObject({
      type: 'charge', amount: -14450, billing_account_id: 'acc-1',
      description: 'Diagnostics Charge - Slip: ATD/20260727/0001',
    });
  });

  it('sends no ledger entry when the visit is not paid from a wallet', async () => {
    const calls = rpcStub();

    await cloudPatientsRepository.addWithReferral(
      { ...walletPatient, paymentMethod: 'cash' } as any, someTests, 'org-1',
    );

    expect(calls[0].args.p_ledger).toBeNull();
  });

  it('sends a new profile for a first-time patient', async () => {
    const calls = rpcStub();

    await cloudPatientsRepository.addWithReferral(walletPatient as any, someTests, 'org-1');

    expect(calls[0].args.p_profile).toMatchObject({ first_name: 'Musa', organization_id: 'org-1' });
  });

  // A returning patient already has a profile; creating a second would split their history.
  it('sends no profile for a returning patient', async () => {
    const calls = rpcStub();

    await cloudPatientsRepository.addWithReferral(
      { ...walletPatient, patientProfileId: 42 } as any, someTests, 'org-1',
    );

    expect(calls[0].args.p_profile).toBeNull();
    expect(calls[0].args.p_patient.patient_profile_id).toBe(42);
  });

  it('sends one test row per selected test, tied to the new visit', async () => {
    const calls = rpcStub();

    await cloudPatientsRepository.addWithReferral(walletPatient as any, someTests, 'org-1');

    expect(calls[0].args.p_tests).toHaveLength(1);
    expect(calls[0].args.p_tests[0]).toMatchObject({ test_id: 'fbc', price: 5000 });
    expect(calls[0].args.p_tests[0].patient_id).toBe(calls[0].args.p_patient.id);
  });

  it('names the account when the wallet cannot cover the bill', async () => {
    rpcStub({ message: 'INSUFFICIENT_FUNDS:{"available":5000,"name":"Bello Family"}' });

    await expect(cloudPatientsRepository.addWithReferral(walletPatient as any, someTests, 'org-1'))
      .rejects.toThrow('Insufficient wallet balance on "Bello Family". Available: ₦5,000');
  });

  it('reports an unknown account plainly', async () => {
    rpcStub({ message: 'BILLING_ACCOUNT_NOT_FOUND' });

    await expect(cloudPatientsRepository.addWithReferral(walletPatient as any, someTests, 'org-1'))
      .rejects.toThrow('Billing account not found');
  });

  it('passes any other database failure through', async () => {
    rpcStub({ message: 'duplicate key value violates unique constraint' });

    await expect(cloudPatientsRepository.addWithReferral(walletPatient as any, someTests, 'org-1'))
      .rejects.toThrow(/duplicate key/);
  });

  it('falls back to sequential writes when the function is not deployed, and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const writes: string[] = [];
    const builder: any = { then: (r: any) => r({ data: { balance: 999999, credit_limit: 0, name: 'W' }, error: null }) };
    for (const m of ['select', 'eq', 'insert', 'update', 'single']) {
      builder[m] = () => builder;
    }
    createClientMock.mockReturnValue({
      rpc: () => Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }),
      from: (table: string) => { writes.push(table); return builder; },
    });

    await cloudPatientsRepository.addWithReferral(walletPatient as any, someTests, 'org-1');

    expect(writes).toContain('patients');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('supabase_wallet_atomicity.sql'));
    warn.mockRestore();
  });
});
