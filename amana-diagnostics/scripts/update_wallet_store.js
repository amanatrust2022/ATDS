const fs = require('fs');
const path = require('path');

const storePath = path.join(__dirname, '../lib/store/useWalletStore.ts');
let c = fs.readFileSync(storePath, 'utf8');

c = c.replace('updateWorkspaceExpenseForm: (updates: Partial<ExpenseFormState>) => void;', `updateWorkspaceExpenseForm: (updates: Partial<ExpenseFormState>) => void;
  updateCreditLimit: (accountId: string, newLimit: number) => void;
  upgradeAccountToFamily: (accountId: string) => void;`);

c = c.replace('updateWorkspaceExpenseForm: (updates) => set((s) => ({ workspaceExpenseForm: { ...s.workspaceExpenseForm, ...updates } })),', `updateWorkspaceExpenseForm: (updates) => set((s) => ({ workspaceExpenseForm: { ...s.workspaceExpenseForm, ...updates } })),
  updateCreditLimit: (accountId, newLimit) => set((s) => ({
    billingAccounts: s.billingAccounts.map(a => a.id === accountId ? { ...a, credit_limit: newLimit } : a)
  })),
  upgradeAccountToFamily: (accountId) => set((s) => ({
    billingAccounts: s.billingAccounts.map(a => a.id === accountId ? { ...a, type: 'family' } : a)
  })),`);

fs.writeFileSync(storePath, c, 'utf8');
console.log("Updated useWalletStore.ts");
