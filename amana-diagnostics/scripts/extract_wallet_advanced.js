const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../components/ReceptionPage.v2.tsx');
let content = fs.readFileSync(srcPath, 'utf8');

const getBlock = (startString, endString) => {
  const start = content.indexOf(startString);
  if (start === -1) throw new Error("Could not find start: " + startString);
  const end = content.indexOf(endString, start);
  if (end === -1) throw new Error("Could not find end: " + endString);
  return content.substring(start, end);
};

let handlers = getBlock("const handleCreateBillingAccountSubmit", "const handlePrintStatement =");
let printHandler = getBlock("const handlePrintStatement =", "  // Load referral databases");
let walletTabUI = getBlock("{tab === 'wallet' && (", "/* ---- Field wrapper ---- */");

// Trim the wallet tab to exclude the closing div of ReceptionPage
const lastDiv = walletTabUI.lastIndexOf('</div>');
if (lastDiv !== -1) {
  walletTabUI = walletTabUI.substring(0, lastDiv);
}
const lastDiv2 = walletTabUI.lastIndexOf('</div>');
if (lastDiv2 !== -1) {
  walletTabUI = walletTabUI.substring(0, lastDiv2);
}

// Remove the tab conditional wrapper
walletTabUI = walletTabUI.replace("{tab === 'wallet' && (", "").trim();
if (walletTabUI.endsWith(")}")) {
  walletTabUI = walletTabUI.slice(0, -2).trim();
}

// Convert all state variable usages to use the store
const storeVars = [
  'accountForm', 'isOwnerNew', 'newOwnerForm', 'newDependentsToRegister',
  'billingAccounts', 'billingSearchQuery', 'showBillingAccountModal',
  'showLedgerModal', 'workspaceTab', 'billingTransactions', 'loadingLedger',
  'showAddExisting', 'existingPatientToLink', 'showQuickRegisterDep', 'workspaceDepForm',
  'depositAmount', 'depositMethod', 'depositNotes', 'depositing',
  'showWorkspaceLogExpense', 'workspaceExpenseForm',
  'ownerSearchQuery', 'ownerSearchPage', 'showOwnerSearchDrop',
  'depSearchQuery', 'depSearchPage', 'showDepSearchDrop'
];

const storeSetters = {
  'setAccountForm': 'store.updateAccountForm',
  'setNewOwnerForm': 'store.updateNewOwnerForm',
  'setWorkspaceDepForm': 'store.updateWorkspaceDepForm',
  'setWorkspaceExpenseForm': 'store.updateWorkspaceExpenseForm',
  'setIsOwnerNew': 'store.setIsOwnerNew',
  'setOwnerSearchQuery': 'store.setOwnerSearchQuery',
  'setOwnerSearchPage': 'store.setOwnerSearchPage',
  'setShowOwnerSearchDrop': 'store.setShowOwnerSearchDrop',
  'setDepSearchQuery': 'store.setDepSearchQuery',
  'setDepSearchPage': 'store.setDepSearchPage',
  'setShowDepSearchDrop': 'store.setShowDepSearchDrop',
  'setNewDependentsToRegister': 'store.setNewDependentsToRegister',
  'setShowBillingAccountModal': 'store.setShowBillingAccountModal',
  'setShowLedgerModal': 'store.setShowLedgerModal', // We map this to closeLedger/openLedger later or just add it
  'setBillingSearchQuery': 'store.setBillingSearchQuery',
  'setWorkspaceTab': 'store.setWorkspaceTab',
  'setBillingTransactions': 'store.setBillingTransactions',
  'setShowAddExisting': 'store.setShowAddExisting',
  'setExistingPatientToLink': 'store.setExistingPatientToLink',
  'setShowQuickRegisterDep': 'store.setShowQuickRegisterDep',
  'setShowWorkspaceLogExpense': 'store.setShowWorkspaceLogExpense',
  'setDepositAmount': 'store.setDepositAmount',
  'setDepositMethod': 'store.setDepositMethod',
  'setDepositNotes': 'store.setDepositNotes',
  'setDepositing': 'store.setDepositing'
};

// Also we need to replace setSaving with a local state in WalletTab
// And replace setAccountForm with store.updateAccountForm, but beware of updater functions like setAccountForm(prev => ...)
// Wait, Zustand updateAccountForm takes Partial<AccountFormState>. So setAccountForm({...accountForm, name: x}) becomes store.updateAccountForm({name: x})
// It's much safer to just de-structure all storeVars from `store` at the top, and leave the references intact!
// For setters, we can just map them to store calls or define wrapper functions locally.

