import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for opening a billing account.
 *
 * Written before the screen was rebuilt, for the reason recorded in decision
 * #28: this is the form that registers patients and takes the opening deposit,
 * and an extraction that quietly drops a clause here costs real money.
 *
 * What they pin down is the order of writes. Opening a family wallet for people
 * who are not yet registered performs several writes in sequence — the owner,
 * then each dependant, then the account and its deposit — and none of it is in
 * a transaction. So what matters is that nothing is written until everything
 * has been checked.
 */

const { notify, storeFns } = vi.hoisted(() => ({
  notify: vi.fn(),
  // Argument types are spelled out so `mock.calls[0]` is a tuple rather than
  // `[]` — these tests are almost entirely about what was passed.
  storeFns: {
    createBillingAccount: vi.fn(
      async (
        _payload: Record<string, unknown>,
        _deposit: number,
        _method: string,
        _linked: (number | string)[],
        _by: string,
      ) => {},
    ),
    registerPatientAndGetId: vi.fn(
      async (_data: Record<string, unknown>, _orgId: string): Promise<number | string> => 99,
    ),
    generateSlipNumber: vi.fn(async (_orgId: string) => 'SLIP-1'),
    depositToBillingAccount: vi.fn(async () => {}),
  },
}));

vi.mock('@/components/Notices', () => ({
  useNotices: () => ({ notify, ask: vi.fn(async () => true), askFor: vi.fn(async () => '') }),
}));

vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<any>('@/lib/store');
  return { ...actual, ...storeFns };
});

import BillingAccountModal from './BillingAccountModal';
import { useWalletStore } from '@/lib/store/useWalletStore';
import type { Patient } from '@/lib/store';

const organization = { id: 'org-1', name: 'Amana Diagnostics' };
const profile = { full_name: 'Desk One' };

function patient(over: Partial<Patient> & Pick<Patient, 'id' | 'firstName' | 'surname'>): Patient {
  return {
    middleName: '',
    slipNumber: `S-00${over.id}`,
    registeredAt: '2026-01-01T09:00:00.000Z',
    name: `${over.firstName} ${over.surname}`,
    age: '30',
    sex: 'Male',
    phone: '',
    address: '',
    referredBy: '',
    tests: [],
    ...over,
  };
}

const patients: Patient[] = [
  patient({ id: 1, firstName: 'Amina', surname: 'Bello', phone: '08030000001' }),
  patient({ id: 2, firstName: 'Musa', middleName: 'Sani', surname: 'Yusuf', phone: '08030000002' }),
];

const onSuccess = vi.fn();

function open() {
  return render(
    <BillingAccountModal
      organization={organization}
      patients={patients}
      profile={profile}
      onSuccess={onSuccess}
    />,
  );
}

