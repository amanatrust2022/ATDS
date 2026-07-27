// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { fetchBillingAccounts } from '@/lib/store';
import { 
  RiFolderUserLine, RiAddLine, RiWalletLine, 
  RiCloseLine, RiPrinterLine, RiFileTextLine 
} from '@remixicon/react';
import { useWalletStore } from '@/lib/store/useWalletStore';
import { 
  fetchAccountLedger, fetchExternalCharges, linkPatientToAccount, registerPatientAndGetId, logExternalCharge, updateBillingAccountLimit, upgradeBillingAccount, depositToBillingAccount, updatePatientBillingAccount, generateSlipNumber 
} from '@/lib/store';
import { getLedgerStatementTemplate, printHtml } from '@/lib/templates';
import { Patient, BillingAccount } from '@/lib/store';

const inputStyle = (error?: boolean) => ({
  width: '100%', padding: '0.65rem 1rem', borderRadius: 'var(--radius)',
  border: error ? '1px solid var(--red)' : '1px solid var(--gray-300)',
  fontSize: '0.82rem', fontFamily: 'var(--font-sans)', outline: 'none'
});

const closeBtn = { background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.4rem', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex' };

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
  width: '100%', maxWidth: 900, maxHeight: '90vh',
  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  display: 'flex', flexDirection: 'column', overflow: 'hidden'
};

