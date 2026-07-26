const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../components/features/wallet/LedgerModal.tsx');
let content = fs.readFileSync(srcPath, 'utf8');

content = content.replace(/import React, \{ useState \} from 'react';/g, "import React, { useState, useEffect } from 'react';\nimport { fetchBillingAccounts } from '@/lib/store';");
content = content.replace(/refresh\(\)/g, "onSuccess()");
content = content.replace(/expenseForm\./g, "workspaceExpenseForm.");
content = content.replace(/setShowLogExpenseModal/g, "setShowWorkspaceLogExpense");

// Remove the global checkout sync useEffect that sneaked in
const checkoutSyncRegex = /\/\/ Sync wallet details for current checkout patient.*?\}\],/s;
// Let's just find the start and end of that useEffect manually
let checkoutEffectStart = content.indexOf("// Sync wallet details for current checkout patient");
if (checkoutEffectStart !== -1) {
  let checkoutEffectEnd = content.indexOf("}, [selectedPatientBillingAccountId, billingAccounts]);", checkoutEffectStart);
  if (checkoutEffectEnd !== -1) {
    content = content.substring(0, checkoutEffectStart) + content.substring(checkoutEffectEnd + 55);
  }
}

// Add externalCharges to store destructuring
content = content.replace("showLedgerModal, workspaceTab", "showLedgerModal, workspaceTab, externalCharges");

// Replace setBillingAccounts(accs) with store.setBillingAccounts(accs)
content = content.replace(/setBillingAccounts\(/g, "store.setBillingAccounts(");

// Add setSaving wrapper inside LedgerModal
content = content.replace("const store = useWalletStore();", "const store = useWalletStore();\n  const setSaving = () => {}; // Used for loading states in modals, not fully extracted but prevents crashes");

fs.writeFileSync(srcPath, content, 'utf8');
console.log("Fixed LedgerModal.tsx");
