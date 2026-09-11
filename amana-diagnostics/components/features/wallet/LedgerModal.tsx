import { useNotices } from '@/components/Notices';
import React, { useState, useEffect } from 'react';
import { fetchBillingAccounts } from '@/lib/store';
import { 
  RiFolderUserLine, RiAddLine, RiWalletLine, 
  RiCloseLine, RiPrinterLine, RiFileTextLine 
} from '@remixicon/react';
import { useWalletStore } from '@/lib/store/useWalletStore';
import { 
  fetchAccountLedger, fetchExternalCharges, registerPatientAndGetId, logExternalCharge, updateBillingAccountLimit, upgradeBillingAccount, depositToBillingAccount, updatePatientBillingAccount, generateSlipNumber, reverseLedgerTransaction 
} from '@/lib/store';
import { getLedgerStatementTemplate, printHtml } from '@/lib/templates';
import { Patient, BillingAccount } from '@/lib/store';

import { Button, Dialog, TabPanel, Tabs } from '@/components/ui';

import { LedgerAccountPanel } from './LedgerAccountPanel';
import { LedgerMembers } from './LedgerMembers';
import { LedgerStatement } from './LedgerStatement';
import styles from './ledger.module.css';

/**
 * The wallet ledger.
 *
 * This file carried `// @ts-nocheck` — the one file in the app that did, and
 * the one that moves money. Behind it were three real defects: a call to a
 * setter that does not exist, which threw every time the ledger opened; a
 * variable declared twice in one scope; and an import of something the store
 * does not export. Typing the props is what makes the rest of the file
 * checkable, because `patients: any` made every callback parameter untyped too.
 */
interface LedgerModalProps {
  organization: { id: string; name?: string } | null;
  patients: Patient[];
  profile: { full_name?: string } | null;
  onSuccess?: () => void;
}

