const fs = require('fs');
const path = require('path');

// 1. Fix app/[slug]/reception/page.tsx
const pagePath = path.join(__dirname, '../app/[slug]/reception/page.tsx');
let pageContent = fs.readFileSync(pagePath, 'utf8');
pageContent = pageContent.replace("import ReceptionPage from '@/components/ReceptionPage';", "import ReceptionPageV2 from '@/components/ReceptionPage.v2';");
pageContent = pageContent.replace("export default function SlugReceptionPage() { return <ReceptionPage />; }", "export default function SlugReceptionPage() { return <ReceptionPageV2 />; }");
fs.writeFileSync(pagePath, pageContent, 'utf8');
console.log('Fixed app/[slug]/reception/page.tsx');

// 2. Fix ReceptionPage.v2.tsx
const recPath = path.join(__dirname, '../components/ReceptionPage.v2.tsx');
let recContent = fs.readFileSync(recPath, 'utf8');

// Add useWalletStore import safely
if (!recContent.includes('import { useWalletStore } from \'@/lib/store/useWalletStore\';')) {
  recContent = recContent.replace(
    "import { useAuth } from '@/components/AuthProvider';",
    "import { useAuth } from '@/components/AuthProvider';\nimport { useWalletStore } from '@/lib/store/useWalletStore';"
  );
}

// Remove local state
recContent = recContent.replace(
  'const [billingAccounts, setBillingAccounts] = useState<BillingAccount[]>([]);',
  '// removed local billingAccounts state'
);

// Replace setBillingAccounts in refresh()
recContent = recContent.replace(
  'setBillingAccounts(accs);\n      setExternalCharges(charges as any[]);',
  'useWalletStore.getState().setBillingAccounts(accs);\n      setExternalCharges(charges as any[]);'
);

// Replace setBillingAccounts in handleDepositSubmit
recContent = recContent.replace(
  'const accs = await fetchBillingAccounts(organization?.id || \'\');\n      setBillingAccounts(accs);',
  'const accs = await fetchBillingAccounts(organization?.id || \'\');\n      useWalletStore.getState().setBillingAccounts(accs);'
);

fs.writeFileSync(recPath, recContent, 'utf8');
console.log('Fixed components/ReceptionPage.v2.tsx');
