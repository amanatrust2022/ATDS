import { createClient } from '@/lib/supabase';
import { RuntimeMode, RUNTIME_MODE } from '@/lib/runtimeMode';
import { postJson } from './localHttp';
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
  listLedger(accountId: string): Promise<BillingLedgerTransaction[]>;
  listExternalCharges(organizationId: string): Promise<ExternalDepartmentCharge[]>;
  linkPatient(patientId: number | string, billingAccountId: string | null): Promise<void>;
  setCreditLimit(accountId: string, newLimit: number): Promise<void>;
  upgradeToFamily(accountId: string): Promise<void>;
}

const ENDPOINT = '/api/billing';

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

export const cloudBillingRepository: BillingRepository = {
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

  async deposit(accountId, amount, description, paymentMethod, createdBy, organizationId, patientId) {
    const supabase = createClient();
    const now = new Date().toISOString();

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

    const { error: ledErr } = await supabase.from('billing_ledger_transactions').insert([{
      id: crypto.randomUUID(),
      organization_id: organizationId,
      billing_account_id: accountId,
      patient_id: patientId || null,
      type: 'deposit',
      amount,
      description,
      payment_method: paymentMethod,
      created_by: createdBy,
      created_at: now,
    }]);
    if (ledErr) throw ledErr;
  },

  /**
   * NOTE: the wallet debit, its ledger entry and the charge row are three
   * separate writes with no transaction around them. A failure between them
   * leaves the wallet debited without a matching record. Making this atomic
   * needs a Postgres function; the behaviour is preserved here as-is.
   */
  async logExternalCharge(charge) {
    const supabase = createClient();
    const chargeId = crypto.randomUUID();
    const now = new Date().toISOString();

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
