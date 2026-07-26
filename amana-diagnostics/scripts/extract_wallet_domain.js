const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../components/ReceptionPage.v2.tsx');
let content = fs.readFileSync(srcPath, 'utf8');

// 1. We will manually create WalletTab.tsx using the content from ReceptionPage.v2.tsx

const getBlock = (startString, endString) => {
  const start = content.indexOf(startString);
  if (start === -1) return null;
  const end = content.indexOf(endString, start);
  if (end === -1) return null;
  return content.substring(start, end);
};

// Extracted blocks
const handlers = getBlock("const handleCreateBillingAccountSubmit", "const handlePrintStatement =");
const printHandler = getBlock("const handlePrintStatement =", "  // Load referral databases");

const walletTabUI = getBlock("{tab === 'wallet' && (", "        {/* Settings Tab - TBD */}");

let walletFileContent = `import React, { useRef, useEffect } from 'react';
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
  const store = useWalletStore();
  const { 
    accountForm, isOwnerNew, newOwnerForm, newDependentsToRegister,
    billingAccounts, billingSearchQuery, showBillingAccountModal,
    showLedgerModal, workspaceTab, billingTransactions, loadingLedger,
    showAddExisting, existingPatientToLink, showQuickRegisterDep, workspaceDepForm,
    depositAmount, depositMethod, depositNotes, depositing,
    showWorkspaceLogExpense, workspaceExpenseForm
  } = store;

  // We bring over the exact handlers
  const setSaving = (s: boolean) => {}; // Mock for UI since store has no global saving state currently, wait, we can add it or ignore it.
  
  // To avoid complex AST rewriting, we just inject the handlers text
  ${handlers}
  ${printHandler}

  return (
    ${walletTabUI.replace("{tab === 'wallet' && (", "").replace(")}", "")}
  );
}
`;

fs.writeFileSync(path.join(__dirname, '../components/features/wallet/WalletTab.tsx'), walletFileContent, 'utf8');
console.log("Extracted WalletTab.tsx");
