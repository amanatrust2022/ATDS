const fs = require('fs');
const path = require('path');

// Fix ReceptionPage.v2.tsx
const recPath = path.join(__dirname, '../components/ReceptionPage.v2.tsx');
let recContent = fs.readFileSync(recPath, 'utf8');

// Add import
if (!recContent.includes('import { useWalletStore }')) {
  recContent = recContent.replace("import { useAuth } from '@/components/AuthProvider';", "import { useAuth } from '@/components/AuthProvider';\nimport { useWalletStore } from '@/lib/store/useWalletStore';");
}

recContent = recContent.replace(
  'const [billingAccounts, setBillingAccounts] = useState<BillingAccount[]>([]);\n  const [externalCharges, setExternalCharges]',
  'const [externalCharges, setExternalCharges]'
);

recContent = recContent.replace(
  '      setBillingAccounts(accs);\n      setExternalCharges(charges as any[]);',
  '      useWalletStore.getState().setBillingAccounts(accs);\n      setExternalCharges(charges as any[]);'
);

recContent = recContent.replace(
  '      const accs = await fetchBillingAccounts(organization?.id || \'\');\n      setBillingAccounts(accs);',
  '      const accs = await fetchBillingAccounts(organization?.id || \'\');\n      useWalletStore.getState().setBillingAccounts(accs);'
);

fs.writeFileSync(recPath, recContent, 'utf8');
console.log('ReceptionPage.v2.tsx patched');

// Fix LedgerModal.tsx
const ledPath = path.join(__dirname, '../components/features/wallet/LedgerModal.tsx');
let ledContent = fs.readFileSync(ledPath, 'utf8');

// Fix unique members
const membersBlock = `const members = patients.filter(p => p.billingAccountId === showLedgerModal.id);`;
const membersReplace = `const allVisits = patients.filter(p => p.billingAccountId === showLedgerModal.id);
                  const uniqueMembersMap = new Map();
                  allVisits.forEach(v => {
                    const key = \`\${v.firstName?.toLowerCase()}-\${v.surname?.toLowerCase()}\`;
                    if (!uniqueMembersMap.has(key)) {
                      uniqueMembersMap.set(key, v);
                    }
                  });
                  const members = Array.from(uniqueMembersMap.values());`;

ledContent = ledContent.replace(membersBlock, membersReplace);

// Fix Upgrade button
const buttonsBlock = `<div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => setShowAddExisting(!showAddExisting)}
                            style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                          >
                            {showAddExisting ? 'Close Link Form' : 'Link Existing Patient'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowQuickRegisterDep(!showQuickRegisterDep)}
                            style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                          >
                            {showQuickRegisterDep ? 'Close Register Form' : 'Register New Dependent'}
                          </button>
                        </div>`;

const buttonsReplace = `<div style={{ display: 'flex', gap: '0.5rem' }}>
                          {showLedgerModal.type === 'individual' ? (
                            <button
                              type="button"
                              onClick={() => handleUpgradeAccount(showLedgerModal.id)}
                              style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                            >
                              Upgrade to Family Account
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowAddExisting(!showAddExisting)}
                                style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                              >
                                {showAddExisting ? 'Close Link Form' : 'Link Existing Patient'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowQuickRegisterDep(!showQuickRegisterDep)}
                                style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                              >
                                {showQuickRegisterDep ? 'Close Register Form' : 'Register New Dependent'}
                              </button>
                            </>
                          )}
                        </div>`;

if(ledContent.includes(buttonsBlock)) {
  ledContent = ledContent.replace(buttonsBlock, buttonsReplace);
  console.log('LedgerModal.tsx buttons patched exactly');
} else {
  console.log('LedgerModal.tsx buttons exact match failed, falling back to general replace');
  
  // Fallback if the whitespace is slightly different
  const fallbackRegex = /<div style={{ display: 'flex', gap: '0.5rem' }}>[\s\S]*?Register New Dependent[\s\S]*?<\/button>\s*<\/div>/;
  ledContent = ledContent.replace(fallbackRegex, buttonsReplace);
}

fs.writeFileSync(ledPath, ledContent, 'utf8');
console.log('LedgerModal.tsx patched');
