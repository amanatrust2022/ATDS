const fs = require('fs');
const path = require('path');

const recPath = path.join(__dirname, '../components/ReceptionPage.v2.tsx');
let recContent = fs.readFileSync(recPath, 'utf8');

// Undo the mess
recContent = recContent.replace(
  '// removed local billingAccounts state',
  'const { billingAccounts, setBillingAccounts } = useWalletStore();'
);

recContent = recContent.replace(
  'useWalletStore.getState().setBillingAccounts(accs);\n      setExternalCharges(charges as any[]);',
  'setBillingAccounts(accs);\n      setExternalCharges(charges as any[]);'
);

recContent = recContent.replace(
  'const accs = await fetchBillingAccounts(organization?.id || \'\');\n      useWalletStore.getState().setBillingAccounts(accs);',
  'const accs = await fetchBillingAccounts(organization?.id || \'\');\n      setBillingAccounts(accs);'
);

fs.writeFileSync(recPath, recContent, 'utf8');
console.log('Fixed ReceptionPage.v2.tsx to use Zustand store destructuring');
