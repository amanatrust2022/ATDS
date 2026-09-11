'use client';

import { Alert, Badge, Button, EmptyState, Field, Input, Select } from '@/components/ui';
import type { BillingAccount, Patient } from '@/lib/store';

import styles from './ledger.module.css';

/**
 * Who this wallet pays for.
 *
 * An individual account has one member and has to be upgraded before it can
 * take more; a family account can link an existing patient or register a new
 * dependant on the spot.
 */
export function LedgerMembers({
  account,
  patients,
  showAddExisting,
  onToggleAddExisting,
  existingPatientToLink,
  onExistingPatientChange,
  onLinkExisting,
  showQuickRegister,
  onToggleQuickRegister,
  depForm,
  onDepFormChange,
  saving,
  onQuickRegister,
  onUpgrade,
  onUnlink,
}: {
  account: BillingAccount;
  patients: Patient[];
  showAddExisting: boolean;
  onToggleAddExisting: (v: boolean) => void;
  existingPatientToLink: string;
  onExistingPatientChange: (v: string) => void;
  onLinkExisting: () => void;
  showQuickRegister: boolean;
  onToggleQuickRegister: (v: boolean) => void;
  depForm: any;
  onDepFormChange: (v: any) => void;
  saving: boolean;
  onQuickRegister: (e: React.FormEvent) => void;
  onUpgrade: () => void;
  onUnlink: (patientId: number | string) => void;
}) {
  const members = patients.filter((p) => p.billingAccountId === account.id);
  const unlinked = patients.filter((p) => !p.billingAccountId);

  return (
    <div className={styles['members']}>
      <div className={styles['membersHead']}>
        <h3 className={styles['sectionTitle']}>Members ({members.length})</h3>
        <div className={styles['membersActions']}>
          {account.type === 'individual' ? (
            <Button onClick={onUpgrade}>Make this a family account</Button>
          ) : (
            <>
              <Button onClick={() => onToggleAddExisting(!showAddExisting)}>
                {showAddExisting ? 'Cancel' : 'Link an existing patient'}
              </Button>
              <Button intent="primary" onClick={() => onToggleQuickRegister(!showQuickRegister)}>
                {showQuickRegister ? 'Cancel' : 'Register a dependant'}
              </Button>
            </>
          )}
        </div>
      </div>

      {account.type === 'individual' && (
        <Alert tone="info">
          An individual account covers one person. Making it a family account lets you add
          dependants who spend from the same balance.
        </Alert>
      )}

      {showAddExisting && (
        <form
          className={styles['inlineForm']}
          onSubmit={(e) => {
            e.preventDefault();
            onLinkExisting();
          }}
        >
          <Field label="Patient to link" className={styles['grow']}>
            <Select
              value={existingPatientToLink}
              onChange={(e) => onExistingPatientChange(e.target.value)}
            >
              <option value="">Choose a patient…</option>
              {unlinked.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.surname} ({p.slipNumber})
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" intent="primary" disabled={!existingPatientToLink}>
            Link
          </Button>
        </form>
      )}

      {showQuickRegister && (
        <form className={styles['registerForm']} onSubmit={onQuickRegister}>
          <div className={styles['registerGrid']}>
            <Field label="First name" required>
              <Input
                required
                value={depForm.firstName}
                onChange={(e) => onDepFormChange({ ...depForm, firstName: e.target.value })}
              />
            </Field>
            <Field label="Surname" required>
              <Input
                required
                value={depForm.surname}
                onChange={(e) => onDepFormChange({ ...depForm, surname: e.target.value })}
              />
            </Field>
            <Field label="Middle name" optional>
              <Input
                value={depForm.middleName}
                onChange={(e) => onDepFormChange({ ...depForm, middleName: e.target.value })}
              />
            </Field>
            <Field label="Age" required>
              <Input
                required
                placeholder="e.g. 30"
                value={depForm.age}
                onChange={(e) => onDepFormChange({ ...depForm, age: e.target.value })}
              />
            </Field>
            <Field label="Sex">
              <Select
                value={depForm.sex}
                onChange={(e) => onDepFormChange({ ...depForm, sex: e.target.value })}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </Select>
            </Field>
            <Field label="Phone" optional>
              <Input
                value={depForm.phone}
                onChange={(e) => onDepFormChange({ ...depForm, phone: e.target.value })}
              />
            </Field>
          </div>
          <div className={styles['formActions']}>
            <Button onClick={() => onToggleQuickRegister(false)}>Cancel</Button>
            <Button type="submit" intent="primary" loading={saving}>
              Register Member
            </Button>
          </div>
        </form>
      )}

      {members.length === 0 ? (
        <EmptyState title="Nobody is linked to this account yet" compact />
      ) : (
        <ul className={styles['memberList']}>
          {members.map((m) => (
            <li key={m.id} className={styles['member']}>
              <span className={styles['memberText']}>
                <span className={styles['memberName']}>
                  {m.firstName} {m.surname}
                </span>
                <span className={styles['memberMeta']}>
                  {m.slipNumber}
                  {m.id === account.owner_patient_id && (
                    <>
                      {' '}
                      <Badge tone="accent">Account holder</Badge>
                    </>
                  )}
                </span>
              </span>
              {m.id !== account.owner_patient_id && (
                <Button intent="dangerQuiet" size="sm" onClick={() => onUnlink(m.id)}>
                  Unlink
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
