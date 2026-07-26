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

let ledgerHandlers = getBlock("const handleDepositSubmit = async", "  // Load referral databases");
let ledgerUI = getBlock("{showLedgerModal && (", "{/* Quick Add Doctor Modal */}");

// Format and trim UI
const lastDiv = ledgerUI.lastIndexOf(')}');
if (lastDiv !== -1) {
  ledgerUI = ledgerUI.substring(0, lastDiv);
}
ledgerUI = ledgerUI.replace("{showLedgerModal && (", "").trim();


let wrapperFunctions = `
  const [saving, setSaving] = useState(false);
  const store = useWalletStore();
  
  const { 
    showLedgerModal, workspaceTab, billingTransactions, loadingLedger,
    showAddExisting, existingPatientToLink, showQuickRegisterDep, workspaceDepForm,
    depositAmount, depositMethod, depositNotes, depositing,
    showWorkspaceLogExpense, workspaceExpenseForm
  } = store;

  const setWorkspaceDepForm = (val) => typeof val === 'function' ? store.updateWorkspaceDepForm(val(workspaceDepForm)) : store.updateWorkspaceDepForm(val);
  const setWorkspaceExpenseForm = (val) => typeof val === 'function' ? store.updateWorkspaceExpenseForm(val(workspaceExpenseForm)) : store.updateWorkspaceExpenseForm(val);
  
  const setShowLedgerModal = (val) => val === null ? store.closeLedger() : store.openLedger(val);
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

let ledgerFileContent = `import React, { useState } from 'react';
import { 
  RiFolderUserLine, RiAddLine, RiWalletLine, 
  RiCloseLine, RiPrinterLine, RiFileTextLine 
} from '@remixicon/react';
import { useWalletStore } from '@/lib/store/useWalletStore';
import { 
  depositToBillingAccount, updatePatientBillingAccount, 
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
  width: '100%', maxWidth: 900, maxHeight: '90vh',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden'
};

export default function LedgerModal({ organization, patients, profile, onSuccess }: any) {
  ${wrapperFunctions}

  ${ledgerHandlers}

  if (!showLedgerModal) return null;

  return (
    ${ledgerUI}
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../components/features/wallet/LedgerModal.tsx'), ledgerFileContent, 'utf8');
console.log("Successfully generated LedgerModal.tsx");
