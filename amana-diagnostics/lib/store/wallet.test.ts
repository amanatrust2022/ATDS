import { describe, it, expect, beforeEach } from 'vitest';
import { useWalletStore } from './useWalletStore';

describe('useWalletStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useWalletStore.setState({
      accountForm: { name: '', type: 'individual', creditLimit: '0', initialDeposit: '0', paymentMethod: 'cash', ownerId: '', linkedIds: [] },
      isOwnerNew: false,
      newOwnerForm: { firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', address: '' },
      newDependentsToRegister: [],
      workspaceTab: 'members',
      showLedgerModal: null,
      billingAccounts: [],
      billingTransactions: []
    });
  });

  it('should reset account form properly', () => {
    const store = useWalletStore.getState();
    store.updateAccountForm({ name: 'Test Wallet', type: 'family' });
    expect(useWalletStore.getState().accountForm.name).toBe('Test Wallet');

    store.resetAccountForm();
    const resetStore = useWalletStore.getState();
    expect(resetStore.accountForm.name).toBe('');
    expect(resetStore.accountForm.type).toBe('individual');
  });

  it('should manage dependents', () => {
    const store = useWalletStore.getState();
    store.addDependent();
    expect(useWalletStore.getState().newDependentsToRegister).toHaveLength(1);

    const tempId = useWalletStore.getState().newDependentsToRegister[0].tempId;
    store.updateDependent(tempId, 'firstName', 'John');
    
    expect(useWalletStore.getState().newDependentsToRegister[0].firstName).toBe('John');

    store.removeDependent(tempId);
    expect(useWalletStore.getState().newDependentsToRegister).toHaveLength(0);
  });

  it('should manage ledger state', () => {
    const store = useWalletStore.getState();
    const mockAccount = { id: 'acc_1', name: 'Test', type: 'individual', balance: 0, credit_limit: 0, created_at: '' };
    
    store.openLedger(mockAccount as any);
    expect(useWalletStore.getState().showLedgerModal).toEqual(mockAccount);
    expect(useWalletStore.getState().workspaceTab).toBe('members');

    store.closeLedger();
    expect(useWalletStore.getState().showLedgerModal).toBeNull();
  });
});
