import { createClient } from '@/lib/supabase';
import { RuntimeMode, RUNTIME_MODE } from '@/lib/runtimeMode';
import { postJson } from './localHttp';
import { isMissingFunction, parseInsufficientFunds, formatNaira, RpcError } from './rpcErrors';
import type { BillingAccount, BillingLedgerTransaction, ExternalDepartmentCharge } from '@/lib/store';

/**
 * Wallets, their ledgers, and charges raised by departments outside diagnostics.
 *
 * Every write here moves money. The cloud implementation performs multi-step
 * writes without a transaction — see the note on `logExternalCharge` below —
 * so behaviour is covered by characterisation tests in
 * billing.characterization.test.ts, which exercise the lib/store.ts API and so
 * survive changes to this layer.
 */
export interface BillingRepository {
  listAccounts(organizationId: string): Promise<BillingAccount[]>;
  findPatientWallet(patientId: number | string): Promise<BillingAccount | null>;
  createAccount(
    account: Omit<BillingAccount, 'id' | 'balance' | 'created_at' | 'updated_at'>,
    initialDeposit: number,
    paymentMethod: string,
    linkedPatientIds: (string | number)[],
    createdBy: string,
  ): Promise<void>;
  deposit(
    accountId: string, amount: number, description: string, paymentMethod: string,
    createdBy: string, organizationId: string, patientId?: number | string,
  ): Promise<void>;
  logExternalCharge(charge: Omit<ExternalDepartmentCharge, 'id' | 'createdAt'>): Promise<void>;
  /**
   * Undoes a charge that should not have been made, by recording its opposite.
   *
   * There was no way to do this at all. A receptionist who charged the wrong
   * wallet — easy on a family account — could only make a compensating deposit
   * with an explanatory note, which left the wrong charge standing in the
   * patient's statement looking like a real one.
   *
   * The original entry is never edited or removed: a statement is a record of
   * what happened, and "this was reversed, here is why" is the truth, whereas a
   * charge that quietly vanishes is not.
   */
  reverseTransaction(
    transactionId: string, reason: string, createdBy: string, organizationId: string,
  ): Promise<void>;
  listLedger(accountId: string): Promise<BillingLedgerTransaction[]>;
  listExternalCharges(organizationId: string): Promise<ExternalDepartmentCharge[]>;
  linkPatient(patientId: number | string, billingAccountId: string | null): Promise<void>;
  setCreditLimit(accountId: string, newLimit: number): Promise<void>;
  upgradeToFamily(accountId: string): Promise<void>;
}

const ENDPOINT = '/api/billing';

const toBillingError = (error: RpcError): Error => {
  const shortfall = parseInsufficientFunds(error);
  if (shortfall) {
    return new Error(`Insufficient wallet balance. Available credit: ${formatNaira(shortfall.available)}`);
  }
  if (/BILLING_ACCOUNT_NOT_FOUND/.test(error.message || '')) {
    return new Error('Billing account not found');
  }
  return new Error(error.message || 'Failed to log external charge');
};

// ─── LOCAL (on-premise hub) ───────────────────────────────────────────────────

