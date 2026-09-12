import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the billing wallet.
 *
 * These exist because this exact extraction has already gone wrong here once.
 * WalletTab, BillingAccountModal and LedgerModal sat in the tree for months
 * imported-but-never-rendered, while ReceptionPage ran an inline copy — the
 * pattern the DepartmentPage tests were written to catch: "copied state
 * instead of moving it and shipped dead buttons behind a green build."
 *
 * So the point of this file is not coverage. It is that every control reaches
 * something, and that the columns the inline copy showed are still shown.
 * Wiring it up already turned up three silent gaps: no Owner column, no Credit
 * Limit column, and an externalCharges field with no setter, so the Charges tab
 * could only ever be empty.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// vi.mock is hoisted above every const in the file, so anything a factory
// closes over has to be hoisted with it.
const { notify, ask, askFor, storeFns } = vi.hoisted(() => ({
  notify: vi.fn(),
  ask: vi.fn(async () => true),
  askFor: vi.fn(async () => 'a reason'),
  storeFns: {
    createBillingAccount: vi.fn(async () => {}),
    depositToBillingAccount: vi.fn(async () => {}),
    updatePatientBillingAccount: vi.fn(async () => {}),
    registerPatientAndGetId: vi.fn(async () => 99),
    logExternalCharge: vi.fn(async () => {}),
    fetchAccountLedger: vi.fn(async () => []),
    fetchBillingAccounts: vi.fn(async () => []),
    generateSlipNumber: vi.fn(async () => 'SLIP-1'),
    updateBillingAccountLimit: vi.fn(async () => {}),
    upgradeBillingAccount: vi.fn(async () => {}),
    reverseLedgerTransaction: vi.fn(async () => {}),
    fetchPatients: vi.fn(async () => []),
  },
}));
vi.mock('@/components/Notices', () => ({
  useNotices: () => ({ notify, ask, askFor }),
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ session: null, profile: { full_name: 'Desk One' } }),
}));

vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<any>('@/lib/store');
  return { ...actual, ...storeFns };
});

vi.mock('@/lib/templates', () => ({
  getLedgerStatementTemplate: vi.fn(() => '<html></html>'),
  printHtml: vi.fn(),
}));

import WalletTab from './WalletTab';
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

const DEPLETED = {
  ...ACCOUNT,
  id: 'acc-2',
  name: 'Okafor Individual',
  type: 'individual' as const,
  balance: 0,
  credit_limit: 0,
  owner_patient_id: 8,
};

const OWNER = { id: 7, name: 'Amina Bello', billingAccountId: 'acc-1' } as any;
const OWNER_2 = { id: 8, name: 'Chidi Okafor', billingAccountId: 'acc-2' } as any;
const MEMBER = { id: 9, name: 'Yusuf Bello', billingAccountId: 'acc-1' } as any;

const ORG = { id: 'org-1', name: 'Northgate' };
const PROFILE = { full_name: 'Desk One' };

function seed(accounts = [ACCOUNT, DEPLETED]) {
  useWalletStore.setState({
    billingAccounts: accounts as any,
    accountOwners: [OWNER, OWNER_2] as any,
    externalCharges: [],
    billingTransactions: [],
    billingSearchQuery: '',
    showBillingAccountModal: false,
    showLedgerModal: null,
  });
}

const renderTab = (patients: any[] = [OWNER, OWNER_2, MEMBER]) =>
  render(
    <WalletTab
      organization={ORG}
      patients={patients}
      profile={PROFILE}
      refresh={vi.fn()}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  seed();
});

// ── The directory ────────────────────────────────────────────────────────────

