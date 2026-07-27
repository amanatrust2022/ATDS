const fs = require('fs');
const path = require('path');

const recPath = path.join(__dirname, '../components/ReceptionPage.tsx');
let recContent = fs.readFileSync(recPath, 'utf8');

// 1. Add credit limit edit states
if (!recContent.includes('const [editCreditLimit, setEditCreditLimit] = useState<string | null>(null);')) {
  recContent = recContent.replace(
    'const [loadingLedger, setLoadingLedger] = useState(false);',
    'const [loadingLedger, setLoadingLedger] = useState(false);\n  const [editCreditLimit, setEditCreditLimit] = useState<string | null>(null);'
  );
}

// 2. Fix Credit Limit UI block
const creditLimitRegex = /<div style=\{\{\s*fontSize:\s*'0\.7rem',\s*color:\s*'var\(--gray-500\)',\s*marginTop:\s*'0\.5rem',\s*display:\s*'flex',\s*justifyContent:\s*'space-between'\s*\}\}>\s*<span>Credit Limit:<\/span>\s*<span style=\{\{\s*fontWeight:\s*600\s*\}\}>₦\{showLedgerModal\.credit_limit\.toLocaleString\('en-NG'\)\}<\/span>\s*<\/div>/g;

const creditLimitReplace = `<div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Credit Limit:</span>
                    {editCreditLimit !== null ? (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input 
                          type="number" 
                          value={editCreditLimit} 
                          onChange={(e) => setEditCreditLimit(e.target.value)} 
                          style={{ width: '80px', padding: '0.1rem 0.2rem', fontSize: '0.7rem' }}
                        />
                        <button type="button" onClick={async () => {
                          try {
                            const newLimit = parseFloat(editCreditLimit);
                            if(isNaN(newLimit)) return alert('Invalid number');
                            const res = await fetch(\`/api/billing?action=update_limit\`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ accountId: showLedgerModal.id, creditLimit: newLimit })
                            });
                            if(!res.ok) throw new Error('Update failed');
                            setShowLedgerModal({...showLedgerModal, credit_limit: newLimit});
                            setEditCreditLimit(null);
                            refresh();
                          } catch (e) {
                            alert('Error updating limit');
                          }
                        }} style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.1rem 0.3rem', borderRadius: 2, cursor: 'pointer', fontSize: '0.65rem' }}>Save</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>₦{showLedgerModal.credit_limit.toLocaleString('en-NG')}</span>
                        <button type="button" onClick={() => setEditCreditLimit(showLedgerModal.credit_limit.toString())} style={{ background: 'none', border: 'none', color: 'var(--blue-600)', cursor: 'pointer', fontSize: '0.65rem' }}>Edit</button>
                      </div>
                    )}
                  </div>`;

recContent = recContent.replace(creditLimitRegex, creditLimitReplace);

// 3. Fix Members Deduplication
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

recContent = recContent.replace(membersBlock, membersReplace);

// 4. Fix Upgrade to Family Account Button - using EXACT string match for safety
const buttonsBlock = `                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => setShowAddExisting(prev => !prev)}
                              style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                            >
                              {showAddExisting ? 'Close Link Form' : 'Link Existing Patient'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowQuickRegisterDep(prev => !prev)}
                              style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                            >
                              {showQuickRegisterDep ? 'Close Register Form' : 'Register New Dependent'}
                            </button>
                          </div>`;

const buttonsReplace = `                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {showLedgerModal.type === 'individual' ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await fetch(\`/api/billing?action=upgrade_family\`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ accountId: showLedgerModal.id })
                                    });
                                    if(!res.ok) throw new Error('Update failed');
                                    setShowLedgerModal({...showLedgerModal, type: 'family'});
                                    refresh();
                                    alert('Successfully upgraded to family account!');
                                  } catch (e) {
                                    alert('Error upgrading account');
                                  }
                                }}
                                style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                              >
                                Upgrade to Family Account
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setShowAddExisting(prev => !prev)}
                                  style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                >
                                  {showAddExisting ? 'Close Link Form' : 'Link Existing Patient'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowQuickRegisterDep(prev => !prev)}
                                  style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                >
                                  {showQuickRegisterDep ? 'Close Register Form' : 'Register New Dependent'}
                                </button>
                              </>
                            )}
                          </div>`;

recContent = recContent.replace(buttonsBlock, buttonsReplace);

fs.writeFileSync(recPath, recContent, 'utf8');
console.log('Patched ReceptionPage.tsx successfully');