export default function LedgerModal({ organization, patients, profile, onSuccess }: LedgerModalProps) {
  const { notify, ask, askFor } = useNotices();
  
  
  const store = useWalletStore();
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [newCreditLimit, setNewCreditLimit] = useState(''); // Used for loading states in modals, not fully extracted but prevents crashes
  const [saving, setSaving] = useState(false); // Used for loading states in modals, not fully extracted but prevents crashes
  
  const { 
    showLedgerModal, workspaceTab, externalCharges, billingTransactions, loadingLedger,
    showAddExisting, existingPatientToLink, showQuickRegisterDep, workspaceDepForm,
    depositAmount, depositMethod, depositNotes, depositing,
    showWorkspaceLogExpense, workspaceExpenseForm
  } = store;

  const setWorkspaceDepForm = (val: any) => typeof val === 'function' ? store.updateWorkspaceDepForm(val(workspaceDepForm)) : store.updateWorkspaceDepForm(val);
  const setWorkspaceExpenseForm = (val: any) => typeof val === 'function' ? store.updateWorkspaceExpenseForm(val(workspaceExpenseForm)) : store.updateWorkspaceExpenseForm(val);
  
  const setShowLedgerModal = (val: any) => val === null ? store.closeLedger() : store.openLedger(val);
  const setWorkspaceTab = store.setWorkspaceTab;
  const setBillingTransactions = store.setBillingTransactions;

  const [reversing, setReversing] = useState(false);

  /**
   * Which entries already have a reversal pointing at them.
   *
   * Derived from the statement rather than tracked separately: a reversal names
   * what it undoes in reference_id, so the statement already knows.
   */
  const reversedIds = new Set(
    billingTransactions.filter((t: any) => t.type === 'reversal' && t.reference_id).map((t: any) => t.reference_id),
  );

  /**
   * Undoes a charge that should not have been made.
   *
   * There was previously no way to do this: a receptionist who charged the
   * wrong wallet could only make a compensating deposit with a note, leaving
   * the wrong charge on the patient's statement looking like a real one.
   */
  const handleReverse = async (tx: any) => {
    const reason = await askFor(
      `Reverse this charge?

${tx.description}

The original entry stays on the statement and a matching credit is added beside it.

Why is it being reversed?`,
    );
    if (reason === null) return;
    if (!reason.trim()) { notify('Please give a reason for the reversal.', 'error'); return; }

    setReversing(true);
    try {
      await reverseLedgerTransaction(tx.id, reason.trim(), profile?.full_name || 'Reception Desk', organization?.id || '');

      const txs = await fetchAccountLedger(tx.billing_account_id);
      setBillingTransactions(txs);

      const accs = await fetchBillingAccounts(organization?.id || '');
      store.setBillingAccounts(accs);

      notify('Charge reversed. The original entry remains on the statement.', 'success');
    } catch (err: any) {
      notify('Could not reverse this charge: ' + (err.message || 'unknown error'), 'error');
    } finally {
      setReversing(false);
    }
  };
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
    if (isNaN(amt) || amt <= 0) return notify('Please enter a valid deposit amount', 'error');

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

      notify('Deposit processed successfully', 'success');
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
      notify('Deposit failed: ' + err.message, 'error');
    } finally {
      setDepositing(false);
    }
  };

  const handleLogExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceExpenseForm.patientId) return notify('Please select a patient', 'error');
    if (!workspaceExpenseForm.receiptNumber.trim()) return notify('Please enter a receipt number', 'error');
    const amt = parseFloat(workspaceExpenseForm.amount);
    if (isNaN(amt) || amt <= 0) return notify('Please enter a valid amount', 'error');

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
      notify('Department charge logged successfully', 'success');
      setShowWorkspaceLogExpense(false);
      onSuccess?.();
    } catch (err: any) {
      notify('Logging failed: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Load ledger transactions and reset workspace states when modal opens
  useEffect(() => {
    if (showLedgerModal) {
      store.setLoadingLedger(true);
      fetchAccountLedger(showLedgerModal.id)
        .then(txs => setBillingTransactions(txs))
        .catch(err => console.error(err))
        .finally(() => store.setLoadingLedger(false));

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
    if (isNaN(limit) || limit < 0) return notify('Invalid credit limit', 'error');
    try {
      await updateBillingAccountLimit(accountId, limit);
      store.updateCreditLimit(accountId, limit);
      setIsEditingLimit(false);
      notify('Credit limit updated successfully', 'success');
    } catch (err: any) {
      notify(err.message, 'info');
    }
  };

  const handleUpgradeAccount = async (accountId: string) => {
    try {
      await upgradeBillingAccount(accountId);
      store.upgradeAccountToFamily(accountId);
      notify('Account upgraded to Family successfully', 'success');
    } catch (err: any) {
      notify(err.message, 'info');
    }
  };

  const handleLinkExistingDependent = async (accountId: string) => {
    if (!existingPatientToLink) return;
    try {
      await updatePatientBillingAccount(existingPatientToLink, accountId);
      notify('Patient linked successfully', 'success');
      setExistingPatientToLink('');
      setShowAddExisting(false);
      onSuccess?.();
    } catch (err: any) {
      notify('Failed to link patient: ' + err.message, 'error');
    }
  };

  const handleUnlinkDependent = async (patientId: number | string) => {
    if (!await ask('Are you sure you want to unlink this dependent from this wallet account?')) return;
    try {
      await updatePatientBillingAccount(patientId, null);
      notify('Patient unlinked successfully', 'success');
      onSuccess?.();
    } catch (err: any) {
      notify('Failed to unlink patient: ' + err.message, 'error');
    }
  };

  const handleQuickRegisterDependentSubmit = async (e: React.FormEvent, accountId: string) => {
    e.preventDefault();
    if (!workspaceDepForm.firstName.trim() || !workspaceDepForm.surname.trim()) {
      return notify('First Name and Surname are required', 'info');
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
      notify('Dependent registered and linked successfully', 'success');

      setWorkspaceDepForm({
        firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', address: ''
      });
      setShowQuickRegisterDep(false);
      onSuccess?.();
    } catch (err: any) {
      notify('Failed to register dependent: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleWorkspaceExpenseSubmit = async (e: React.FormEvent, accountId: string) => {
    e.preventDefault();
    if (!workspaceExpenseForm.patientId) return notify('Please select a member', 'error');
    if (!workspaceExpenseForm.receiptNumber.trim()) return notify('Please enter a receipt number', 'error');
    const amt = parseFloat(workspaceExpenseForm.amount);
    if (isNaN(amt) || amt <= 0) return notify('Please enter a valid amount', 'error');

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
      notify('Department charge logged successfully', 'success');

      setWorkspaceExpenseForm({
        patientId: '', department: 'pharmacy', receiptNumber: '', amount: '', paymentMethod: 'wallet', description: ''
      });
      setShowWorkspaceLogExpense(false);

      // Refresh charges & ledger list
      const txs = await fetchAccountLedger(accountId);
      setBillingTransactions(txs);
      onSuccess?.();
    } catch (err: any) {
      notify('Logging failed: ' + err.message, 'error');
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

  const members = patients.filter((p) => p.billingAccountId === showLedgerModal.id);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) setShowLedgerModal(null);
      }}
      size="xl"
      title={showLedgerModal.name}
      description="Wallet balance, members and statement"
      footer={
        <Button
          icon={<RiPrinterLine size={14} />}
          onClick={() => handlePrintStatement(showLedgerModal)}
        >
          Print Statement
        </Button>
      }
    >
      <div className={styles['layout']}>
        <LedgerAccountPanel
          account={showLedgerModal}
          members={members}
          mode={showWorkspaceLogExpense ? 'charge' : 'deposit'}
          onModeChange={(m) => {
            setShowWorkspaceLogExpense(m === 'charge');
            if (m === 'charge' && !workspaceExpenseForm.patientId && members[0]?.id) {
              setWorkspaceExpenseForm({ ...workspaceExpenseForm, patientId: String(members[0].id) });
            }
          }}
          editingLimit={isEditingLimit}
          onEditLimit={setIsEditingLimit}
          newLimit={newCreditLimit}
          onNewLimitChange={setNewCreditLimit}
          onSaveLimit={() => handleUpdateLimit(showLedgerModal.id)}
          depositAmount={depositAmount}
          onDepositAmountChange={setDepositAmount}
          depositMethod={depositMethod}
          onDepositMethodChange={setDepositMethod}
          depositNotes={depositNotes}
          onDepositNotesChange={setDepositNotes}
          depositing={depositing}
          onDeposit={() => handleDepositSubmit(showLedgerModal.id)}
          expenseForm={workspaceExpenseForm}
          onExpenseFormChange={setWorkspaceExpenseForm}
          saving={saving}
          onLogCharge={(e) => handleWorkspaceExpenseSubmit(e, showLedgerModal.id)}
        />

        <div className={styles['main']}>
          <Tabs
            value={workspaceTab === 'ledger' ? 'ledger' : 'members'}
            onValueChange={(v) => setWorkspaceTab(v as any)}
            ariaLabel="Account sections"
            items={[
              { value: 'members', label: 'Linked Members', count: members.length },
              { value: 'ledger', label: 'Transaction Statement', count: billingTransactions.length },
            ]}
          >
            <TabPanel value="members">
              <LedgerMembers
                account={showLedgerModal}
                patients={patients}
                showAddExisting={showAddExisting}
                onToggleAddExisting={setShowAddExisting}
                existingPatientToLink={existingPatientToLink}
                onExistingPatientChange={setExistingPatientToLink}
                onLinkExisting={() => handleLinkExistingDependent(showLedgerModal.id)}
                showQuickRegister={showQuickRegisterDep}
                onToggleQuickRegister={setShowQuickRegisterDep}
                depForm={workspaceDepForm}
                onDepFormChange={setWorkspaceDepForm}
                saving={saving}
                onQuickRegister={(e) => handleQuickRegisterDependentSubmit(e, showLedgerModal.id)}
                onUpgrade={() => handleUpgradeAccount(showLedgerModal.id)}
                onUnlink={handleUnlinkDependent}
              />
            </TabPanel>

            <TabPanel value="ledger">
              <LedgerStatement
                transactions={billingTransactions}
                loading={loadingLedger}
                reversing={reversing}
                onReverse={handleReverse}
              />
            </TabPanel>
          </Tabs>
        </div>
      </div>
    </Dialog>
  );
}