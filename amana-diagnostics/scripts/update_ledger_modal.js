const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../components/features/wallet/LedgerModal.tsx');
let c = fs.readFileSync(p, 'utf8');

// 1. Add imports for the new actions
c = c.replace(
  "import { fetchAccountLedger, fetchExternalCharges, linkPatientToAccount, registerPatientAndGetId, logExternalCharge } from '@/lib/store';", 
  "import { fetchAccountLedger, fetchExternalCharges, linkPatientToAccount, registerPatientAndGetId, logExternalCharge, updateBillingAccountLimit, upgradeBillingAccount } from '@/lib/store';"
);

// 2. Add local states for editing credit limit
if (!c.includes('const [isEditingLimit, setIsEditingLimit] = useState(false);')) {
  c = c.replace(
    'const [showAddExisting, setShowAddExisting] = useState(false);',
    `const [showAddExisting, setShowAddExisting] = useState(false);
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState('');`
  );
}

// 3. Add handlers
if (!c.includes('const handleUpdateLimit = async')) {
  c = c.replace(
    'const handleLinkExistingDependent = async',
    `const handleUpdateLimit = async (accountId: string) => {
    const limit = Number(newCreditLimit);
    if (isNaN(limit) || limit < 0) return alert('Invalid credit limit');
    try {
      await updateBillingAccountLimit(accountId, limit);
      store.updateCreditLimit(accountId, limit);
      setIsEditingLimit(false);
      alert('Credit limit updated successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpgradeAccount = async (accountId: string) => {
    try {
      await upgradeBillingAccount(accountId);
      store.upgradeAccountToFamily(accountId);
      alert('Account upgraded to Family successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLinkExistingDependent = async`
  );
}

// 4. Update the Credit Limit display in the header
c = c.replace(
  /{/\* Available Credit \*/}[\s\S]*?<\/div>/,
  `{/* Available Credit */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Credit Limit</div>
                  {isEditingLimit ? (
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <input 
                        type="number" 
                        value={newCreditLimit} 
                        onChange={e => setNewCreditLimit(e.target.value)} 
                        style={{ padding: '2px', width: '80px', fontSize: '0.8rem', border: '1px solid var(--gray-300)' }} 
                        placeholder={String(showLedgerModal.credit_limit || 0)}
                      />
                      <button onClick={() => handleUpdateLimit(showLedgerModal.id)} style={{ background: 'var(--teal-600)', color: 'white', border: 'none', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', borderRadius: '4px' }}>Save</button>
                      <button onClick={() => setIsEditingLimit(false)} style={{ background: 'var(--gray-200)', border: 'none', padding: '2px 6px', fontSize: '0.7rem', cursor: 'pointer', borderRadius: '4px' }}>X</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      ₦{(showLedgerModal.credit_limit || 0).toLocaleString('en-NG')}
                      <button onClick={() => { setIsEditingLimit(true); setNewCreditLimit(String(showLedgerModal.credit_limit || 0)); }} style={{ background: 'none', border: 'none', color: 'var(--teal-600)', cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>
                    </div>
                  )}
                </div>`
);

// 5. Update the "Account Members" tab logic
c = c.replace(
  /const members = patients\.filter\(p => p\.billingAccountId === showLedgerModal\.id\);/,
  `const allVisits = patients.filter(p => p.billingAccountId === showLedgerModal.id);
                  const uniqueMembersMap = new Map();
                  allVisits.forEach(v => {
                    const key = \`\${v.firstName?.toLowerCase()}-\${v.surname?.toLowerCase()}\`;
                    if (!uniqueMembersMap.has(key)) {
                      uniqueMembersMap.set(key, v);
                    }
                  });
                  const members = Array.from(uniqueMembersMap.values());`
);

// 6. Update the action buttons in the Members tab based on account type
c = c.replace(
  /<div style={{ display: 'flex', gap: '0.5rem' }}>[\s\S]*?<\/div>/,
  `<div style={{ display: 'flex', gap: '0.5rem' }}>
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
                        </div>`
);

fs.writeFileSync(p, c, 'utf8');
console.log("Updated LedgerModal.tsx");
