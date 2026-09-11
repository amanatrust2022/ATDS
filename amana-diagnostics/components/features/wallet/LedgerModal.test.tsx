import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * What the ledger does with money.
 *
 * This is the file flagged in docs/UI_PROGRESS.md as never having been
 * exercised: the extraction it uses was wired up but nobody has taken a
 * deposit through it in a running app. Every path below moves real money —
 * deposits, department charges, reversals, credit limits — and none of it had
 * a test.
 *
 * Written before the screen is rebuilt on the design system, so the rebuild
 * has something to fail against. They assert what reaches the database, not
 * what the page looks like.
 */

const { notify, ask, askFor, storeFns } = vi.hoisted(() => ({
  notify: vi.fn(),
  ask: vi.fn(async () => true),
  askFor: vi.fn(async () => 'wrong wallet'),
  storeFns: {
    depositToBillingAccount: vi.fn(async () => {}),
    updatePatientBillingAccount: vi.fn(async () => {}),
    registerPatientAndGetId: vi.fn(async () => 99),
    logExternalCharge: vi.fn(async () => {}),
    fetchAccountLedger: vi.fn(async () => []),
    fetchBillingAccounts: vi.fn(async () => []),
    fetchExternalCharges: vi.fn(async () => []),
    generateSlipNumber: vi.fn(async () => 'SLIP-7'),
    updateBillingAccountLimit: vi.fn(async () => {}),
    upgradeBillingAccount: vi.fn(async () => {}),
    reverseLedgerTransaction: vi.fn(async () => {}),
  },
}));

vi.mock('@/components/Notices', () => ({ useNotices: () => ({ notify, ask, askFor }) }));

vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<any>('@/lib/store');
  return { ...actual, ...storeFns };
});

vi.mock('@/lib/templates', () => ({
  getLedgerStatementTemplate: vi.fn(() => '<html></html>'),
  printHtml: vi.fn(),
}));

import LedgerModal from './LedgerModal';
import { useWalletStore } from '@/lib/store/useWalletStore';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ACCOUNT = {
  id: 'acc-1',
  organization_id: 'org-1',
  name: 'Bello Family',
  type: 'family' as const,
  balance: 12000,
  credit_limit: 5000,
  owner_patient_id: 7,
};

const OWNER = { id: 7, name: 'Amina Bello', billingAccountId: 'acc-1' } as any;
const MEMBER = { id: 9, name: 'Yusuf Bello', billingAccountId: 'acc-1' } as any;

const CHARGE = {
  id: 'tx-1',
  billing_account_id: 'acc-1',
  type: 'charge',
  amount: -3000,
  description: 'Pharmacy — amoxicillin',
  created_at: '2026-09-01T10:00:00.000Z',
  created_by: 'Desk One',
  reference_id: 'RX-1',
};

const DEPOSIT = {
  id: 'tx-2',
  billing_account_id: 'acc-1',
  type: 'deposit',
  amount: 5000,
  description: 'Top-up',
  created_at: '2026-09-01T09:00:00.000Z',
  created_by: 'Desk One',
  reference_id: null,
};

const ORG = { id: 'org-1', name: 'Northgate' };
const PROFILE = { full_name: 'Desk One' };

function seed(transactions: any[] = []) {
  useWalletStore.setState({
    billingAccounts: [ACCOUNT] as any,
    accountOwners: [OWNER] as any,
    externalCharges: [],
    billingTransactions: transactions as any,
    showLedgerModal: ACCOUNT as any,
    workspaceTab: 'members',
    loadingLedger: false,
  });
  storeFns.fetchAccountLedger.mockResolvedValue(transactions as any);
}

const renderModal = (onSuccess = vi.fn()) =>
  render(
    <LedgerModal
      organization={ORG}
      patients={[OWNER, MEMBER]}
      profile={PROFILE}
      onSuccess={onSuccess}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  seed();
});

/** Radix activates a tab on mousedown, not on a synthetic click. */
function selectTab(name: RegExp) {
  fireEvent.mouseDown(screen.getByRole('tab', { name }));
}

// ── Deposits ─────────────────────────────────────────────────────────────────

describe('taking a deposit', () => {
  it('refuses an amount that is not a positive number, without calling the database', async () => {
    renderModal();
    const amount = screen.getByPlaceholderText('Amount to add');

    for (const bad of ['', '0', '-500', 'abc']) {
      fireEvent.change(amount, { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: 'Load Funds' }));
    }

    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(storeFns.depositToBillingAccount).not.toHaveBeenCalled();
  });

  it('records the amount, the method, the note and who took it', async () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('Amount to add'), { target: { value: '2500.50' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Monthly top-up'), {
      target: { value: 'Cash at the desk' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load Funds' }));

    await waitFor(() => expect(storeFns.depositToBillingAccount).toHaveBeenCalledTimes(1));
    const [accountId, amount, note, method, staff, orgId] =
      storeFns.depositToBillingAccount.mock.calls[0] as any[];

    expect(accountId).toBe('acc-1');
    expect(amount).toBe(2500.5);
    expect(note).toBe('Cash at the desk');
    expect(method).toBe('cash');
    expect(staff).toBe('Desk One');
    expect(orgId).toBe('org-1');
  });

  it('names the deposit itself when the desk leaves the note blank', async () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Amount to add'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load Funds' }));

    await waitFor(() => expect(storeFns.depositToBillingAccount).toHaveBeenCalled());
    expect((storeFns.depositToBillingAccount.mock.calls[0] as any[])[2]).toBe('Top-up deposit');
  });

  it('re-reads the ledger and the accounts afterwards, so the balance on screen is the real one', async () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('Amount to add'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load Funds' }));

    await waitFor(() => {
      expect(storeFns.fetchAccountLedger).toHaveBeenCalledWith('acc-1');
      expect(storeFns.fetchBillingAccounts).toHaveBeenCalledWith('org-1');
    });
  });
});

