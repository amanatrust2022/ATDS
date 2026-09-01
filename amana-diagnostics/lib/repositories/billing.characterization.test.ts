import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the billing domain.
 *
 * These were written against lib/store.ts BEFORE the billing functions moved
 * behind a repository, and they exercise the public API in lib/store.ts rather
 * than the repository. That is deliberate: they describe what callers observe,
 * so they keep passing across the move and prove it changed no behaviour.
 *
 * Every function here moves money. Treat a failure as a real defect, not a test
 * that needs updating.
 */

const createClientMock = vi.fn();
vi.mock('@/lib/supabase', () => ({ createClient: () => createClientMock() }));
vi.mock('@/lib/runtimeMode', () => ({
  RUNTIME_MODE: 'cloud',
  isLocalMode: () => false,
}));

import {
  fetchBillingAccounts, fetchPatientWallet, createBillingAccount,
  depositToBillingAccount, logExternalCharge, fetchAccountLedger,
  fetchExternalCharges, updatePatientBillingAccount,
  updateBillingAccountLimit, upgradeBillingAccount,
} from '@/lib/store';

type Op = { table: string; method: string; args: any[] };

/**
 * Supabase stub that answers each `.from()` chain with the next queued result and
 * records every operation, so a test can assert the order writes happened in.
 */
const supabaseWith = (results: Array<{ data?: any; error?: any }> = []) => {
  const ops: Op[] = [];
  let call = 0;

  const client = {
    from(table: string) {
      const result = results[call++] ?? { data: null, error: null };
      const builder: any = { then: (resolve: any) => resolve(result) };
      for (const method of ['select', 'eq', 'in', 'order', 'insert', 'update', 'delete', 'single', 'maybeSingle']) {
        builder[method] = (...args: any[]) => { ops.push({ table, method, args }); return builder; };
      }
      return builder;
    },
  };

  return {
    client,
    ops,
    /** Args of the nth call of a method on a table, in the order they happened. */
    find: (table: string, method: string, nth = 0) =>
      ops.filter(o => o.table === table && o.method === method)[nth]?.args,
    sequence: () => ops.filter(o => ['insert', 'update'].includes(o.method)).map(o => `${o.method}:${o.table}`),
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn() as any;
});