describe('the wallet directory', () => {
  it('shows every column the inline version showed', () => {
    renderTab();
    for (const heading of [
      'Account',
      'Owner',
      'Type',
      'Members',
      'Balance',
      'Credit limit',
      'Status',
    ]) {
      expect(
        screen.getByRole('columnheader', { name: new RegExp(heading, 'i') }),
      ).toBeTruthy();
    }
  });

  it('resolves the owner name from the owners list, not from every patient', () => {
    // The narrow owner-only fetch exists precisely so this column does not
    // require loading everyone ever billed to a wallet.
    renderTab([]); // no queue patients at all
    expect(screen.getByText('Amina Bello')).toBeTruthy();
    expect(screen.getByText('Chidi Okafor')).toBeTruthy();
  });

  it('counts members from the queue, per account', () => {
    renderTab();
    const row = screen.getByText('Bello Family').closest('tr')!;
    // Amina (owner) and Yusuf are on acc-1; Chidi is not.
    expect(within(row).getByText('2')).toBeTruthy();
  });

  it('shows the balance and the credit limit as money', () => {
    renderTab();
    const row = screen.getByText('Bello Family').closest('tr')!;
    expect(within(row).getByText(/12,000\.00/)).toBeTruthy();
    expect(within(row).getByText(/5,000\.00/)).toBeTruthy();
  });

  it('calls an account with no spendable balance depleted', () => {
    renderTab();
    const active = screen.getByText('Bello Family').closest('tr')!;
    const depleted = screen.getByText('Okafor Individual').closest('tr')!;
    expect(within(active).getByText('Active')).toBeTruthy();
    expect(within(depleted).getByText('Depleted')).toBeTruthy();
  });

  it('treats the credit limit as spendable when the balance is zero', () => {
    seed([{ ...DEPLETED, balance: 0, credit_limit: 3000 }]);
    renderTab();
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('filters by account name', () => {
    renderTab();
    fireEvent.change(screen.getByLabelText(/Search accounts/i), {
      target: { value: 'okafor' },
    });
    expect(screen.queryByText('Bello Family')).toBeNull();
    expect(screen.getByText('Okafor Individual')).toBeTruthy();
  });

  it('says so when a search matches nothing, and offers a way back', () => {
    renderTab();
    fireEvent.change(screen.getByLabelText(/Search accounts/i), {
      target: { value: 'zzzz' },
    });
    expect(screen.getByText(/No account matches that name/i)).toBeTruthy();
  });

  it('offers to open an account when there are none', () => {
    seed([]);
    renderTab();
    expect(screen.getByText(/No billing accounts yet/i)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Open an account/i }).length).toBeGreaterThan(0);
  });
});

// ── The buttons actually do something ────────────────────────────────────────

describe('every control reaches something', () => {
  it('"Open an account" opens the account modal', async () => {
    renderTab();
    fireEvent.click(screen.getAllByRole('button', { name: /Open an account/i })[0]!);
    await waitFor(() =>
      expect(useWalletStore.getState().showBillingAccountModal).toBe(true),
    );
  });

  it('"Open an account" clears whatever the last attempt left behind', async () => {
    useWalletStore.setState({
      accountForm: {
        ...useWalletStore.getState().accountForm,
        name: 'left over from last time',
      },
    });
    renderTab();
    fireEvent.click(screen.getAllByRole('button', { name: /Open an account/i })[0]!);
    await waitFor(() => expect(useWalletStore.getState().accountForm.name).toBe(''));
  });

  it('"Manage" opens that account\'s ledger, not some other one', async () => {
    renderTab();
    const row = screen.getByText('Okafor Individual').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /Manage/i }));
    await waitFor(() =>
      expect(useWalletStore.getState().showLedgerModal?.id).toBe('acc-2'),
    );
  });

  it('opening a ledger lands on the members tab', async () => {
    useWalletStore.setState({ workspaceTab: 'charges' });
    renderTab();
    const row = screen.getByText('Bello Family').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /Manage/i }));
    await waitFor(() => expect(useWalletStore.getState().workspaceTab).toBe('members'));
  });
});

// ── The store gaps that made this dead ───────────────────────────────────────

describe('the store can hold what the screens need', () => {
  it('accepts external charges — there was no setter for them at all', () => {
    const charge = {
      id: 'ec-1',
      billingAccountId: 'acc-1',
      amount: 2500,
      description: 'Pharmacy',
    } as any;
    useWalletStore.getState().setExternalCharges([charge]);
    expect(useWalletStore.getState().externalCharges).toEqual([charge]);
  });

  it('accepts account owners', () => {
    useWalletStore.getState().setAccountOwners([OWNER]);
    expect(useWalletStore.getState().accountOwners).toEqual([OWNER]);
  });
  /**
   * An account in debt was told apart from one in credit by the colour of its
   * figure alone — green against red — with the minus buried mid-string after
   * the naira sign ("₦-500.00"). Colour is never the only channel (rule 5),
   * and a receptionist who cannot separate the two had to read the hyphen.
   */
  it('says in words that an account is overdrawn', () => {
    seed([{ ...DEPLETED, balance: -500 }]);
    renderTab();

    const row = screen.getByText('Okafor Individual').closest('tr')!;
    expect(within(row).getByText(/owing/i)).toBeTruthy();
  });
});