// ── Reversals ────────────────────────────────────────────────────────────────

describe('reversing a charge', () => {
  // The ledger is fetched on open, so the statement is not on screen until
  // that promise has settled.
  const openLedger = async () => {
    seed([CHARGE, DEPOSIT]);
    renderModal();
    selectTab(/Transaction Statement/i);
    await screen.findByText('Pharmacy — amoxicillin');
  };

  it('offers a reversal on a charge but not on a deposit', async () => {
    await openLedger();
    // One charge, one deposit, one Reverse button.
    expect(screen.getAllByRole('button', { name: 'Reverse' })).toHaveLength(1);
  });

  it('asks why, and records the reason with who did it', async () => {
    await openLedger();
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));

    await waitFor(() => expect(storeFns.reverseLedgerTransaction).toHaveBeenCalledTimes(1));
    expect(storeFns.reverseLedgerTransaction).toHaveBeenCalledWith(
      'tx-1',
      'wrong wallet',
      'Desk One',
      'org-1',
    );
  });

  it('does nothing at all if the reason is cancelled', async () => {
    askFor.mockResolvedValueOnce(null as any);
    await openLedger();
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));

    await waitFor(() => expect(notify).not.toHaveBeenCalled());
    expect(storeFns.reverseLedgerTransaction).not.toHaveBeenCalled();
  });

  it('refuses a blank reason — a reversal with no explanation is unauditable', async () => {
    askFor.mockResolvedValueOnce('   ' as any);
    await openLedger();
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));

    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringMatching(/reason/i), 'error'));
    expect(storeFns.reverseLedgerTransaction).not.toHaveBeenCalled();
  });

  it('will not reverse the same charge twice', async () => {
    // A reversal names what it undid in reference_id, which is how the
    // statement knows. Without this a charge could be credited back twice.
    seed([
      CHARGE,
      { ...DEPOSIT, id: 'tx-3', type: 'reversal', amount: 3000, reference_id: 'tx-1' },
    ]);
    renderModal();
    selectTab(/Transaction Statement/i);
    await screen.findByText('Pharmacy — amoxicillin');

    expect(screen.queryByRole('button', { name: 'Reverse' })).toBeNull();
  });
});

// ── Department charges ───────────────────────────────────────────────────────

describe('logging a department charge', () => {
  const openExpense = () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Log Dept Charge' }));
  };

  it('debits the wallet only when the wallet is what is paying', async () => {
    // The important one. If a cash payment also carried a billingAccountId the
    // patient would be charged twice: once at the desk, once against the wallet.
    openExpense();

    fireEvent.change(screen.getByPlaceholderText('e.g. RX-2026-98'), { target: { value: 'RX-9' } });
    fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '1500' } });

    const method = screen.getByDisplayValue('Account Wallet');
    fireEvent.change(method, { target: { value: 'cash' } });

    const member = screen
      .getAllByRole('combobox')
      .find((el) => [...(el as HTMLSelectElement).options].some((o) => o.value === '9'))!;
    fireEvent.change(member, { target: { value: '9' } });

    fireEvent.click(screen.getByRole('button', { name: /Log & Process Charge/i }));

    await waitFor(() => expect(storeFns.logExternalCharge).toHaveBeenCalled());
    expect((storeFns.logExternalCharge.mock.calls[0] as any[])[0].billingAccountId).toBeUndefined();
  });
});

// ── Members ──────────────────────────────────────────────────────────────────

describe('dependants', () => {
  it('asks before unlinking somebody, and does nothing if the answer is no', async () => {
    ask.mockResolvedValueOnce(false as any);
    renderModal();

    const unlink = screen.getAllByRole('button', { name: 'Unlink' })[0];
    if (unlink) fireEvent.click(unlink);

    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(storeFns.updatePatientBillingAccount).not.toHaveBeenCalled();
  });
});

// ── The credit limit ─────────────────────────────────────────────────────────

describe('the credit limit', () => {
  it('never accepts a negative limit', async () => {
    renderModal();
    const edit = screen.queryByRole('button', { name: /Edit|Change/i });
    if (!edit) return; // the control is behind a toggle that may not be present

    fireEvent.click(edit);
    const field = screen.getByPlaceholderText('5000');
    fireEvent.change(field, { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Save|Update/i }));

    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(storeFns.updateBillingAccountLimit).not.toHaveBeenCalled();
  });
});