export default function LedgerModal({ organization, patients, profile, onSuccess }: any) {
  
  
  const store = useWalletStore();
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState(''); // Used for loading states in modals, not fully extracted but prevents crashes
  const [saving, setSaving] = useState(false); // Used for loading states in modals, not fully extracted but prevents crashes
  
  const { 
    showLedgerModal, workspaceTab, externalCharges, billingTransactions, loadingLedger,
    showAddExisting, existingPatientToLink, showQuickRegisterDep, workspaceDepForm,
    depositAmount, depositMethod, depositNotes, depositing,
    showWorkspaceLogExpense, workspaceExpenseForm
  } = store;

  const setWorkspaceDepForm = (val) => typeof val === 'function' ? store.updateWorkspaceDepForm(val(workspaceDepForm)) : store.updateWorkspaceDepForm(val);
  const setWorkspaceExpenseForm = (val) => typeof val === 'function' ? store.updateWorkspaceExpenseForm(val(workspaceExpenseForm)) : store.updateWorkspaceExpenseForm(val);
  
  const setShowLedgerModal = (val) => val === null ? store.closeLedger() : store.openLedger(val);
  const setWorkspaceTab = store.setWorkspaceTab;
  const setBillingTransactions = store.setBillingTransactions;
  const setShowAddExisting = store.setShowAddExisting;
  const setExistingPatientToLink = store.setExistingPatientToLink;
  const setShowQuickRegisterDep = store.setShowQuickRegisterDep;
  const setShowWorkspaceLogExpense = store.setShowWorkspaceLogExpense;
  const setDepositAmount = store.setDepositAmount;
  const setDepositMethod = store.setDepositMethod;
  const setDepositNotes = store.setDepositNotes;
  const setDepositing = store.setDepositing;


  const handleDepositSubmit = async (accountId: string) => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return alert('Please enter a valid deposit amount');

    setDepositing(true);
    try {
      await depositToBillingAccount(
        accountId,
        amt,
        depositNotes.trim() || 'Top-up deposit',
        depositMethod,
        profile?.full_name || 'Staff',
        organization?.id || '',
        undefined
      );

      alert('Deposit processed successfully');
      setDepositAmount('');
      setDepositNotes('');

      // Reload ledger and refresh accounts
      const txs = await fetchAccountLedger(accountId);
      setBillingTransactions(txs);

      const accs = await fetchBillingAccounts(organization?.id || '');
      store.setBillingAccounts(accs);
      // update selected ledger account if open
      const updatedAcc = accs.find(a => a.id === accountId);
      if (updatedAcc) {
        setShowLedgerModal(updatedAcc);
      }
    } catch (err: any) {
      alert('Deposit failed: ' + err.message);
    } finally {
      setDepositing(false);
    }
  };

  const handleLogExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceExpenseForm.patientId) return alert('Please select a patient');
    if (!workspaceExpenseForm.receiptNumber.trim()) return alert('Please enter a receipt number');
    const amt = parseFloat(workspaceExpenseForm.amount);
    if (isNaN(amt) || amt <= 0) return alert('Please enter a valid amount');

    setSaving(true);
    try {
      const selectedPatient = patients.find(p => p.id === Number(workspaceExpenseForm.patientId));
      const bAccountId = selectedPatient?.billingAccountId || null;

      const chargePayload = {
        organizationId: organization?.id || '',
        patientId: workspaceExpenseForm.patientId,
        billingAccountId: workspaceExpenseForm.paymentMethod === 'wallet' ? bAccountId || undefined : undefined,
        department: workspaceExpenseForm.department,
        receiptNumber: workspaceExpenseForm.receiptNumber.trim(),
        amount: amt,
        paymentMethod: workspaceExpenseForm.paymentMethod,
        status: 'paid' as const,
        description: workspaceExpenseForm.description.trim() || undefined,
        createdBy: profile?.full_name || 'Staff'
      };

      await logExternalCharge(chargePayload);
      alert('Department charge logged successfully');
      setShowWorkspaceLogExpense(false);
      onSuccess();
    } catch (err: any) {
      alert('Logging failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Load ledger transactions and reset workspace states when modal opens
  useEffect(() => {
    if (showLedgerModal) {
      setLoadingLedgerLocal(true);
      fetchAccountLedger(showLedgerModal.id)
        .then(txs => setBillingTransactions(txs))
        .catch(err => console.error(err))
        .finally(() => setLoadingLedgerLocal(false));

      setWorkspaceTab('members');
      setShowAddExisting(false);
      setShowQuickRegisterDep(false);
      setShowWorkspaceLogExpense(false);
      setExistingPatientToLink('');
    } else {
      setBillingTransactions([]);
    }
  }, [showLedgerModal]);

  

  const handleUpdateLimit = async (accountId: string) => {
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

  const handleLinkExistingDependent = async (accountId: string) => {
    if (!existingPatientToLink) return;
    try {
      await updatePatientBillingAccount(existingPatientToLink, accountId);
      alert('Patient linked successfully');
      setExistingPatientToLink('');
      setShowAddExisting(false);
      onSuccess();
    } catch (err: any) {
      alert('Failed to link patient: ' + err.message);
    }
  };

  const handleUnlinkDependent = async (patientId: number | string) => {
    if (!confirm('Are you sure you want to unlink this dependent from this wallet account?')) return;
    try {
      await updatePatientBillingAccount(patientId, null);
      alert('Patient unlinked successfully');
      onSuccess();
    } catch (err: any) {
      alert('Failed to unlink patient: ' + err.message);
    }
  };

  const handleQuickRegisterDependentSubmit = async (e: React.FormEvent, accountId: string) => {
    e.preventDefault();
    if (!workspaceDepForm.firstName.trim() || !workspaceDepForm.surname.trim()) {
      return alert('First Name and Surname are required');
    }

    setSaving(true);
    try {
      const slipNumber = await generateSlipNumber(organization?.id || '');
      const patientData = {
        slipNumber,
        registeredAt: new Date().toISOString(),
        name: [workspaceDepForm.firstName, workspaceDepForm.middleName, workspaceDepForm.surname].filter(Boolean).join(' '),
        firstName: workspaceDepForm.firstName.trim(),
        surname: workspaceDepForm.surname.trim(),
        middleName: workspaceDepForm.middleName.trim(),
        age: workspaceDepForm.age.trim(),
        sex: workspaceDepForm.sex,
        phone: workspaceDepForm.phone.trim(),
        address: workspaceDepForm.address.trim(),
        billingAccountId: accountId
      };

      await registerPatientAndGetId(patientData as any, organization?.id || '');
      alert('Dependent registered and linked successfully');

      setWorkspaceDepForm({
        firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', address: ''
      });
      setShowQuickRegisterDep(false);
      onSuccess();
    } catch (err: any) {
      alert('Failed to register dependent: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleWorkspaceExpenseSubmit = async (e: React.FormEvent, accountId: string) => {
    e.preventDefault();
    if (!workspaceExpenseForm.patientId) return alert('Please select a member');
    if (!workspaceExpenseForm.receiptNumber.trim()) return alert('Please enter a receipt number');
    const amt = parseFloat(workspaceExpenseForm.amount);
    if (isNaN(amt) || amt <= 0) return alert('Please enter a valid amount');

    setSaving(true);
    try {
      const chargePayload = {
        organizationId: organization?.id || '',
        patientId: workspaceExpenseForm.patientId,
        billingAccountId: workspaceExpenseForm.paymentMethod === 'wallet' ? accountId : undefined,
        department: workspaceExpenseForm.department,
        receiptNumber: workspaceExpenseForm.receiptNumber.trim(),
        amount: amt,
        paymentMethod: workspaceExpenseForm.paymentMethod,
        status: 'paid' as const,
        description: workspaceExpenseForm.description.trim() || undefined,
        createdBy: profile?.full_name || 'Staff'
      };

      await logExternalCharge(chargePayload);
      alert('Department charge logged successfully');

      setWorkspaceExpenseForm({
        patientId: '', department: 'pharmacy', receiptNumber: '', amount: '', paymentMethod: 'wallet', description: ''
      });
      setShowWorkspaceLogExpense(false);

      // Refresh charges & ledger list
      const txs = await fetchAccountLedger(accountId);
      setBillingTransactions(txs);
      onSuccess();
    } catch (err: any) {
      alert('Logging failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };


  const handlePrintStatement = (account: BillingAccount) => {
    const members = patients.filter(p => p.billingAccountId === account.id);
    const html = getLedgerStatementTemplate(account, billingTransactions, members, organization as any);
    printHtml(html);
  };



  if (!showLedgerModal) return null;

  return (
    <div style={modalOverlay}>
          <div style={{ ...modalBox, maxWidth: 1250 }}>
            {/* Modal Header */}
            <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Account Workspace</h2>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', marginTop: '0.15rem' }}>{showLedgerModal.name} • Wallet Administration & Billing</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handlePrintStatement(showLedgerModal)}
                  style={{ background: 'white', color: 'var(--teal-800)', border: 'none', padding: '0.35rem 0.65rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <RiPrinterLine size={14} /> Print Statement
                </button>
                <button type="button" onClick={() => setShowLedgerModal(null)} style={closeBtn}><RiCloseLine size={16} /></button>
              </div>
            </div>

            {/* Modal Workspace Body (Dual Column Grid) */}
            <div style={{ display: 'grid', gridTemplateColumns: '4fr 6fr', maxHeight: '90vh', minHeight: '650px' }}>
              {/* Left Column: Account Details, Deposits & Dept Charges Forms */}
              <div style={{ padding: '1.25rem', paddingBottom: '2.5rem', background: '#f8fafc', overflowY: 'auto', borderRight: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Balance Card */}
                <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '1rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Current Balance</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: showLedgerModal.balance >= 0 ? '#166534' : '#991b1b', marginTop: '0.2rem' }}>
                    ₦{showLedgerModal.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Credit Limit:</span>
                    {isEditingLimit ? (
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <input 
                          type="number" 
                          value={newCreditLimit} 
                          onChange={e => setNewCreditLimit(e.target.value)} 
                          style={{ padding: '2px', width: '60px', fontSize: '0.7rem', border: '1px solid var(--gray-300)' }} 
                          placeholder={String(showLedgerModal.credit_limit || 0)}
                        />
                        <button onClick={() => handleUpdateLimit(showLedgerModal.id)} style={{ background: 'var(--teal-600)', color: 'white', border: 'none', padding: '2px 4px', fontSize: '0.65rem', cursor: 'pointer', borderRadius: '4px' }}>Save</button>
                        <button onClick={() => setIsEditingLimit(false)} style={{ background: 'var(--gray-200)', border: 'none', padding: '2px 4px', fontSize: '0.65rem', cursor: 'pointer', borderRadius: '4px' }}>X</button>
                      </div>
                    ) : (
                      <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        ₦{(showLedgerModal.credit_limit || 0).toLocaleString('en-NG')}
                        <button onClick={() => { setIsEditingLimit(true); setNewCreditLimit(String(showLedgerModal.credit_limit || 0)); }} style={{ background: 'none', border: 'none', color: 'var(--teal-600)', cursor: 'pointer', fontSize: '0.65rem', textDecoration: 'underline' }}>Edit</button>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Account Type:</span>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{showLedgerModal.type}</span>
                  </div>
                </div>

                {/* Form Switcher */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowWorkspaceLogExpense(false)}
                    style={{
                      flex: 1, padding: '0.4rem', border: 'none', background: !showWorkspaceLogExpense ? 'white' : 'transparent',
                      color: !showWorkspaceLogExpense ? 'var(--teal-700)' : 'var(--gray-500)',
                      fontWeight: 600, fontSize: '0.72rem', borderBottom: !showWorkspaceLogExpense ? '2px solid var(--teal-600)' : '2px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                    Load Funds (Deposit)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allVisits = patients.filter(p => p.billingAccountId === showLedgerModal.id);
                  const uniqueMembersMap = new Map();
                  allVisits.forEach(v => {
                    const key = `${v.firstName?.toLowerCase()}-${v.surname?.toLowerCase()}`;
                    if (!uniqueMembersMap.has(key)) {
                      uniqueMembersMap.set(key, v);
                    }
                  });
                  const members = Array.from(uniqueMembersMap.values());
                      setWorkspaceExpenseForm(prev => ({
                        ...prev,
                        patientId: members[0]?.id ? String(members[0].id) : ''
                      }));
                      setShowWorkspaceLogExpense(true);
                    }}
                    style={{
                      flex: 1, padding: '0.4rem', border: 'none', background: showWorkspaceLogExpense ? 'white' : 'transparent',
                      color: showWorkspaceLogExpense ? 'var(--teal-700)' : 'var(--gray-500)',
                      fontWeight: 600, fontSize: '0.72rem', borderBottom: showWorkspaceLogExpense ? '2px solid var(--teal-600)' : '2px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                    Log Dept Charge
                  </button>
                </div>

                {/* Load Funds Form */}
                {!showWorkspaceLogExpense && (
                  <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <RiWalletLine size={16} /> Load Funds (Deposit)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <Field label="Deposit Amount (₦)">
                        <input
                          type="number"
                          min="1"
                          placeholder="Amount to add"
                          style={inputStyle(false)}
                          value={depositAmount}
                          onChange={e => setDepositAmount(e.target.value)}
                        />
                      </Field>
                      <Field label="Payment Method">
                        <select style={inputStyle(false)} value={depositMethod} onChange={e => setDepositMethod(e.target.value)}>
                          <option value="cash">Cash</option>
                          <option value="pos">POS</option>
                          <option value="transfer">Bank Transfer</option>
                        </select>
                      </Field>
                      <Field label="Notes / Description">
                        <input
                          placeholder="e.g. Monthly top-up"
                          style={inputStyle(false)}
                          value={depositNotes}
                          onChange={e => setDepositNotes(e.target.value)}
                        />
                      </Field>
                      <button
                        type="button"
                        disabled={depositing}
                        onClick={() => handleDepositSubmit(showLedgerModal.id)}
                        style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.5rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius)', fontSize: '0.78rem', marginTop: '0.25rem' }}
                      >
                        {depositing ? 'Processing...' : 'Load Funds'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Log Department Charge Form */}
                {showWorkspaceLogExpense && (
                  <form onSubmit={(e) => handleWorkspaceExpenseSubmit(e, showLedgerModal.id)} style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <RiFileTextLine size={16} /> Log Clinical Dept Charge
                    </h4>

                    <Field label="Select Patient Member *">
                      <select
                        required
                        style={inputStyle(false)}
                        value={workspaceExpenseForm.patientId}
                        onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, patientId: e.target.value })}
                      >
                        <option value="">-- Select Member --</option>
                        {patients.filter(p => p.billingAccountId === showLedgerModal.id).map(p => (
                          <option key={p.id} value={p.id}>{p.firstName} {p.surname} ({p.slipNumber})</option>
                        ))}
                      </select>
                    </Field>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <Field label="Department">
                        <select
                          style={inputStyle(false)}
                          value={workspaceExpenseForm.department}
                          onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, department: e.target.value })}
                        >
                          <option value="pharmacy">Pharmacy</option>
                          <option value="consultation">Consultation</option>
                          <option value="ward">Ward / Admission</option>
                          <option value="nursing">Nursing / Dressing</option>
                          <option value="consumables">Consumables</option>
                          <option value="other">Other</option>
                        </select>
                      </Field>
                      <Field label="Receipt/Bill Number *">
                        <input
                          required
                          style={inputStyle(false)}
                          placeholder="e.g. RX-2026-98"
                          value={workspaceExpenseForm.receiptNumber}
                          onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, receiptNumber: e.target.value })}
                        />
                      </Field>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <Field label="Amount (₦) *">
                        <input
                          type="number"
                          min="1"
                          required
                          style={inputStyle(false)}
                          placeholder="Amount"
                          value={workspaceExpenseForm.amount}
                          onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, amount: e.target.value })}
                        />
                      </Field>
                      <Field label="Payment Method">
                        <select
                          style={inputStyle(false)}
                          value={workspaceExpenseForm.paymentMethod}
                          onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, paymentMethod: e.target.value })}
                        >
                          <option value="wallet">Account Wallet</option>
                          <option value="cash">Cash</option>
                          <option value="pos">POS</option>
                          <option value="transfer">Bank Transfer</option>
                        </select>
                      </Field>
                    </div>

                    <Field label="Description / Items">
                      <input
                        placeholder="e.g. Pharmacy Drugs"
                        style={inputStyle(false)}
                        value={workspaceExpenseForm.description}
                        onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, description: e.target.value })}
                      />
                    </Field>

                    <button
                      type="submit"
                      disabled={saving}
                      style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.5rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius)', fontSize: '0.78rem', marginTop: '0.25rem' }}
                    >
                      {saving ? 'Saving Charge...' : 'Log & Process Charge'}
                    </button>
                  </form>
                )}
              </div>

              {/* Right Column: Tabbed Lists */}
              <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Tabs Selector */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', gap: '1rem' }}>
                  {[
                    { id: 'members', label: `Linked Members` },
                    { id: 'ledger', label: 'Transaction Statement' },
                    { id: 'charges', label: 'Department Spend Logs' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setWorkspaceTab(tab.id as any)}
                      style={{
                        padding: '0.5rem 0.25rem', border: 'none', background: 'none',
                        color: workspaceTab === tab.id ? 'var(--teal-700)' : 'var(--gray-500)',
                        fontWeight: 600, fontSize: '0.8rem', borderBottom: workspaceTab === tab.id ? '2px solid var(--teal-600)' : '2px solid transparent',
                        cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Inner Tab contents */}
                {workspaceTab === 'members' && (() => {
                  const members = patients.filter(p => p.billingAccountId === showLedgerModal.id);
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-900)' }}>Account Members ({members.length})</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                        </div>
                      </div>

                      {showAddExisting && (
                        <div style={{ background: '#f8fafc', padding: '#f8fafc', paddingBottom: '0.75rem', borderRadius: 6, border: '1px solid var(--gray-200)', marginBottom: '1rem' }}>
                          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.5rem', padding: '0.5rem' }}>Link Existing Patient</h4>
                          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem' }}>
                            <select
                              value={existingPatientToLink}
                              onChange={e => setExistingPatientToLink(e.target.value)}
                              style={{ ...inputStyle(false), flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              <option value="">-- Select Patient --</option>
                              {patients
                                .filter(p => !p.billingAccountId)
                                .map(p => (
                                  <option key={p.id} value={p.id}>{p.firstName} {p.surname} ({p.slipNumber})</option>
                                ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleLinkExistingDependent(showLedgerModal.id)}
                              disabled={!existingPatientToLink}
                              style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}
                            >
                              Link Patient
                            </button>
                          </div>
                        </div>
                      )}

                      {showQuickRegisterDep && (
                        <form
                          onSubmit={(e) => handleQuickRegisterDependentSubmit(e, showLedgerModal.id)}
                          style={{ background: '#f8fafc', padding: '1rem', borderRadius: 6, border: '1px solid var(--gray-200)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                        >
                          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-700)' }}>Register & Link New Dependent</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                            <Field label="First Name *">
                              <input required style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.firstName} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, firstName: e.target.value })} />
                            </Field>
                            <Field label="Surname *">
                              <input required style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.surname} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, surname: e.target.value })} />
                            </Field>
                            <Field label="Middle Name">
                              <input style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.middleName} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, middleName: e.target.value })} />
                            </Field>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                            <Field label="Age *">
                              <input required placeholder="e.g. 30" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.age} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, age: e.target.value })} />
                            </Field>
                            <Field label="Sex">
                              <select style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.sex} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, sex: e.target.value as any })}>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                              </select>
                            </Field>
                            <Field label="Phone">
                              <input style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.phone} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, phone: e.target.value })} />
                            </Field>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <button type="button" onClick={() => setShowQuickRegisterDep(false)} style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}>Cancel</button>
                            <button type="submit" style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}>Register Member</button>
                          </div>
                        </form>
                      )}

                      <div style={{ overflowX: 'auto', border: '1px solid var(--gray-200)', borderRadius: 4, background: 'white' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Name</th>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Slip No.</th>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, width: '120px', minWidth: '120px' }}>Age / Sex</th>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Phone</th>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Role</th>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.map(m => (
                              <tr key={m.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{m.firstName} {m.surname}</td>
                                <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'var(--font-mono)' }}>{m.slipNumber}</td>
                                <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>{m.age} / {m.sex}</td>
                                <td style={{ padding: '0.6rem 0.75rem' }}>{m.phone || '—'}</td>
                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                  <span style={{
                                    fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                    background: m.id === Number(showLedgerModal.owner_patient_id) ? '#eff6ff' : '#f1f5f9',
                                    color: m.id === Number(showLedgerModal.owner_patient_id) ? '#1d4ed8' : '#475569'
                                  }}>
                                    {m.id === Number(showLedgerModal.owner_patient_id) ? 'Owner' : 'Dependent'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                                  {m.id !== Number(showLedgerModal.owner_patient_id) && (
                                    <button
                                      type="button"
                                      onClick={() => handleUnlinkDependent(m.id)}
                                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                    >
                                      Unlink
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {workspaceTab === 'ledger' && (
                  <div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '0.75rem' }}>Account Ledger History</h3>
                    {loadingLedger ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>Loading statement...</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {billingTransactions.map(tx => {
                          const dt = new Date(tx.created_at).toLocaleDateString('en-NG', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          });
                          const isDeposit = tx.type === 'deposit' || tx.amount >= 0;
                          return (
                            <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', border: '1px solid var(--gray-100)', background: 'var(--gray-50)', borderRadius: 4 }}>
                              <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-800)' }}>{tx.description}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--gray-500)', marginTop: '0.15rem' }}>
                                  {dt} • Ref: {tx.reference_id || '—'} • Staff: {tx.created_by || '—'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.82rem', color: isDeposit ? '#166534' : '#991b1b' }}>
                                {isDeposit ? '+' : ''}₦{tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          );
                        })}
                        {billingTransactions.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)', fontSize: '0.78rem' }}>No transactions logged.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {workspaceTab === 'charges' && (
                  <div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '0.75rem' }}>Department Charge History</h3>
                    <div style={{ overflowX: 'auto', border: '1px solid var(--gray-200)', borderRadius: 4, background: 'white' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Date</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Patient</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Department</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Receipt No.</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Amount</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Payment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {externalCharges
                            .filter(ec => ec.billingAccountId === showLedgerModal.id)
                            .map(ec => {
                              const dateStr = new Date(ec.createdAt).toLocaleDateString('en-NG', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              });
                              return (
                                <tr key={ec.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                  <td style={{ padding: '0.6rem 0.75rem', color: 'var(--gray-600)' }}>{dateStr}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{ec.patientName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textTransform: 'capitalize' }}>{ec.department}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'var(--font-mono)' }}>{ec.receiptNumber}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>₦{ec.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textTransform: 'uppercase', fontSize: '0.7rem' }}>{ec.paymentMethod}</td>
                                </tr>
                              );
                            })}
                          {externalCharges.filter(ec => ec.billingAccountId === showLedgerModal.id).length === 0 && (
                            <tr>
                              <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>No department charges logged for this account.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
  );
}
