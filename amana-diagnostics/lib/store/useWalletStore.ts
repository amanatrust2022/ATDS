import { create } from 'zustand';
import { BillingAccount, BillingLedgerTransaction, ExternalDepartmentCharge } from '../store';

interface AccountFormState {
  name: string;
  type: 'individual' | 'family';
  creditLimit: string;
  initialDeposit: string;
  paymentMethod: string;
  ownerId: string;
  linkedIds: string[];
}

interface ExpenseFormState {
  patientId: string;
  department: 'pharmacy' | 'consultation' | 'procedure' | 'other';
  receiptNumber: string;
  amount: string;
  paymentMethod: 'wallet' | 'cash' | 'pos' | 'transfer';
  description: string;
}

interface OwnerFormState {
  firstName: string;
  surname: string;
  middleName: string;
  age: string;
  sex: 'Male' | 'Female';
  phone: string;
  address: string;
}

interface WalletState {
  // Directory & Modals
  billingAccounts: BillingAccount[];
  showBillingAccountModal: boolean;
  showLedgerModal: BillingAccount | null;
  billingSearchQuery: string;

  // Account Creation Forms
  accountForm: AccountFormState;
  isOwnerNew: boolean;
  newOwnerForm: OwnerFormState;
  newDependentsToRegister: Array<OwnerFormState & { tempId: number }>;

  // Search Dropdowns
  ownerSearchQuery: string;
  ownerSearchPage: number;
  showOwnerSearchDrop: boolean;
  depSearchQuery: string;
  depSearchPage: number;
  showDepSearchDrop: boolean;

  // Ledger / Management Forms
  workspaceTab: 'members' | 'ledger' | 'charges';
  billingTransactions: BillingLedgerTransaction[];
  loadingLedger: boolean;
  showAddExisting: boolean;
  existingPatientToLink: string;
  showQuickRegisterDep: boolean;
  workspaceDepForm: OwnerFormState;

  // Deposits & Expenses
  depositAmount: string;
  depositMethod: string;
  depositNotes: string;
  depositing: boolean;
  showWorkspaceLogExpense: boolean;
  workspaceExpenseForm: ExpenseFormState;

  // Actions
  setBillingAccounts: (accounts: BillingAccount[]) => void;
  setShowBillingAccountModal: (show: boolean) => void;
  openLedger: (account: BillingAccount) => void;
  closeLedger: () => void;
  setBillingSearchQuery: (query: string) => void;
  setWorkspaceTab: (tab: 'members' | 'ledger' | 'charges') => void;
  setBillingTransactions: (txs: BillingLedgerTransaction[]) => void;
  
  // Form updates
  updateAccountForm: (updates: Partial<AccountFormState>) => void;
  updateNewOwnerForm: (updates: Partial<OwnerFormState>) => void;
  updateWorkspaceDepForm: (updates: Partial<OwnerFormState>) => void;
  updateWorkspaceExpenseForm: (updates: Partial<ExpenseFormState>) => void;
  updateCreditLimit: (accountId: string, newLimit: number) => void;
  upgradeAccountToFamily: (accountId: string) => void;
  
  // Toggles & Basic States
  setIsOwnerNew: (isNew: boolean) => void;
  setOwnerSearchQuery: (q: string) => void;
  setOwnerSearchPage: (page: number) => void;
  externalCharges: ExternalDepartmentCharge[];
  setShowOwnerSearchDrop: (show: boolean) => void;
  setDepSearchQuery: (q: string) => void;
  setShowDepSearchDrop: (show: boolean) => void;
  
  setNewDependentsToRegister: (deps: Array<OwnerFormState & { tempId: number }>) => void;
  addDependent: () => void;
  removeDependent: (tempId: number) => void;
  updateDependent: (tempId: number, field: keyof OwnerFormState, val: string) => void;

  setShowAddExisting: (show: boolean) => void;
  setExistingPatientToLink: (val: string) => void;
  setShowQuickRegisterDep: (show: boolean) => void;
  
  setShowWorkspaceLogExpense: (show: boolean) => void;
  setDepositAmount: (val: string) => void;
  setDepositMethod: (val: string) => void;
  setDepositNotes: (val: string) => void;
  setDepositing: (val: boolean) => void;

  resetAccountForm: () => void;

  submitCreateAccount: (params: {
    organizationId: string;
    profileName: string;
    generateSlipNumber: (orgId: string) => Promise<string>;
    registerPatientAndGetId: (patientData: any, orgId: string) => Promise<number | string>;
    createBillingAccount: (payload: any, depositVal: number, method: string, linkedIds: (number | string)[], createdBy: string) => Promise<void>;
  }) => Promise<void>;

