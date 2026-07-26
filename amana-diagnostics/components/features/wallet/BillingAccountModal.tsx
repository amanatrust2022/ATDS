import React, { useRef, useState } from 'react';
import { RiCloseLine, RiSearchLine } from '@remixicon/react';
import { useWalletStore } from '@/lib/store/useWalletStore';
import { 
  createBillingAccount, depositToBillingAccount, registerPatientAndGetId, generateSlipNumber 
} from '@/lib/store';
import { Patient } from '@/lib/store';

const inputStyle = (error?: boolean) => ({
  width: '100%', padding: '0.65rem 1rem', borderRadius: 'var(--radius)',
  border: error ? '1px solid var(--red)' : '1px solid var(--gray-300)',
  fontSize: '0.82rem', fontFamily: 'var(--font-sans)', outline: 'none'
});

const closeBtn = { background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.4rem', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex' };
const dropItemStyle = { padding: '0.65rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', transition: 'background 0.15s' };

function Field({ label, children, error }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
      {error && <span style={{ color: 'var(--red)', fontSize: '0.7rem' }}>{error}</span>}
    </div>
  );
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  padding: '1rem'
};

const modalBox: React.CSSProperties = {
  background: 'white', borderRadius: 'var(--radius-lg)',
  width: '100%', maxWidth: 550, maxHeight: '90vh',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden'
};