export const localBillingRepository: BillingRepository = {
  async listAccounts(organizationId) {
    const res = await fetch(`${ENDPOINT}?type=accounts&organizationId=${organizationId}`);
    if (!res.ok) throw new Error('Failed to fetch billing accounts');
    return res.json();
  },

  async findPatientWallet(patientId) {
    const res = await fetch(`${ENDPOINT}?type=patient_wallet&patientId=${patientId}`);
    if (!res.ok) return null;
    return res.json();
  },

  async createAccount(account, initialDeposit, paymentMethod, linkedPatientIds, createdBy) {
    await postJson(ENDPOINT, {
      action: 'createAccount', account, initialDeposit, paymentMethod,
      linkedPatientIds, createdBy, organizationId: account.organization_id,
    }, 'Failed to create billing account');
  },

  async deposit(accountId, amount, description, paymentMethod, createdBy, organizationId, patientId) {
    await postJson(ENDPOINT, {
      action: 'deposit', accountId, amount, description, paymentMethod,
      createdBy, organizationId, patientId,
    }, 'Failed to process deposit');
  },

  async logExternalCharge(charge) {
    await postJson(ENDPOINT, { action: 'logExternalCharge', charge }, 'Failed to log external charge');
  },

  async reverseTransaction(transactionId, reason, createdBy, organizationId) {
    await postJson(
      ENDPOINT,
      { action: 'reverseTransaction', transactionId, reason, createdBy, organizationId },
      'Failed to reverse the transaction',
    );
  },

  async listLedger(accountId) {
    const res = await fetch(`${ENDPOINT}?type=ledger&accountId=${accountId}`);
    if (!res.ok) throw new Error('Failed to fetch account ledger');
    return res.json();
  },

  async listExternalCharges(organizationId) {
    const res = await fetch(`${ENDPOINT}?type=external_charges&organizationId=${organizationId}`);
    if (!res.ok) throw new Error('Failed to fetch external charges');
    return res.json();
  },

  async linkPatient(patientId, billingAccountId) {
    await postJson(ENDPOINT, { action: 'linkPatient', patientId, billingAccountId }, 'Failed to update patient billing account');
  },

  async setCreditLimit(accountId, newLimit) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateLimit', accountId, newLimit }),
    });
    if (!res.ok) throw new Error('Failed to update credit limit');
  },

  async upgradeToFamily(accountId) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upgradeAccount', accountId }),
    });
    if (!res.ok) throw new Error('Failed to upgrade account');
  },
};

// ─── CLOUD (Supabase) ─────────────────────────────────────────────────────────

/** The fallback write path is not part of the interface; only this implementation has one. */
type CloudBillingRepository = BillingRepository & {
  logExternalChargeSequentially(
    charge: Omit<ExternalDepartmentCharge, 'id' | 'createdAt'>,
    chargeId: string,
    now: string,
  ): Promise<void>;
  depositSequentially(
    accountId: string,
    amount: number,
    ledger: Record<string, any>,
    now: string,
  ): Promise<void>;
};

