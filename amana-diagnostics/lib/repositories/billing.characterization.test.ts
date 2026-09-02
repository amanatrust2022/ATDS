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
const supabaseWith = (results: Array<{ data?: any; error?: any }> = [], rpcResult: { error?: any } = {}) => {
  const ops: Op[] = [];
  const rpcCalls: Array<{ fn: string; args: any }> = [];
  let call = 0;

  const client: any = {
    rpc(fn: string, args: any) {
      rpcCalls.push({ fn, args });
      return Promise.resolve({ data: null, error: rpcResult.error ?? null });
    },
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
    rpcCalls,
    /** Args of the nth call of a method on a table, in the order they happened. */
    find: (table: string, method: string, nth = 0) =>
      ops.filter(o => o.table === table && o.method === method)[nth]?.args,
    sequence: () => ops.filter(o => ['insert', 'update'].includes(o.method)).map(o => `${o.method}:${o.table}`),
  };
};

/** The error PostgREST returns when a function is not in its schema cache. */
const FUNCTION_MISSING = { code: 'PGRST202', message: 'Could not find the function public.log_external_department_charge' };

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

/**
 * Charging a wallet now goes through the log_external_department_charge
 * Postgres function so the debit and the rows explaining it commit together.
 *
 * The balance rules themselves (spend into the credit limit, refuse beyond it)
 * moved into SQL and can no longer be asserted from JavaScript — see the VERIFY
 * block at the foot of supabase_wallet_atomicity.sql, which exercises them
 * against a real database. What is still asserted here is the payload the
 * function receives, since a wrong payload is the failure this layer can cause,
 * and the full rules are still covered on the fallback path below.
 */
describe('Charging a wallet for an outside department', () => {
  const walletCharge = {
    organizationId: 'org-1', patientId: 42, billingAccountId: 'acc-1',
    department: 'pharmacy', receiptNumber: 'R-1', amount: 2500,
    paymentMethod: 'wallet', status: 'paid', createdBy: 'Reception',
  };

  it('hands the whole charge to the database in a single call', async () => {
    const sb = supabaseWith();
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge(walletCharge as any);

    expect(sb.rpcCalls).toHaveLength(1);
    expect(sb.rpcCalls[0].fn).toBe('log_external_department_charge');
    // Nothing is written directly any more; the function does it all.
    expect(sb.sequence()).toEqual([]);
  });

  it('sends the charge row the function will insert', async () => {
    const sb = supabaseWith();
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge(walletCharge as any);

    expect(sb.rpcCalls[0].args.p_charge).toMatchObject({
      organization_id: 'org-1', patient_id: 42, billing_account_id: 'acc-1',
      department: 'pharmacy', receipt_number: 'R-1', amount: 2500,
      payment_method: 'wallet', status: 'paid', created_by: 'Reception',
    });
  });

  it('sends the ledger row as a negative amount describing the charge', async () => {
    const sb = supabaseWith();
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge(walletCharge as any);

    expect(sb.rpcCalls[0].args.p_ledger).toMatchObject({
      type: 'charge', amount: -2500, reference_id: 'R-1',
      payment_method: 'wallet', description: 'PHARMACY Bill - Ref: R-1',
    });
  });

  it('does not attribute a cash charge to the wallet even when one is linked', async () => {
    const sb = supabaseWith();
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge({ ...walletCharge, paymentMethod: 'cash' } as any);

    expect(sb.rpcCalls[0].args.p_charge.billing_account_id).toBeNull();
  });

  it('defaults an unstated charge status to paid', async () => {
    const sb = supabaseWith();
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge({ ...walletCharge, status: undefined } as any);

    expect(sb.rpcCalls[0].args.p_charge.status).toBe('paid');
  });

  // The database reports the shortfall machine-readably; the wording the
  // receptionist sees must not have changed.
  it('reports a refused charge in the same words as before', async () => {
    createClientMock.mockReturnValue(
      supabaseWith([], { error: { message: 'INSUFFICIENT_FUNDS:{"available":1500}' } }).client,
    );

    await expect(logExternalCharge(walletCharge as any))
      .rejects.toThrow('Insufficient wallet balance. Available credit: ₦1,500');
  });

  it('reports an unknown account plainly', async () => {
    createClientMock.mockReturnValue(
      supabaseWith([], { error: { message: 'BILLING_ACCOUNT_NOT_FOUND' } }).client,
    );

    await expect(logExternalCharge(walletCharge as any)).rejects.toThrow('Billing account not found');
  });

  it('passes any other database failure through', async () => {
    createClientMock.mockReturnValue(
      supabaseWith([], { error: { message: 'deadlock detected' } }).client,
    );

    await expect(logExternalCharge(walletCharge as any)).rejects.toThrow('deadlock detected');
  });
});

/**
 * A release can reach a database where supabase_wallet_atomicity.sql has not
 * been applied. The charge must still go through, non-atomically, rather than
 * failing outright.
 */
describe('Charging when the database function is not deployed yet', () => {
  const walletCharge = {
    organizationId: 'org-1', patientId: 42, billingAccountId: 'acc-1',
    department: 'pharmacy', receiptNumber: 'R-1', amount: 2500,
    paymentMethod: 'wallet', status: 'paid', createdBy: 'Reception',
  };

  it('falls back to the sequential writes and warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sb = supabaseWith([
      { data: { balance: 10000, credit_limit: 0 }, error: null }, // read wallet
      { data: null, error: null },                                // debit
      { data: null, error: null },                                // ledger
      { data: null, error: null },                                // charge row
    ], { error: FUNCTION_MISSING });
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge(walletCharge as any);

    expect(sb.find('billing_accounts', 'update')![0]).toMatchObject({ balance: 7500 });
    expect(sb.sequence()).toEqual([
      'update:billing_accounts',
      'insert:billing_ledger_transactions',
      'insert:external_department_charges',
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('supabase_wallet_atomicity.sql'));

    warn.mockRestore();
  });

  it('still spends into the credit limit on the fallback path', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sb = supabaseWith([
      { data: { balance: 1000, credit_limit: 5000 }, error: null },
      { data: null, error: null }, { data: null, error: null }, { data: null, error: null },
    ], { error: FUNCTION_MISSING });
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge({ ...walletCharge, amount: 3000 } as any);

    expect(sb.find('billing_accounts', 'update')![0].balance).toBe(-2000);
  });

  it('still refuses an over-limit charge on the fallback path, writing nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sb = supabaseWith(
      [{ data: { balance: 1000, credit_limit: 500 }, error: null }],
      { error: FUNCTION_MISSING },
    );
    createClientMock.mockReturnValue(sb.client);

    await expect(logExternalCharge({ ...walletCharge, amount: 5000 } as any))
      .rejects.toThrow(/Insufficient wallet balance/);

    expect(sb.sequence()).toEqual([]);
  });

  it('recognises the undefined-function error Postgres itself raises', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sb = supabaseWith([{ data: null, error: null }], { error: { code: '42883', message: 'function does not exist' } });
    createClientMock.mockReturnValue(sb.client);

    await logExternalCharge({ ...walletCharge, paymentMethod: 'cash' } as any);

    expect(sb.sequence()).toEqual(['insert:external_department_charges']);
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
