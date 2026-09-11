'use client';

import { useState } from 'react';
import { RiAddLine } from '@remixicon/react';

import { useNotices } from '@/components/Notices';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Field,
  FieldRow,
  Input,
  Select,
} from '@/components/ui';
import {
  createBillingAccount,
  generateSlipNumber,
  registerPatientAndGetId,
  type Patient,
} from '@/lib/store';
import { useWalletStore } from '@/lib/store/useWalletStore';

import { OwnerPicker } from './OwnerPicker';
import { PersonFields } from './PersonFields';
import styles from './billingAccount.module.css';

const FORM_ID = 'billing-account-form';

/**
 * Opening a billing account.
 *
 * The submit used to be a second copy of `submitCreateAccount`, written out
 * again inside this component — and the copy predated the fix. The store
 * validates every person before it writes any of them; this copy still
 * validated each dependant as it reached them, so a blank surname on the second
 * one threw *after* the owner and the first had already been registered. No
 * wallet, two patients loose in the queue owned by nobody, and pressing the
 * button again made two more. The store's version is the only one now.
 */
export default function BillingAccountModal({
  organization,
  patients,
  profile,
  onSuccess,
}: {
  organization: { id?: string } | null | undefined;
  patients: Patient[];
  profile: { full_name?: string } | null | undefined;
  onSuccess: () => void;
}) {
  const { notify } = useNotices();
  const {
    accountForm,
    isOwnerNew,
    newOwnerForm,
    newDependentsToRegister,
    ownerSearchQuery,
    ownerSearchPage,
    showOwnerSearchDrop,
    updateAccountForm,
    updateNewOwnerForm,
    updateDependent,
    addDependent,
    removeDependent,
    setIsOwnerNew,
    setOwnerSearchQuery,
    setOwnerSearchPage,
    setShowOwnerSearchDrop,
    setShowBillingAccountModal,
    setNewDependentsToRegister,
    submitCreateAccount,
  } = useWalletStore();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const close = () => setShowBillingAccountModal(false);

  const takesDependants = accountForm.type === 'family' && isOwnerNew;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await submitCreateAccount({
        organizationId: organization?.id || '',
        profileName: profile?.full_name || 'Staff',
        generateSlipNumber,
        registerPatientAndGetId,
        createBillingAccount,
      });

      notify('Billing account created successfully', 'success');
      close();
      setIsOwnerNew(false);
      setNewDependentsToRegister([]);
      updateNewOwnerForm({
        firstName: '',
        surname: '',
        middleName: '',
        age: '',
        sex: 'Male',
        phone: '',
        address: '',
      });
      onSuccess();
    } catch (err: any) {
      const message = err?.message || 'Could not open the account.';
      // Both: the banner so it stays readable beside the field that caused it,
      // the toast because the desk may have scrolled away from the banner.
      setError(message);
      notify('Failed to create account: ' + message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
      size="lg"
      title="Open billing account"
      description="An individual, family or corporate deposit wallet."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" form={FORM_ID} intent="primary" loading={saving}>
            Open wallet
          </Button>
        </>
      }
      footerNote="The opening deposit is recorded against the account as its first entry."
    >
      <form id={FORM_ID} className={styles['form']} onSubmit={handleSubmit}>
        {error && (
          <Alert tone="critical" live>
            {error}
          </Alert>
        )}

        <Field
          label="Account name"
          // Required only when it cannot be worked out. Registering a new owner
          // derives "Hauwa Ibrahim Wallet" from their name — but the field was
          // marked required regardless, so the browser blocked the submit and
          // that branch could never run.
          required={!isOwnerNew}
          optional={isOwnerNew}
          hint={isOwnerNew ? "Left blank, it is named after the owner." : undefined}
        >
          <Input
            placeholder="e.g. Bello Family Wallet"
            value={accountForm.name}
            onChange={(e) => updateAccountForm({ name: e.target.value })}
          />
        </Field>

        <FieldRow>
          <Field label="Account type">
            <Select
              value={accountForm.type}
              onChange={(e) => updateAccountForm({ type: e.target.value as typeof accountForm.type })}
            >
              <option value="individual">Individual</option>
              <option value="family">Family group</option>
              <option value="corporate">Corporate retainer</option>
            </Select>
          </Field>
          <Field label="Credit limit (₦)" hint="How far the account may go into debit.">
            <Input
              type="number"
              min="0"
              numeric
              value={accountForm.creditLimit}
              onChange={(e) => updateAccountForm({ creditLimit: e.target.value })}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Initial deposit (₦)" optional>
            <Input
              type="number"
              min="0"
              numeric
              value={accountForm.initialDeposit}
              onChange={(e) => updateAccountForm({ initialDeposit: e.target.value })}
            />
          </Field>
          <Field label="Deposit method">
            <Select
              value={accountForm.paymentMethod}
              disabled={!(parseFloat(accountForm.initialDeposit) > 0)}
              onChange={(e) => updateAccountForm({ paymentMethod: e.target.value })}
            >
              <option value="cash">Cash</option>
              <option value="pos">POS</option>
              <option value="transfer">Bank transfer</option>
            </Select>
          </Field>
        </FieldRow>

        {/* Checkbox brings its own label element, so this is a div — a label
         * wrapping a label is invalid and makes the click target ambiguous. */}
        <div className={[styles['toggle'], isOwnerNew ? styles['toggleOn'] : ''].filter(Boolean).join(' ')}>
          <Checkbox
            checked={isOwnerNew}
            label="Register a new patient as account owner"
            hint="Turn this on if the person the wallet belongs to has never been registered here."
            onChange={(e) => {
              setIsOwnerNew(e.target.checked);
              updateAccountForm({ ownerId: '', name: '' });
              setOwnerSearchQuery('');
            }}
          />
        </div>

        {!isOwnerNew ? (
          <OwnerPicker
            patients={patients}
            query={ownerSearchQuery}
            onQueryChange={setOwnerSearchQuery}
            page={ownerSearchPage}
            onPageChange={setOwnerSearchPage}
            open={showOwnerSearchDrop}
            onOpenChange={setShowOwnerSearchDrop}
            selectedId={accountForm.ownerId}
            onSelect={(p) => {
              updateAccountForm({
                ownerId: String(p.id),
                name: `${p.firstName} ${p.surname} Wallet`,
              });
              setShowOwnerSearchDrop(false);
              setOwnerSearchQuery('');
            }}
            onClear={() => updateAccountForm({ ownerId: '', name: '' })}
          />
        ) : (
          <div className={styles['newPerson']}>
            <p className={styles['sectionTitle']}>New owner</p>
            <PersonFields
              value={newOwnerForm}
              onChange={(field, next) => updateNewOwnerForm({ [field]: next } as any)}
            />
          </div>
        )}

        {takesDependants && (
          <div className={styles['dependants']}>
            <div className={styles['dependantsHead']}>
              <p className={styles['sectionTitle']}>Dependants</p>
              <Button size="sm" type="button" icon={<RiAddLine size={14} />} onClick={addDependent}>
                Add dependant
              </Button>
            </div>

            {newDependentsToRegister.map((dep, idx) => (
              <div key={dep.tempId} className={styles['dependant']}>
                <div className={styles['dependantHead']}>
                  <span className={styles['dependantLabel']}>Dependant {idx + 1}</span>
                  <Button
                    size="sm"
                    type="button"
                    intent="dangerQuiet"
                    onClick={() => removeDependent(dep.tempId)}
                  >
                    Remove
                  </Button>
                </div>
                <PersonFields
                  value={dep}
                  showAddress={false}
                  requirePhone={false}
                  onChange={(field, next) => updateDependent(dep.tempId, field, next)}
                />
              </div>
            ))}
          </div>
        )}
      </form>
    </Dialog>
  );
}
