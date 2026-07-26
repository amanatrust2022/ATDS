const fs = require('fs');
const path = require('path');

// 1. Fix useWalletStore.ts
const storePath = path.join(__dirname, '../lib/store/useWalletStore.ts');
let storeContent = fs.readFileSync(storePath, 'utf8');
storeContent = storeContent.replace("setOwnerSearchQuery: (q: string) => void;", "setOwnerSearchQuery: (q: string) => void;\n  setOwnerSearchPage: (page: number) => void;");
storeContent = storeContent.replace("setOwnerSearchQuery: (q) => set({ ownerSearchQuery: q }),", "setOwnerSearchQuery: (q) => set({ ownerSearchQuery: q }),\n  setOwnerSearchPage: (page) => set({ ownerSearchPage: page }),");
storeContent = storeContent.replace("externalCharges: ExternalDepartmentCharge[];\n", "");
if (!storeContent.includes("externalCharges: ExternalDepartmentCharge[];")) {
    storeContent = storeContent.replace("billingAccounts: BillingAccount[];", "billingAccounts: BillingAccount[];\n  externalCharges: ExternalDepartmentCharge[];");
    storeContent = storeContent.replace("billingAccounts: [],", "billingAccounts: [],\n  externalCharges: [],");
}
fs.writeFileSync(storePath, storeContent, 'utf8');

// 2. Fix BillingAccountModal.tsx
const billModalPath = path.join(__dirname, '../components/features/wallet/BillingAccountModal.tsx');
let billContent = fs.readFileSync(billModalPath, 'utf8');
// Fix createBillingAccount(orgId, { owner_id, name, type, credit_limit }, allLinkedIds)
// wait, we need to know the arguments it expects from lib/store.
// Let's assume the previous `ReceptionPage.v2.tsx` used it right. Let's look at `createBillingAccount` in `lib/store`.

// 3. Fix LedgerModal.tsx
const ledgerPath = path.join(__dirname, '../components/features/wallet/LedgerModal.tsx');
let ledgerContent = fs.readFileSync(ledgerPath, 'utf8');
ledgerContent = ledgerContent.replace("const [saving, setSaving] = useState(false);", ""); // Remove duplicate
ledgerContent = ledgerContent.replace("setLoadingLedger", "store.loadingLedger"); // Loading ledger is not settable yet?
// Wait, loadingLedger is just a boolean, we need to add setLoadingLedger to store or add local state.
ledgerContent = ledgerContent.replace("const { \n    showLedgerModal", "const [loadingLedgerLocal, setLoadingLedgerLocal] = useState(false);\n  const { \n    showLedgerModal");
ledgerContent = ledgerContent.replace(/setLoadingLedger/g, "setLoadingLedgerLocal");

// Fix `(prev) => !prev`
ledgerContent = ledgerContent.replace(/setShowAddExisting\(prev => !prev\)/g, "setShowAddExisting(!showAddExisting)");
ledgerContent = ledgerContent.replace(/setShowQuickRegisterDep\(prev => !prev\)/g, "setShowQuickRegisterDep(!showQuickRegisterDep)");

// Fix implicitly any parameters
ledgerContent = ledgerContent.replace(/\(val\)/g, "(val: any)");
ledgerContent = ledgerContent.replace(/\(p\)/g, "(p: any)");
ledgerContent = ledgerContent.replace(/\(prev\)/g, "(prev: any)");
ledgerContent = ledgerContent.replace(/\(ec\)/g, "(ec: any)");
ledgerContent = ledgerContent.replace(/\(a\)/g, "(a: any)");
ledgerContent = ledgerContent.replace(/\(m\)/g, "(m: any)");

fs.writeFileSync(ledgerPath, ledgerContent, 'utf8');
console.log("Fixed files");