let wrapperFunctions = `
  const [saving, setSaving] = useState(false);
  const store = useWalletStore();
  
  // Destructure state
  const { 
    accountForm, isOwnerNew, newOwnerForm, newDependentsToRegister,
    billingAccounts, billingSearchQuery, showBillingAccountModal,
    showLedgerModal, workspaceTab, billingTransactions, loadingLedger,
    showAddExisting, existingPatientToLink, showQuickRegisterDep, workspaceDepForm,
    depositAmount, depositMethod, depositNotes, depositing,
    showWorkspaceLogExpense, workspaceExpenseForm,
    ownerSearchQuery, ownerSearchPage, showOwnerSearchDrop,
    depSearchQuery, depSearchPage, showDepSearchDrop
  } = store;

  // Wrapper setters
  const setAccountForm = (val) => typeof val === 'function' ? store.updateAccountForm(val(accountForm)) : store.updateAccountForm(val);
  const setNewOwnerForm = (val) => typeof val === 'function' ? store.updateNewOwnerForm(val(newOwnerForm)) : store.updateNewOwnerForm(val);
  const setWorkspaceDepForm = (val) => typeof val === 'function' ? store.updateWorkspaceDepForm(val(workspaceDepForm)) : store.updateWorkspaceDepForm(val);
  const setWorkspaceExpenseForm = (val) => typeof val === 'function' ? store.updateWorkspaceExpenseForm(val(workspaceExpenseForm)) : store.updateWorkspaceExpenseForm(val);
  
  const setIsOwnerNew = store.setIsOwnerNew;
  const setOwnerSearchQuery = store.setOwnerSearchQuery;
  const setOwnerSearchPage = store.setOwnerSearchPage;
  const setShowOwnerSearchDrop = store.setShowOwnerSearchDrop;
  const setDepSearchQuery = store.setDepSearchQuery;
  const setDepSearchPage = store.setDepSearchPage;
  const setShowDepSearchDrop = store.setShowDepSearchDrop;
  const setNewDependentsToRegister = store.setNewDependentsToRegister;
  const setShowBillingAccountModal = store.setShowBillingAccountModal;
  const setShowLedgerModal = (val) => val === null ? store.closeLedger() : store.openLedger(val);
  const setBillingSearchQuery = store.setBillingSearchQuery;
  const setWorkspaceTab = store.setWorkspaceTab;
  const setBillingTransactions = store.setBillingTransactions;
  const setShowAddExisting = store.setShowAddExisting;
  const setExistingPatientToLink = store.setExistingPatientToLink;
  const setShowQuickRegisterDep = store.setShowQuickRegisterDep;
  const setShowWorkspaceLogExpense = store.setShowWorkspaceLogExpense;
  const setDepositAmount = store.setDepositAmount;
  const setDepositMethod = store.setDepositMethod;
  const setDepositNotes = store.setDepositNotes;
  const setDepositing = store.setDepositing;
`;

let walletFileContent = `import React, { useRef, useState } from 'react';
import { 
  RiFolderUserLine, RiAddLine, RiSearchLine, RiWalletLine, RiArrowRightSLine, 
  RiCloseLine, RiCheckLine, RiMoreLine, RiPrinterLine, RiFileTextLine 
} from '@remixicon/react';
import { useWalletStore } from '@/lib/store/useWalletStore';
import { 
  createBillingAccount, depositToBillingAccount, updatePatientBillingAccount, 
  registerPatientAndGetId, logExternalCharge, fetchAccountLedger, generateSlipNumber 
} from '@/lib/supabaseClient';
import { getLedgerStatementTemplate, printHtml } from '@/lib/utils';
import { Patient, BillingAccount } from '@/lib/store';

const inputStyle = (error?: boolean) => ({
  width: '100%', padding: '0.65rem 1rem', borderRadius: 'var(--radius)',
  border: error ? '1px solid var(--red)' : '1px solid var(--gray-300)',
  fontSize: '0.82rem', fontFamily: 'var(--font-sans)', outline: 'none'
});

const closeBtn = { background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.4rem', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex' };
const dropItemStyle = { padding: '0.65rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', transition: 'background 0.15s' };

function Field({ label, children, error }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
      {error && <span style={{ color: 'var(--red)', fontSize: '0.7rem' }}>{error}</span>}
    </div>
  );
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  padding: '1rem'
};

const modalBox: React.CSSProperties = {
  background: 'white', borderRadius: 'var(--radius-lg)',
  width: '100%', maxWidth: 800, maxHeight: '90vh',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden'
};

interface WalletTabProps {
  organization: any;
  patients: Patient[];
  profile: any;
  refresh: () => void;
}

export default function WalletTab({ organization, patients, profile, refresh }: WalletTabProps) {
  const ownerSearchRef = useRef<HTMLDivElement>(null);
  const depSearchRef = useRef<HTMLDivElement>(null);
  
  ${wrapperFunctions}

  // Extracted logic from ReceptionPage.v2.tsx
  ${handlers}
  ${printHandler}

  return (
    ${walletTabUI}
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../components/features/wallet/WalletTab.tsx'), walletFileContent, 'utf8');
console.log("Successfully generated WalletTab.tsx");