export const cloudBillingRepository: CloudBillingRepository = {
  async listAccounts(organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('billing_accounts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });
    if (error) { console.error('fetchBillingAccounts error:', error); return []; }
    return data || [];
  },

  async findPatientWallet(patientId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('patients')
      .select('billing_account_id, billing_accounts(*)')
      .eq('id', patientId)
      .maybeSingle();
    if (error || !data || !(data as any).billing_accounts) return null;
    return (data as any).billing_accounts;
  },

  async createAccount(account, initialDeposit, paymentMethod, linkedPatientIds, createdBy) {
    const supabase = createClient();
    const accountId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error: accError } = await supabase.from('billing_accounts').insert([{
      id: accountId,
      organization_id: account.organization_id,
      name: account.name,
      owner_patient_id: account.owner_patient_id,
      balance: initialDeposit,
      credit_limit: account.credit_limit || 0,
      type: account.type,
      created_at: now,
      updated_at: now,
    }]);
    if (accError) throw accError;

    // The owner is a member of their own account; Set keeps them from being listed twice.
    const allPatientIds = Array.from(new Set([account.owner_patient_id, ...linkedPatientIds]));
    const { error: linkError } = await supabase
      .from('patients')
      .update({ billing_account_id: accountId })
      .in('id', allPatientIds);
    if (linkError) throw linkError;

    if (initialDeposit > 0) {
      const { error: ledError } = await supabase.from('billing_ledger_transactions').insert([{
        id: crypto.randomUUID(),
        organization_id: account.organization_id,
        billing_account_id: accountId,
        patient_id: account.owner_patient_id,
        type: 'deposit',
        amount: initialDeposit,
        description: 'Initial deposit upon account opening',
        payment_method: paymentMethod,
        created_by: createdBy,
        created_at: now,
      }]);
      if (ledError) throw ledError;
    }
  },

  /**
   * Adds to the wallet and records the deposit in one transaction, via the
   * `deposit_to_wallet` Postgres function (supabase_deposit_atomicity.sql).
   *
   * If that function is not deployed yet, falls back to the previous sequential
   * writes so an app release cannot outrun the migration. The fallback is NOT
   * safe against two deposits at the same moment — that is what the function
   * exists to fix.
   */
  async deposit(accountId, amount, description, paymentMethod, createdBy, organizationId, patientId) {
    const supabase = createClient();
    const now = new Date().toISOString();

    const depositAmount = Number(amount);
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      throw new Error('Deposit amount must be a positive number');
    }

    const ledger = {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      billing_account_id: accountId,
      patient_id: patientId || null,
      type: 'deposit',
      amount: depositAmount,
      description,
      payment_method: paymentMethod,
      created_by: createdBy,
      created_at: now,
    };

    const { error } = await supabase.rpc('deposit_to_wallet', {
      p_account: { id: accountId, organization_id: organizationId, amount: depositAmount, updated_at: now },
      p_ledger: ledger,
    });

    if (!error) return;

    if (isMissingFunction(error)) {
      console.warn(
        '[billing] deposit_to_wallet is not deployed; falling back to non-atomic ' +
        'writes. Apply supabase_deposit_atomicity.sql to fix this.',
      );
      return cloudBillingRepository.depositSequentially(accountId, depositAmount, ledger, now);
    }

    if (/INVALID_DEPOSIT_AMOUNT/.test(error.message || '')) {
      throw new Error('Deposit amount must be a positive number');
    }
    if (/BILLING_ACCOUNT_NOT_FOUND/.test(error.message || '')) {
      throw new Error('Billing account not found');
    }
    throw new Error(error.message || 'Failed to record deposit');
  },

  /** The pre-atomicity write path, kept only as the fallback. */
  async depositSequentially(accountId: string, amount: number, ledger: Record<string, any>, now: string) {
    const supabase = createClient();

    const { data: acc, error: accErr } = await supabase
      .from('billing_accounts')
      .select('balance')
      .eq('id', accountId)
      .single();
    if (accErr) throw accErr;

    const { error: upErr } = await supabase
      .from('billing_accounts')
      .update({ balance: ((acc as any).balance || 0) + amount, updated_at: now })
      .eq('id', accountId);
    if (upErr) throw upErr;

    const { error: ledErr } = await supabase.from('billing_ledger_transactions').insert([ledger]);
    if (ledErr) throw ledErr;
  },

  /**
   * Debits the wallet and records the charge in one transaction, via the
   * `log_external_department_charge` Postgres function (supabase_wallet_atomicity.sql).
   *
   * If that function is not deployed yet, falls back to the previous sequential
   * writes so an app release cannot outrun the migration. The fallback is NOT
   * atomic — see `logExternalChargeSequentially`.
   */
  async logExternalCharge(charge) {
    const supabase = createClient();
    const chargeId = crypto.randomUUID();
    const now = new Date().toISOString();

    const chargeRow = {
      id: chargeId,
      organization_id: charge.organizationId,
      patient_id: charge.patientId,
      billing_account_id: charge.paymentMethod === 'wallet' ? charge.billingAccountId : null,
      department: charge.department,
      receipt_number: charge.receiptNumber,
      amount: charge.amount,
      payment_method: charge.paymentMethod,
      status: charge.status || 'paid',
      description: charge.description || null,
      created_by: charge.createdBy,
      created_at: now,
    };

    const ledgerRow = {
      id: crypto.randomUUID(),
      organization_id: charge.organizationId,
      billing_account_id: charge.billingAccountId,
      patient_id: charge.patientId,
      type: 'charge',
      amount: -charge.amount,
      description: `${charge.department.toUpperCase()} Bill - Ref: ${charge.receiptNumber}`,
      reference_id: charge.receiptNumber,
      payment_method: 'wallet',
      created_by: charge.createdBy,
      created_at: now,
    };

    const { error } = await supabase.rpc('log_external_department_charge', {
      p_charge: chargeRow,
      p_ledger: ledgerRow,
    });

    if (!error) return;

    if (isMissingFunction(error)) {
      console.warn(
        '[billing] log_external_department_charge is not deployed; falling back to ' +
        'non-atomic writes. Apply supabase_wallet_atomicity.sql to fix this.',
      );
      return cloudBillingRepository.logExternalChargeSequentially(charge, chargeId, now);
    }

    throw toBillingError(error);
  },

  /**
   * The pre-atomicity write path, kept only as the fallback for a database
   * where the function has not been applied yet. A failure part-way through
   * leaves the wallet debited with no record of why.
   */
  async logExternalChargeSequentially(
    charge: Omit<ExternalDepartmentCharge, 'id' | 'createdAt'>,
    chargeId: string,
    now: string,
  ) {
    const supabase = createClient();

    if (charge.paymentMethod === 'wallet' && charge.billingAccountId) {
      const { data: acc, error: accErr } = await supabase
        .from('billing_accounts')
        .select('balance, credit_limit')
        .eq('id', charge.billingAccountId)
        .single();
      if (accErr) throw accErr;

      const currentBalance = (acc as any).balance || 0;
      const available = currentBalance + ((acc as any).credit_limit || 0);
      if (available < charge.amount) {
        throw new Error(`Insufficient wallet balance. Available credit: ₦${available.toLocaleString('en-NG')}`);
      }

      const { error: upErr } = await supabase
        .from('billing_accounts')
        .update({ balance: currentBalance - charge.amount, updated_at: now })
        .eq('id', charge.billingAccountId);
      if (upErr) throw upErr;

      const { error: ledErr } = await supabase.from('billing_ledger_transactions').insert([{
        id: crypto.randomUUID(),
        organization_id: charge.organizationId,
        billing_account_id: charge.billingAccountId,
        patient_id: charge.patientId,
        type: 'charge',
        amount: -charge.amount,
        description: `${charge.department.toUpperCase()} Bill - Ref: ${charge.receiptNumber}`,
        reference_id: charge.receiptNumber,
        payment_method: 'wallet',
        created_by: charge.createdBy,
        created_at: now,
      }]);
      if (ledErr) throw ledErr;
    }

    const { error: chErr } = await supabase.from('external_department_charges').insert([{
      id: chargeId,
      organization_id: charge.organizationId,
      patient_id: charge.patientId,
      // Only a wallet charge is attributed to the wallet, even if one is linked.
      billing_account_id: charge.paymentMethod === 'wallet' ? charge.billingAccountId : null,
      department: charge.department,
      receipt_number: charge.receiptNumber,
      amount: charge.amount,
      payment_method: charge.paymentMethod,
      status: charge.status || 'paid',
      description: charge.description || null,
      created_by: charge.createdBy,
      created_at: now,
    }]);
    if (chErr) throw chErr;
  },

  /**
   * Records the opposite of a transaction, leaving the original in place.
   *
   * Uses the same deposit_to_wallet function, because a reversal of a charge is
   * arithmetically a deposit — and it is the one path that already moves the
   * balance and writes the ledger row together.
   */
  async reverseTransaction(transactionId, reason, createdBy, organizationId) {
    const supabase = createClient();
    const now = new Date().toISOString();

    const { data: original, error: readErr } = await supabase
      .from('billing_ledger_transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (readErr) throw readErr;
    if (!original) throw new Error('That transaction could not be found');

    const tx = original as any;
    if (tx.type === 'reversal') throw new Error('That entry is itself a reversal');

    // One reversal per entry, or a charge could be handed back repeatedly.
    const { count: alreadyReversed } = await supabase
      .from('billing_ledger_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('type', 'reversal')
      .eq('reference_id', transactionId);

    if ((alreadyReversed ?? 0) > 0) throw new Error('That transaction has already been reversed');

    const restored = -Number(tx.amount || 0);
    if (!Number.isFinite(restored) || restored === 0) {
      throw new Error('That transaction has no amount to reverse');
    }

    // Checked before anything is written. deposit_to_wallet only ever adds, so
    // undoing a deposit — which has to subtract — is not something it can do,
    // and finding that out after the call would have handed the money over and
    // then reported failure.
    if (restored < 0) {
      throw new Error('Reversing a deposit is not supported yet. Record a withdrawal instead.');
    }

    const ledger = {
      id: crypto.randomUUID(),
      organization_id: organizationId,
      billing_account_id: tx.billing_account_id,
      patient_id: tx.patient_id || null,
      type: 'reversal',
      amount: restored,
      description: `Reversal of "${tx.description || 'transaction'}" — ${reason}`,
      // Points at what it undoes, so a statement can be read straight through.
      reference_id: transactionId,
      payment_method: tx.payment_method || null,
      created_by: createdBy,
      created_at: now,
    };

    const { error } = await supabase.rpc('deposit_to_wallet', {
      p_account: {
        id: tx.billing_account_id,
        organization_id: organizationId,
        amount: restored,
        updated_at: now,
      },
      p_ledger: ledger,
    });

    if (!error) return;

    if (isMissingFunction(error as RpcError)) {
      throw new Error(
        'Reversal needs the deposit_to_wallet database function. Apply supabase_deposit_atomicity.sql first.',
      );
    }
    throw toBillingError(error as RpcError);
  },

  async listLedger(accountId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('billing_ledger_transactions')
      .select('*')
      .eq('billing_account_id', accountId)
      .order('created_at', { ascending: false });
    if (error) { console.error('fetchAccountLedger error:', error); return []; }
    return data || [];
  },

  async listExternalCharges(organizationId) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('external_department_charges')
      .select('*, patient:patients(first_name, surname, middle_name, slip_number)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) { console.error('fetchExternalCharges error:', error); return []; }

    return (data || []).map((c: any) => ({
      id: c.id,
      organizationId: c.organization_id,
      patientId: c.patient_id,
      billingAccountId: c.billing_account_id,
      department: c.department,
      receiptNumber: c.receipt_number,
      amount: c.amount,
      paymentMethod: c.payment_method,
      status: c.status,
      description: c.description,
      createdBy: c.created_by,
      createdAt: c.created_at,
      patientName: c.patient
        ? [c.patient.first_name, c.patient.middle_name, c.patient.surname].filter(Boolean).join(' ')
        : 'Unknown',
      patientSlip: c.patient ? c.patient.slip_number : '',
    }));
  },

  async linkPatient(patientId, billingAccountId) {
    const supabase = createClient();
    const { error } = await supabase
      .from('patients')
      .update({ billing_account_id: billingAccountId, updated_at: new Date().toISOString() })
      .eq('id', patientId);
    if (error) throw error;
  },

  async setCreditLimit(accountId, newLimit) {
    const supabase = createClient();
    const { error } = await supabase.from('billing_accounts').update({ credit_limit: newLimit }).eq('id', accountId);
    if (error) throw error;
  },

  async upgradeToFamily(accountId) {
    const supabase = createClient();
    const { error } = await supabase.from('billing_accounts').update({ type: 'family' }).eq('id', accountId);
    if (error) throw error;
  },
};

export const getBillingRepository = (mode: RuntimeMode = RUNTIME_MODE): BillingRepository =>
  mode === 'local' ? localBillingRepository : cloudBillingRepository;