/** The store is real, not mocked — these forms live in it. */
function resetStore() {
  useWalletStore.setState({
    accountForm: {
      name: '',
      type: 'individual',
      creditLimit: '0',
      initialDeposit: '0',
      paymentMethod: 'cash',
      ownerId: '',
      linkedIds: [],
    },
    isOwnerNew: false,
    newOwnerForm: {
      firstName: '',
      surname: '',
      middleName: '',
      age: '',
      sex: 'Male',
      phone: '',
      address: '',
    },
    newDependentsToRegister: [],
    ownerSearchQuery: '',
    ownerSearchPage: 0,
    showOwnerSearchDrop: false,
    showBillingAccountModal: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  storeFns.registerPatientAndGetId.mockResolvedValue(99);
  storeFns.createBillingAccount.mockResolvedValue(undefined);
  resetStore();
});

const submit = () => fireEvent.click(screen.getByRole('button', { name: /open wallet/i }));

describe('BillingAccountModal', () => {
  it('opens an account for a patient who is already registered', async () => {
    useWalletStore.setState({
      accountForm: {
        ...useWalletStore.getState().accountForm,
        name: 'Bello Family Wallet',
        ownerId: '1',
        creditLimit: '5000',
        initialDeposit: '20000',
        paymentMethod: 'pos',
      },
    });
    open();
    submit();

    await waitFor(() => expect(storeFns.createBillingAccount).toHaveBeenCalled());

    const [payload, deposit, method, linked, by] = storeFns.createBillingAccount.mock.calls[0]!;
    expect(payload).toMatchObject({
      organization_id: 'org-1',
      name: 'Bello Family Wallet',
      owner_patient_id: '1',
      credit_limit: 5000,
      type: 'individual',
    });
    expect(deposit).toBe(20000);
    expect(method).toBe('pos');
    expect(linked).toEqual([]);
    expect(by).toBe('Desk One');

    // Nobody was registered — the owner already existed.
    expect(storeFns.registerPatientAndGetId).not.toHaveBeenCalled();
  });

  it('registers a brand new owner first, then opens the account against that id', async () => {
    storeFns.registerPatientAndGetId.mockResolvedValue(555);
    useWalletStore.setState({
      isOwnerNew: true,
      newOwnerForm: {
        firstName: 'Hauwa',
        surname: 'Ibrahim',
        middleName: '',
        age: '34',
        sex: 'Female',
        phone: '08031111111',
        address: 'Kano',
      },
    });
    open();
    submit();

    await waitFor(() => expect(storeFns.createBillingAccount).toHaveBeenCalled());

    expect(storeFns.registerPatientAndGetId).toHaveBeenCalledTimes(1);
    const [patientData] = storeFns.registerPatientAndGetId.mock.calls[0]!;
    expect(patientData).toMatchObject({ firstName: 'Hauwa', surname: 'Ibrahim', sex: 'Female' });

    const [payload] = storeFns.createBillingAccount.mock.calls[0]!;
    expect(payload.owner_patient_id).toBe(555);
    // No account name was typed, so one is derived from the owner.
    expect(payload.name).toBe('Hauwa Ibrahim Wallet');
  });

  it('links every dependant it registers to the new account', async () => {
    storeFns.registerPatientAndGetId
      .mockResolvedValueOnce(100) // owner
      .mockResolvedValueOnce(101) // dependant 1
      .mockResolvedValueOnce(102); // dependant 2

    useWalletStore.setState({
      accountForm: { ...useWalletStore.getState().accountForm, type: 'family', name: 'Ibrahim Family' },
      isOwnerNew: true,
      newOwnerForm: {
        firstName: 'Hauwa', surname: 'Ibrahim', middleName: '', age: '34',
        sex: 'Female', phone: '0803', address: '',
      },
      newDependentsToRegister: [
        { tempId: 1, firstName: 'Zainab', surname: 'Ibrahim', middleName: '', age: '8', sex: 'Female', phone: '', address: '' },
        { tempId: 2, firstName: 'Sadiq', surname: 'Ibrahim', middleName: '', age: '5', sex: 'Male', phone: '', address: '' },
      ],
    });
    open();
    submit();

    await waitFor(() => expect(storeFns.createBillingAccount).toHaveBeenCalled());

    expect(storeFns.registerPatientAndGetId).toHaveBeenCalledTimes(3);
    const [, , , linked] = storeFns.createBillingAccount.mock.calls[0]!;
    expect(linked).toEqual([101, 102]);
  });

  /**
   * The one that matters.
   *
   * A surname of one space on the second dependant is a typo at the desk, and
   * the desk makes typos. A space is chosen deliberately: the field is marked
   * required, and the browser is happy with a space — only `.trim()` is not. So
   * this is the shape of the mistake that actually reaches the submit.
   *
   * The question is what is already in the database by the time anyone is told.
   */
  it('writes nothing at all when a dependant is incomplete', async () => {
    useWalletStore.setState({
      accountForm: { ...useWalletStore.getState().accountForm, type: 'family', name: 'Ibrahim Family' },
      isOwnerNew: true,
      newOwnerForm: {
        firstName: 'Hauwa', surname: 'Ibrahim', middleName: '', age: '34',
        sex: 'Female', phone: '0803', address: '',
      },
      newDependentsToRegister: [
        { tempId: 1, firstName: 'Zainab', surname: 'Ibrahim', middleName: '', age: '8', sex: 'Female', phone: '', address: '' },
        { tempId: 2, firstName: 'Sadiq', surname: '   ', middleName: '', age: '5', sex: 'Male', phone: '', address: '' },
      ],
    });
    open();
    submit();

    await waitFor(() => expect(notify).toHaveBeenCalled());

    // The account was never opened...
    expect(storeFns.createBillingAccount).not.toHaveBeenCalled();
    // ...and nobody was registered either. Not the owner, not the first
    // dependant. Otherwise the desk has patients in the queue owned by no
    // wallet, and pressing the button again makes a second set.
    expect(storeFns.registerPatientAndGetId).not.toHaveBeenCalled();
  });

  it('refuses an existing-owner account with no owner chosen', async () => {
    useWalletStore.setState({
      accountForm: { ...useWalletStore.getState().accountForm, name: 'Some Wallet', ownerId: '' },
    });
    open();
    submit();

    await waitFor(() => expect(notify).toHaveBeenCalled());
    expect(storeFns.createBillingAccount).not.toHaveBeenCalled();
  });

  it('finds an owner by name and by phone, and names the wallet after them', async () => {
    open();

    const search = screen.getByPlaceholderText(/search patient/i);
    fireEvent.change(search, { target: { value: 'musa' } });
    expect(screen.getByText(/Musa Sani Yusuf/)).toBeInTheDocument();
    expect(screen.queryByText(/Amina/)).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: '08030000001' } });
    expect(screen.getByText(/Amina/)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Amina/));

    await waitFor(() => {
      expect(useWalletStore.getState().accountForm.ownerId).toBe('1');
      expect(useWalletStore.getState().accountForm.name).toBe('Amina Bello Wallet');
    });
  });

  it('treats a blank deposit as zero rather than as not-a-number', async () => {
    useWalletStore.setState({
      accountForm: {
        ...useWalletStore.getState().accountForm,
        name: 'W', ownerId: '1', initialDeposit: '', creditLimit: '',
      },
    });
    open();
    submit();

    await waitFor(() => expect(storeFns.createBillingAccount).toHaveBeenCalled());
    const [payload, deposit] = storeFns.createBillingAccount.mock.calls[0]!;
    expect(deposit).toBe(0);
    expect(payload.credit_limit).toBe(0);
  });

  it('tells the desk when the account could not be opened, and stays open', async () => {
    storeFns.createBillingAccount.mockRejectedValue(new Error('network down'));
    useWalletStore.setState({
      accountForm: { ...useWalletStore.getState().accountForm, name: 'W', ownerId: '1' },
    });
    open();
    submit();

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.stringMatching(/network down/i), 'error'),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(useWalletStore.getState().showBillingAccountModal).toBe(true);
  });

  it('closes and refreshes the directory once the account is open', async () => {
    useWalletStore.setState({
      accountForm: { ...useWalletStore.getState().accountForm, name: 'W', ownerId: '1' },
    });
    open();
    submit();

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(useWalletStore.getState().showBillingAccountModal).toBe(false);
    // The new-owner scratch form is cleared, so the next account does not
    // open holding the last one's patient.
    expect(useWalletStore.getState().isOwnerNew).toBe(false);
    expect(useWalletStore.getState().newDependentsToRegister).toEqual([]);
    expect(useWalletStore.getState().newOwnerForm.firstName).toBe('');
  });

  it('gives every control an accessible name', () => {
    open();
    expect(screen.getByLabelText(/account name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/account type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/credit limit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/initial deposit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/deposit method/i)).toBeInTheDocument();
  });
});