  submitDeposit: (params: {
    accountId: string;
    organizationId: string;
    profileName: string;
    depositToBillingAccount: (accountId: string, amount: number, notes: string, method: string, createdBy: string, orgId: string, ignored?: any) => Promise<void>;
  }) => Promise<void>;
}

const initialOwnerForm: OwnerFormState = { firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', address: '' };
const initialAccountForm: AccountFormState = { name: '', type: 'individual', creditLimit: '0', initialDeposit: '0', paymentMethod: 'cash', ownerId: '', linkedIds: [] };
const initialExpenseForm: ExpenseFormState = { patientId: '', department: 'pharmacy', receiptNumber: '', amount: '', paymentMethod: 'wallet', description: '' };

export const useWalletStore = create<WalletState>((set, get) => ({
  billingAccounts: [],
  showBillingAccountModal: false,
  showLedgerModal: null,
  billingSearchQuery: '',
  
  accountForm: initialAccountForm,
  isOwnerNew: false,
  newOwnerForm: initialOwnerForm,
  newDependentsToRegister: [],
  
  ownerSearchQuery: '',
  ownerSearchPage: 0,
  showOwnerSearchDrop: false,
  depSearchQuery: '',
  depSearchPage: 0,
  showDepSearchDrop: false,

  workspaceTab: 'members',
  billingTransactions: [],
  loadingLedger: false,
  showAddExisting: false,
  existingPatientToLink: '',
  showQuickRegisterDep: false,
  workspaceDepForm: initialOwnerForm,

  depositAmount: '',
  depositMethod: 'cash',
  depositNotes: '',
  depositing: false,
  showWorkspaceLogExpense: false,
  workspaceExpenseForm: initialExpenseForm,

  // Actions
  setBillingAccounts: (accounts) => set({ billingAccounts: accounts }),
  setShowBillingAccountModal: (show) => set({ showBillingAccountModal: show }),
  openLedger: (account) => set({ showLedgerModal: account, workspaceTab: 'members' }),
  closeLedger: () => set({ showLedgerModal: null }),
  setBillingSearchQuery: (query) => set({ billingSearchQuery: query }),
  setWorkspaceTab: (tab) => set({ workspaceTab: tab }),
  setBillingTransactions: (txs) => set({ billingTransactions: txs }),

  updateAccountForm: (updates) => set((s) => ({ accountForm: { ...s.accountForm, ...updates } })),
  updateNewOwnerForm: (updates) => set((s) => ({ newOwnerForm: { ...s.newOwnerForm, ...updates } })),
  updateWorkspaceDepForm: (updates) => set((s) => ({ workspaceDepForm: { ...s.workspaceDepForm, ...updates } })),
  updateWorkspaceExpenseForm: (updates) => set((s) => ({ workspaceExpenseForm: { ...s.workspaceExpenseForm, ...updates } })),
  updateCreditLimit: (accountId, newLimit) => set((s) => ({
    billingAccounts: s.billingAccounts.map(a => a.id === accountId ? { ...a, credit_limit: newLimit } : a)
  })),
  upgradeAccountToFamily: (accountId) => set((s) => ({
    billingAccounts: s.billingAccounts.map(a => a.id === accountId ? { ...a, type: 'family' } : a)
  })),

  setIsOwnerNew: (isNew) => set({ isOwnerNew: isNew }),
  externalCharges: [],
  setOwnerSearchPage: (page: number) => set({ ownerSearchPage: page }),
  setOwnerSearchQuery: (q) => set({ ownerSearchQuery: q }),
  setDepSearchQuery: (q) => set({ depSearchQuery: q }),
  setDepSearchPage: (page: number) => set({ depSearchPage: page }),
  setShowDepSearchDrop: (show) => set({ showDepSearchDrop: show }),
  setShowOwnerSearchDrop: (show) => set({ showOwnerSearchDrop: show }),

  setNewDependentsToRegister: (deps) => set({ newDependentsToRegister: deps }),
  addDependent: () => set((s) => ({
    newDependentsToRegister: [...s.newDependentsToRegister, { ...initialOwnerForm, tempId: Date.now() }]
  })),
  removeDependent: (tempId) => set((s) => ({
    newDependentsToRegister: s.newDependentsToRegister.filter(d => d.tempId !== tempId)
  })),
  updateDependent: (tempId, field, val) => set((s) => ({
    newDependentsToRegister: s.newDependentsToRegister.map(d => d.tempId === tempId ? { ...d, [field]: val } : d)
  })),

  setShowAddExisting: (show) => set({ showAddExisting: show }),
  setExistingPatientToLink: (val) => set({ existingPatientToLink: val }),
  setShowQuickRegisterDep: (show) => set({ showQuickRegisterDep: show }),
  
  setShowWorkspaceLogExpense: (show) => set({ showWorkspaceLogExpense: show }),
  setDepositAmount: (val) => set({ depositAmount: val }),
  setDepositMethod: (val) => set({ depositMethod: val }),
  setDepositNotes: (val) => set({ depositNotes: val }),
  setDepositing: (val) => set({ depositing: val }),

  resetAccountForm: () => set({
    accountForm: initialAccountForm,
    isOwnerNew: false,
    newOwnerForm: initialOwnerForm,
    newDependentsToRegister: [],
    ownerSearchQuery: '',
    depSearchQuery: '',
    showOwnerSearchDrop: false,
    showDepSearchDrop: false
  }),

  submitCreateAccount: async (params) => {
    const state = get();
    if (!state.accountForm.name.trim() && !state.isOwnerNew) throw new Error('Please enter account name');

    let finalOwnerId: number | string = state.accountForm.ownerId;
    let finalAccountName = state.accountForm.name.trim();

    if (state.isOwnerNew) {
      if (!state.newOwnerForm.firstName.trim() || !state.newOwnerForm.surname.trim()) {
        throw new Error('Please fill in new owner first name and surname');
      }
      const slipNumber = await params.generateSlipNumber(params.organizationId);
      const patientData = {
        slipNumber,
        registeredAt: new Date().toISOString(),
        name: [state.newOwnerForm.firstName, state.newOwnerForm.middleName, state.newOwnerForm.surname].filter(Boolean).join(' '),
        firstName: state.newOwnerForm.firstName.trim(),
        surname: state.newOwnerForm.surname.trim(),
        middleName: state.newOwnerForm.middleName.trim(),
        age: state.newOwnerForm.age.trim(),
        sex: state.newOwnerForm.sex,
        phone: state.newOwnerForm.phone.trim(),
        address: state.newOwnerForm.address.trim()
      };
      finalOwnerId = await params.registerPatientAndGetId(patientData, params.organizationId);
      finalAccountName = finalAccountName || `${state.newOwnerForm.firstName} ${state.newOwnerForm.surname} Wallet`;
    }

    if (!finalOwnerId) {
      throw new Error('Owner is required');
    }

    const newlyRegisteredDependentIds: (number | string)[] = [];
    for (const nd of state.newDependentsToRegister) {
      if (!nd.firstName.trim() || !nd.surname.trim()) {
        throw new Error('Please fill in all dependents first name and surname');
      }
      const slipNumber = await params.generateSlipNumber(params.organizationId);
      const dependentData = {
        slipNumber,
        registeredAt: new Date().toISOString(),
        name: [nd.firstName, nd.middleName, nd.surname].filter(Boolean).join(' '),
        firstName: nd.firstName.trim(),
        surname: nd.surname.trim(),
        middleName: nd.middleName.trim(),
        age: nd.age.trim(),
        sex: nd.sex,
        phone: nd.phone.trim(),
        address: nd.address.trim()
      };
      const newDepId = await params.registerPatientAndGetId(dependentData, params.organizationId);
      newlyRegisteredDependentIds.push(newDepId);
    }

    const combinedLinkedIds = Array.from(new Set([
      ...state.accountForm.linkedIds,
      ...newlyRegisteredDependentIds
    ]));

    const payload = {
      organization_id: params.organizationId,
      name: finalAccountName,
      owner_patient_id: finalOwnerId,
      credit_limit: parseFloat(state.accountForm.creditLimit) || 0.0,
      type: state.accountForm.type
    };

    const depositVal = parseFloat(state.accountForm.initialDeposit) || 0.0;

    await params.createBillingAccount(
      payload,
      depositVal,
      state.accountForm.paymentMethod,
      combinedLinkedIds,
      params.profileName
    );
  },

  submitDeposit: async (params) => {
    const state = get();
    const amt = parseFloat(state.depositAmount);
    if (isNaN(amt) || amt <= 0) throw new Error('Please enter a valid deposit amount');

    await params.depositToBillingAccount(
      params.accountId,
      amt,
      state.depositNotes.trim() || 'Top-up deposit',
      state.depositMethod,
      params.profileName,
      params.organizationId,
      undefined
    );
  }
}));