describe('Reading billing data', () => {
  it('lists an organisation’s accounts by name', async () => {
    const sb = supabaseWith([{ data: [{ id: 'acc-1' }], error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await expect(fetchBillingAccounts('org-1')).resolves.toEqual([{ id: 'acc-1' }]);
    expect(sb.find('billing_accounts', 'eq')).toEqual(['organization_id', 'org-1']);
    expect(sb.find('billing_accounts', 'order')).toEqual(['name', { ascending: true }]);
  });

  it('returns no accounts rather than throwing when the read fails', async () => {
    createClientMock.mockReturnValue(supabaseWith([{ data: null, error: { message: 'down' } }]).client);

    await expect(fetchBillingAccounts('org-1')).resolves.toEqual([]);
  });

  it('finds the wallet linked to a patient', async () => {
    createClientMock.mockReturnValue(supabaseWith([
      { data: { billing_account_id: 'acc-1', billing_accounts: { id: 'acc-1', balance: 5000 } }, error: null },
    ]).client);

    await expect(fetchPatientWallet(42)).resolves.toEqual({ id: 'acc-1', balance: 5000 });
  });

  it('reports no wallet for a patient who has none', async () => {
    createClientMock.mockReturnValue(supabaseWith([{ data: { billing_account_id: null }, error: null }]).client);

    await expect(fetchPatientWallet(42)).resolves.toBeNull();
  });

  it('reads a ledger newest first', async () => {
    const sb = supabaseWith([{ data: [{ id: 'tx-1' }], error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await fetchAccountLedger('acc-1');

    expect(sb.find('billing_ledger_transactions', 'eq')).toEqual(['billing_account_id', 'acc-1']);
    expect(sb.find('billing_ledger_transactions', 'order')).toEqual(['created_at', { ascending: false }]);
  });

  it('names the patient on each external charge', async () => {
    createClientMock.mockReturnValue(supabaseWith([{
      data: [{
        id: 'ch-1', amount: 2000, receipt_number: 'R-1', payment_method: 'cash',
        patient: { first_name: 'Musa', middle_name: 'Ibrahim', surname: 'Bello', slip_number: 'ATD/1' },
      }],
      error: null,
    }]).client);

    const [charge] = await fetchExternalCharges('org-1');

    expect(charge.patientName).toBe('Musa Ibrahim Bello');
    expect(charge.patientSlip).toBe('ATD/1');
    expect(charge.receiptNumber).toBe('R-1');
  });

  it('says Unknown rather than crashing when the patient is missing', async () => {
    createClientMock.mockReturnValue(supabaseWith([{ data: [{ id: 'ch-1', patient: null }], error: null }]).client);

    const [charge] = await fetchExternalCharges('org-1');

    expect(charge.patientName).toBe('Unknown');
    expect(charge.patientSlip).toBe('');
  });
});

describe('Opening an account', () => {
  it('opens with the initial deposit as the balance, links members, and records the deposit', async () => {
    const sb = supabaseWith([
      { data: null, error: null }, // insert account
      { data: null, error: null }, // link patients
      { data: null, error: null }, // ledger row
    ]);
    createClientMock.mockReturnValue(sb.client);

    await createBillingAccount(
      { organization_id: 'org-1', name: 'Bello Family', owner_patient_id: 1, credit_limit: 5000, type: 'family' } as any,
      20000, 'cash', [2, 3], 'Reception',
    );

    const [rows] = sb.find('billing_accounts', 'insert')!;
    expect(rows[0]).toMatchObject({ balance: 20000, credit_limit: 5000, type: 'family' });

    // The owner is linked along with the dependants, and only once.
    expect(sb.find('patients', 'in')).toEqual(['id', [1, 2, 3]]);

    const [ledger] = sb.find('billing_ledger_transactions', 'insert')!;
    expect(ledger[0]).toMatchObject({ type: 'deposit', amount: 20000, description: 'Initial deposit upon account opening' });
  });

  it('writes no ledger entry when the account opens empty', async () => {
    const sb = supabaseWith([{ data: null, error: null }, { data: null, error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await createBillingAccount(
      { organization_id: 'org-1', name: 'Empty', owner_patient_id: 1, type: 'individual' } as any,
      0, 'cash', [], 'Reception',
    );

    expect(sb.find('billing_ledger_transactions', 'insert')).toBeUndefined();
  });

  it('defaults the credit limit to zero when none is given', async () => {
    const sb = supabaseWith([{ data: null, error: null }, { data: null, error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await createBillingAccount(
      { organization_id: 'org-1', name: 'X', owner_patient_id: 1, type: 'individual' } as any,
      0, 'cash', [], 'Reception',
    );

    expect(sb.find('billing_accounts', 'insert')![0][0].credit_limit).toBe(0);
  });
});

describe('Depositing into an account', () => {
  it('adds to the existing balance and records the deposit', async () => {
    const sb = supabaseWith([
      { data: { balance: 5000 }, error: null }, // read balance
      { data: null, error: null },              // write balance
      { data: null, error: null },              // ledger row
    ]);
    createClientMock.mockReturnValue(sb.client);

    await depositToBillingAccount('acc-1', 3000, 'Top up', 'cash', 'Reception', 'org-1', 42);

    expect(sb.find('billing_accounts', 'update')![0]).toMatchObject({ balance: 8000 });

    const [ledger] = sb.find('billing_ledger_transactions', 'insert')!;
    expect(ledger[0]).toMatchObject({ type: 'deposit', amount: 3000, patient_id: 42, created_by: 'Reception' });
  });

  it('treats a null starting balance as zero', async () => {
    const sb = supabaseWith([{ data: { balance: null }, error: null }, { data: null, error: null }, { data: null, error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await depositToBillingAccount('acc-1', 3000, 'Top up', 'cash', 'Reception', 'org-1');

    expect(sb.find('billing_accounts', 'update')![0].balance).toBe(3000);
  });

  it('records a deposit not tied to a patient with a null patient id', async () => {
    const sb = supabaseWith([{ data: { balance: 0 }, error: null }, { data: null, error: null }, { data: null, error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await depositToBillingAccount('acc-1', 1000, 'Top up', 'cash', 'Reception', 'org-1');

    expect(sb.find('billing_ledger_transactions', 'insert')![0][0].patient_id).toBeNull();
  });

  it('does not touch the balance when the account cannot be read', async () => {
    const sb = supabaseWith([{ data: null, error: { message: 'no such account' } }]);
    createClientMock.mockReturnValue(sb.client);

    await expect(depositToBillingAccount('ghost', 3000, 'x', 'cash', 'R', 'org-1')).rejects.toBeTruthy();
    expect(sb.find('billing_accounts', 'update')).toBeUndefined();
  });
});

describe('Charging a wallet for an outside department', () => {
  it('debits the wallet, writes the ledger entry, then records the charge', async () => {
    const sb = supabaseWith([
      { data: { balance: 10000, credit_limit: 0 }, error: null }, // read wallet
      { data: null, error: null },                                // debit
      { data: null, error: null },                                // ledger
      { data: null, error: null },                                // charge row
    ]);
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge({
      organizationId: 'org-1', patientId: 42, billingAccountId: 'acc-1',
      department: 'pharmacy', receiptNumber: 'R-1', amount: 2500,
      paymentMethod: 'wallet', status: 'paid', createdBy: 'Reception',
    } as any);

    expect(sb.find('billing_accounts', 'update')![0]).toMatchObject({ balance: 7500 });

    const [ledger] = sb.find('billing_ledger_transactions', 'insert')!;
    expect(ledger[0]).toMatchObject({ type: 'charge', amount: -2500, reference_id: 'R-1' });
    expect(ledger[0].description).toBe('PHARMACY Bill - Ref: R-1');

    expect(sb.sequence()).toEqual([
      'update:billing_accounts',
      'insert:billing_ledger_transactions',
      'insert:external_department_charges',
    ]);
  });

  it('spends into the credit limit when the balance alone is short', async () => {
    const sb = supabaseWith([
      { data: { balance: 1000, credit_limit: 5000 }, error: null },
      { data: null, error: null }, { data: null, error: null }, { data: null, error: null },
    ]);
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge({
      organizationId: 'org-1', patientId: 42, billingAccountId: 'acc-1',
      department: 'pharmacy', receiptNumber: 'R-2', amount: 3000,
      paymentMethod: 'wallet', createdBy: 'Reception',
    } as any);

    // Balance is allowed to go negative, down to the credit limit.
    expect(sb.find('billing_accounts', 'update')![0].balance).toBe(-2000);
  });

  it('refuses a charge beyond the balance plus credit limit, and writes nothing', async () => {
    const sb = supabaseWith([{ data: { balance: 1000, credit_limit: 500 }, error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await expect(logExternalCharge({
      organizationId: 'org-1', patientId: 42, billingAccountId: 'acc-1',
      department: 'pharmacy', receiptNumber: 'R-3', amount: 5000,
      paymentMethod: 'wallet', createdBy: 'Reception',
    } as any)).rejects.toThrow(/Insufficient wallet balance/);

    expect(sb.sequence()).toEqual([]);
  });

  it('records a cash charge without touching any wallet', async () => {
    const sb = supabaseWith([{ data: null, error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge({
      organizationId: 'org-1', patientId: 42, billingAccountId: 'acc-1',
      department: 'pharmacy', receiptNumber: 'R-4', amount: 2500,
      paymentMethod: 'cash', createdBy: 'Reception',
    } as any);

    expect(sb.sequence()).toEqual(['insert:external_department_charges']);
    // A cash charge is not attributed to the wallet even if one is linked.
    expect(sb.find('external_department_charges', 'insert')![0][0].billing_account_id).toBeNull();
  });

  it('defaults an unstated charge status to paid', async () => {
    const sb = supabaseWith([{ data: null, error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge({
      organizationId: 'org-1', patientId: 42, department: 'pharmacy',
      receiptNumber: 'R-5', amount: 100, paymentMethod: 'cash', createdBy: 'R',
    } as any);

    expect(sb.find('external_department_charges', 'insert')![0][0].status).toBe('paid');
  });
});

describe('Maintaining an account', () => {
  it('links a patient to a wallet', async () => {
    const sb = supabaseWith([{ data: null, error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await updatePatientBillingAccount(42, 'acc-1');

    expect(sb.find('patients', 'update')![0]).toMatchObject({ billing_account_id: 'acc-1' });
    expect(sb.find('patients', 'eq')).toEqual(['id', 42]);
  });

  it('unlinks a patient by clearing the wallet', async () => {
    const sb = supabaseWith([{ data: null, error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await updatePatientBillingAccount(42, null);

    expect(sb.find('patients', 'update')![0].billing_account_id).toBeNull();
  });

  it('changes only the credit limit', async () => {
    const sb = supabaseWith([{ data: null, error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await updateBillingAccountLimit('acc-1', 25000);

    expect(sb.find('billing_accounts', 'update')![0]).toEqual({ credit_limit: 25000 });
  });

  it('upgrades an individual account to a family one', async () => {
    const sb = supabaseWith([{ data: null, error: null }]);
    createClientMock.mockReturnValue(sb.client);

    await upgradeBillingAccount('acc-1');

    expect(sb.find('billing_accounts', 'update')![0]).toEqual({ type: 'family' });
  });
});
