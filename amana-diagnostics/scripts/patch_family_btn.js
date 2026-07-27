const fs = require('fs');
const path = require('path');

const recPath = path.join(__dirname, '../components/ReceptionPage.tsx');
let recContent = fs.readFileSync(recPath, 'utf8').replace(/\r\n/g, '\n');

const targetStr = `                          <button
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
                          </button>`.replace(/\r\n/g, '\n');

const replacement = `                          {showLedgerModal.type === 'individual' ? (
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
                          )}`;

if (recContent.includes(targetStr)) {
  recContent = recContent.replace(targetStr, replacement);
  fs.writeFileSync(recPath, recContent, 'utf8');
  console.log('Patched buttons successfully!');
} else {
  console.log('Could not find target string!');
}
