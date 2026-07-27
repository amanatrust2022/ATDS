const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../components/features/wallet/LedgerModal.tsx');
let c = fs.readFileSync(p, 'utf8');

// Header credit limit replacement
const headerBlockSearch = \`{/* Available Credit */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available Credit</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gray-900)' }}>₦{(showLedgerModal.balance + (showLedgerModal.credit_limit || 0)).toLocaleString('en-NG')}</div>
                </div>\`;

const headerBlockReplace = \`{/* Available Credit */}
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
                </div>\`;

c = c.replace(headerBlockSearch, headerBlockReplace);

// Members unique replacement
const membersArraySearch = \`const members = patients.filter(p => p.billingAccountId === showLedgerModal.id);\`;

const membersArrayReplace = \`const allVisits = patients.filter(p => p.billingAccountId === showLedgerModal.id);
                  const uniqueMembersMap = new Map();
                  allVisits.forEach(v => {
                    const key = \` + "`" + '${v.firstName?.toLowerCase()}-${v.surname?.toLowerCase()}' + "`" + \`;
                    if (!uniqueMembersMap.has(key)) {
                      uniqueMembersMap.set(key, v);
                    }
                  });
                  const members = Array.from(uniqueMembersMap.values());\`;

c = c.replace(membersArraySearch, membersArrayReplace);

// Members buttons replacement
const buttonsSearch = \`<div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => setShowAddExisting(!prev)}
                            style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                          >
                            {showAddExisting ? 'Close Link Form' : 'Link Existing Patient'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowQuickRegisterDep(!prev)}
                            style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                          >
                            {showQuickRegisterDep ? 'Close Register Form' : 'Register New Dependent'}
                          </button>
                        </div>\`;

const buttonsReplace = \`<div style={{ display: 'flex', gap: '0.5rem' }}>
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
                        </div>\`;

c = c.replace(buttonsSearch, buttonsReplace);

fs.writeFileSync(p, c, 'utf8');
console.log("Applied UI replacements to LedgerModal");