export default function BillingAccountModal({ organization, patients, profile, onSuccess }: any) {
  const { 
    accountForm, isOwnerNew, newOwnerForm, newDependentsToRegister,
    ownerSearchQuery, ownerSearchPage, showOwnerSearchDrop,
    updateAccountForm, updateNewOwnerForm, updateDependent, addDependent, removeDependent,
    setIsOwnerNew, setOwnerSearchQuery, setOwnerSearchPage, setShowOwnerSearchDrop,
    setShowBillingAccountModal, resetAccountForm
  } = useWalletStore();
  
  const [saving, setSavingLocal] = useState(false);
  const store = useWalletStore();
  const ownerSearchRef = useRef<HTMLDivElement>(null);

  const handleCreateBillingAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.name.trim() && !isOwnerNew) return alert('Please enter account name');

    setSavingLocal(true);
    try {
      let finalOwnerId: number | string = accountForm.ownerId;
      let finalAccountName = accountForm.name.trim();

      // 1. If owner is brand new, register them first!
      if (isOwnerNew) {
        if (!newOwnerForm.firstName.trim() || !newOwnerForm.surname.trim()) {
          throw new Error('Please fill in new owner first name and surname');
        }
        const slipNumber = await generateSlipNumber(organization?.id || '');
        const patientData = {
          slipNumber,
          registeredAt: new Date().toISOString(),
          name: [newOwnerForm.firstName, newOwnerForm.middleName, newOwnerForm.surname].filter(Boolean).join(' '),
          firstName: newOwnerForm.firstName.trim(),
          surname: newOwnerForm.surname.trim(),
          middleName: newOwnerForm.middleName.trim(),
          age: newOwnerForm.age.trim(),
          sex: newOwnerForm.sex,
          phone: newOwnerForm.phone.trim(),
          address: newOwnerForm.address.trim()
        };
        finalOwnerId = await registerPatientAndGetId(patientData as any, organization?.id || '');
        finalAccountName = finalAccountName || `${newOwnerForm.firstName} ${newOwnerForm.surname} Wallet`;
      }

      if (!finalOwnerId) {
        throw new Error('Owner is required');
      }

      // 2. Register any brand new dependents!
      const newlyRegisteredDependentIds: (number | string)[] = [];
      for (const nd of newDependentsToRegister) {
        if (!nd.firstName.trim() || !nd.surname.trim()) {
          throw new Error('Please fill in all dependents first name and surname');
        }
        const slipNumber = await generateSlipNumber(organization?.id || '');
        const dependentData = {
          slipNumber,
          registeredAt: new Date().toISOString(),
          name: [nd.firstName, nd.middleName, nd.surname].filter(Boolean).join(' '),
          firstName: nd.firstName.trim(),
          surname: nd.surname.trim(),
          middleName: nd.middleName.trim(),
          age: nd.age.trim(),
          sex: nd.sex,
          phone: nd.phone.trim(),
          address: nd.address.trim()
        };
        const newDepId = await registerPatientAndGetId(dependentData as any, organization?.id || '');
        newlyRegisteredDependentIds.push(newDepId);
      }

      // 3. Combine linked dependents (existing + new)
      const combinedLinkedIds = Array.from(new Set([
        ...accountForm.linkedIds,
        ...newlyRegisteredDependentIds
      ]));

      const payload = {
        organization_id: organization?.id || '',
        name: finalAccountName,
        owner_patient_id: finalOwnerId,
        credit_limit: parseFloat(accountForm.creditLimit) || 0.0,
        type: accountForm.type
      };

      const depositVal = parseFloat(accountForm.initialDeposit) || 0.0;

      await createBillingAccount(
        payload,
        depositVal,
        accountForm.paymentMethod,
        combinedLinkedIds,
        profile?.full_name || 'Staff'
      );

      alert('Billing account created successfully');
      store.setShowBillingAccountModal(false);
      setIsOwnerNew(false);
      store.setNewDependentsToRegister([]);
      store.updateNewOwnerForm({ firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', address: '' });
      onSuccess();
    } catch (err: any) {
      alert('Failed to create account: ' + err.message);
    } finally {
      setSavingLocal(false);
    }
  };

  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('cash');
  const [depositNotes, setDepositNotes] = useState('');
  const [depositing, setDepositing] = useState(false);

  return (
    <div style={modalOverlay}>
      <form 
        onSubmit={handleCreateBillingAccountSubmit} 
        style={modalBox}
      >
        <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Open Billing Account</h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', marginTop: '0.15rem' }}>Create individual or family deposit wallet</p>
          </div>
          <button type="button" onClick={() => store.setShowBillingAccountModal(false)} style={closeBtn}>
            <RiCloseLine size={16} />
          </button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', background: 'white', overflowY: 'auto', flex: 1 }}>
          <Field label="Account Name *">
            <input
              required
              style={inputStyle(false)}
              placeholder="e.g. Bello Family Wallet"
              value={accountForm.name}
              onChange={e => updateAccountForm({ name: e.target.value })}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Account Type">
              <select
                style={inputStyle(false)}
                value={accountForm.type}
                onChange={e => updateAccountForm({ type: e.target.value as any })}
              >
                <option value="individual">Individual</option>
                <option value="family">Family Group</option>
                <option value="corporate">Corporate Retainer</option>
              </select>
            </Field>
            <Field label="Credit Limit (₦)">
              <input
                type="number"
                min="0"
                style={inputStyle(false)}
                value={accountForm.creditLimit}
                onChange={e => updateAccountForm({ creditLimit: e.target.value })}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Initial Deposit (₦)">
              <input
                type="number"
                min="0"
                style={inputStyle(false)}
                value={accountForm.initialDeposit}
                onChange={e => updateAccountForm({ initialDeposit: e.target.value })}
              />
            </Field>
            <Field label="Deposit Method">
              <select
                style={inputStyle(false)}
                value={accountForm.paymentMethod}
                disabled={parseFloat(accountForm.initialDeposit) <= 0}
                onChange={e => updateAccountForm({ paymentMethod: e.target.value })}
              >
                <option value="cash">Cash</option>
                <option value="pos">POS</option>
                <option value="transfer">Bank Transfer</option>
              </select>
            </Field>
          </div>

          {/* Account Owner Selection Toggle */}
          <div 
            onClick={() => {
              setIsOwnerNew(!isOwnerNew);
              updateAccountForm({ ownerId: '', name: '' });
              setOwnerSearchQuery('');
            }}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', 
              background: isOwnerNew ? '#f0fdfa' : 'var(--gray-50)', 
              border: isOwnerNew ? '1px solid var(--teal-300)' : '1px solid var(--gray-200)', 
              borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none', marginTop: '0.25rem'
            }}
          >
            <input
              type="checkbox"
              checked={isOwnerNew}
              readOnly
              style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--teal-700)', cursor: 'pointer' }}
            />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isOwnerNew ? 'var(--teal-900)' : 'var(--gray-800)' }}>
                Register a New Patient as Account Owner
              </div>
              <div style={{ fontSize: '0.68rem', color: isOwnerNew ? 'var(--teal-700)' : 'var(--gray-500)', marginTop: '0.1rem' }}>
                Toggle this on if the primary account owner is not registered yet.
              </div>
            </div>
          </div>

          {!isOwnerNew ? (
            <Field label="Account Owner (Primary Patient) *">
              <div ref={ownerSearchRef} style={{ position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <RiSearchLine size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input
                    style={{ ...inputStyle(false), paddingLeft: 30 }}
                    placeholder="Search patient by name or phone..."
                    value={ownerSearchQuery}
                    onChange={e => {
                      setOwnerSearchQuery(e.target.value);
                      setOwnerSearchPage(0);
                      setShowOwnerSearchDrop(true);
                    }}
                    onFocus={() => setShowOwnerSearchDrop(true)}
                  />
                </div>
                {accountForm.ownerId && (() => {
                  const owner = patients.find((x: Patient) => x.id === Number(accountForm.ownerId));
                  if (!owner) return null;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', marginTop: '0.35rem', background: '#f0fdfa', border: '1px solid var(--teal-200)', borderRadius: 4, fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--teal-800)' }}>Selected Owner: <b>{owner.firstName} {owner.surname}</b> ({owner.phone})</span>
                      <button
                        type="button"
                        onClick={() => updateAccountForm({ ownerId: '', name: '' })}
                        style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem' }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })()}
                
                {showOwnerSearchDrop && ownerSearchQuery.trim().length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--gray-300)', zIndex: 70, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: 4, marginTop: '0.25rem', overflow: 'hidden' }}>
                    <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                      {(() => {
                        const filtered = patients.filter((p: Patient) => {
                          const q = ownerSearchQuery.toLowerCase();
                          return `${p.firstName} ${p.middleName || ''} ${p.surname}`.toLowerCase().includes(q) || (p.phone || '').includes(q);
                        });
                        const PAGE_SIZE = 5;
                        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                        const paginated = filtered.slice(ownerSearchPage * PAGE_SIZE, (ownerSearchPage + 1) * PAGE_SIZE);
                        
                        return (
                          <>
                            {paginated.map((p: Patient) => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  updateAccountForm({
                                    ownerId: String(p.id),
                                    name: `${p.firstName} ${p.surname} Wallet`
                                  });
                                  setShowOwnerSearchDrop(false);
                                  setOwnerSearchQuery('');
                                }}
                                style={dropItemStyle}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--teal-50)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-900)' }}>{p.firstName} {p.middleName} {p.surname}</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>{p.phone} • Slip: {p.slipNumber}</div>
                              </div>
                            ))}
                            {filtered.length === 0 && <div style={{ padding: '0.75rem', color: 'var(--gray-400)', fontSize: '0.72rem', textAlign: 'center' }}>No patients found.</div>}
                            {totalPages > 1 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)', fontSize: '0.7rem' }}>
                                <button type="button" disabled={ownerSearchPage === 0} onClick={() => setOwnerSearchPage(Math.max(0, ownerSearchPage - 1))} style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>Prev</button>
                                <span>Page {ownerSearchPage + 1} of {totalPages}</span>
                                <button type="button" disabled={ownerSearchPage >= totalPages - 1} onClick={() => setOwnerSearchPage(Math.min(totalPages - 1, ownerSearchPage + 1))} style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>Next</button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </Field>
          ) : (
            <div style={{ border: '1px solid var(--teal-100)', padding: '0.75rem', borderRadius: 6, background: '#f0fdfa', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--teal-800)' }}>New Owner Registration</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <input required placeholder="First Name *" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.firstName} onChange={e => updateNewOwnerForm({ firstName: e.target.value })} />
                <input required placeholder="Surname *" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.surname} onChange={e => updateNewOwnerForm({ surname: e.target.value })} />
                <input placeholder="Middle Name" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.middleName} onChange={e => updateNewOwnerForm({ middleName: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <input required placeholder="Age *" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.age} onChange={e => updateNewOwnerForm({ age: e.target.value })} />
                <select style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.sex} onChange={e => updateNewOwnerForm({ sex: e.target.value as any })}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <input required placeholder="Phone *" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.phone} onChange={e => updateNewOwnerForm({ phone: e.target.value })} />
              </div>
              <input placeholder="Address" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.address} onChange={e => updateNewOwnerForm({ address: e.target.value })} />
            </div>
          )}

          {/* Additional Dependents for Family */}
          {accountForm.type === 'family' && isOwnerNew && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-800)' }}>Register Additional Dependents (Optional)</div>
                <button type="button" onClick={addDependent} style={{ background: 'white', border: '1px solid var(--teal-600)', color: 'var(--teal-700)', padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: 600, borderRadius: 4, cursor: 'pointer' }}>+ Add Dependent</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {newDependentsToRegister.map((dep, idx) => (
                  <div key={dep.tempId} style={{ border: '1px solid var(--gray-200)', padding: '0.5rem', borderRadius: 4, background: 'var(--gray-50)', position: 'relative' }}>
                    <button type="button" onClick={() => removeDependent(dep.tempId)} style={{ position: 'absolute', top: 5, right: 5, background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}>Remove</button>
                    <div style={{ fontSize: '0.65rem', color: 'var(--gray-500)', marginBottom: '0.25rem' }}>Dependent {idx + 1}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.35rem', marginBottom: '0.35rem' }}>
                      <input placeholder="First Name *" style={{ ...inputStyle(false), padding: '0.25rem 0.4rem', fontSize: '0.7rem' }} value={dep.firstName} onChange={e => updateDependent(dep.tempId, 'firstName', e.target.value)} />
                      <input placeholder="Surname *" style={{ ...inputStyle(false), padding: '0.25rem 0.4rem', fontSize: '0.7rem' }} value={dep.surname} onChange={e => updateDependent(dep.tempId, 'surname', e.target.value)} />
                      <input placeholder="Age *" style={{ ...inputStyle(false), padding: '0.25rem 0.4rem', fontSize: '0.7rem' }} value={dep.age} onChange={e => updateDependent(dep.tempId, 'age', e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.35rem' }}>
                      <select style={{ ...inputStyle(false), padding: '0.25rem 0.4rem', fontSize: '0.7rem' }} value={dep.sex} onChange={e => updateDependent(dep.tempId, 'sex', e.target.value)}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                      <input placeholder="Phone" style={{ ...inputStyle(false), padding: '0.25rem 0.4rem', fontSize: '0.7rem' }} value={dep.phone} onChange={e => updateDependent(dep.tempId, 'phone', e.target.value)} />
                      <input placeholder="Middle Name" style={{ ...inputStyle(false), padding: '0.25rem 0.4rem', fontSize: '0.7rem' }} value={dep.middleName} onChange={e => updateDependent(dep.tempId, 'middleName', e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--gray-200)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button type="button" onClick={() => store.setShowBillingAccountModal(false)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ padding: '0.5rem 1.5rem', background: 'var(--teal-700)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '0.8rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Creating...' : 'Open Wallet'}
          </button>
        </div>
      </form>
    </div>
  );
}
