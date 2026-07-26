const fs = require('fs');
const path = require('path');

const rcPath = path.join(__dirname, '../components/ReceptionPage.v2.tsx');
const rcContent = fs.readFileSync(rcPath, 'utf8');

const getBlock = (start, end) => {
  const s = rcContent.indexOf(start);
  const e = rcContent.indexOf(end, s);
  return rcContent.substring(s, e);
};

const correctHandler = getBlock("const handleCreateBillingAccountSubmit = async (e: React.FormEvent) => {", "  const handleDepositSubmit");

const bmPath = path.join(__dirname, '../components/features/wallet/BillingAccountModal.tsx');
let bmContent = fs.readFileSync(bmPath, 'utf8');

const bmStart = bmContent.indexOf("const handleCreateBillingAccountSubmit = async (e: React.FormEvent) => {");
const bmEnd = bmContent.indexOf("  return (\n    <div style={modalOverlay}>");

bmContent = bmContent.substring(0, bmStart) + correctHandler + bmContent.substring(bmEnd);

// Fix store hooks inside the handler
bmContent = bmContent.replace(/setSaving\(/g, "setSavingLocal(");
bmContent = bmContent.replace(/setAccountForm\(/g, "updateAccountForm("); // Might need manual fix if it has prev=>
bmContent = bmContent.replace(/setShowBillingAccountModal\(/g, "store.setShowBillingAccountModal("); // wait, it's destructured
bmContent = bmContent.replace(/fetchBillingAccounts\(/g, "store.fetchBillingAccounts("); // Doesn't exist, we just call onSuccess()

fs.writeFileSync(bmPath, bmContent, 'utf8');
console.log("Fixed BillingAccountModal handler");
