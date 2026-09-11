'use client';

import { Button, Card, CardBody, Field, Input, SegmentedControl, Select } from '@/components/ui';
import type { BillingAccount, Patient } from '@/lib/store';

import styles from './ledger.module.css';

const money = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

/**
 * The balance, and the two ways money moves.
 *
 * Deposit and charge are one switch rather than two stacked forms, because
 * they are alternatives: the desk is doing one or the other, never both.
 */
export function LedgerAccountPanel({
  account,
  members,
  mode,
  onModeChange,
  // Credit limit
  editingLimit,
  onEditLimit,
  newLimit,
  onNewLimitChange,
  onSaveLimit,
  // Deposit
  depositAmount,
  onDepositAmountChange,
  depositMethod,
  onDepositMethodChange,
  depositNotes,
  onDepositNotesChange,
  depositing,
  onDeposit,
  // Charge
  expenseForm,
  onExpenseFormChange,
  saving,
  onLogCharge,
}: {
  account: BillingAccount;
  members: Patient[];
  mode: 'deposit' | 'charge';
  onModeChange: (m: 'deposit' | 'charge') => void;
  editingLimit: boolean;
  onEditLimit: (v: boolean) => void;
  newLimit: string;
  onNewLimitChange: (v: string) => void;
  onSaveLimit: () => void;
  depositAmount: string;
  onDepositAmountChange: (v: string) => void;
  depositMethod: string;
  onDepositMethodChange: (v: string) => void;
  depositNotes: string;
  onDepositNotesChange: (v: string) => void;
  depositing: boolean;
  onDeposit: () => void;
  expenseForm: any;
  onExpenseFormChange: (v: any) => void;
  saving: boolean;
  onLogCharge: (e: React.FormEvent) => void;
}) {
  return (
    <div className={styles['panel']}>
      <Card as="div">
        <CardBody>
          <p className={styles['balanceLabel']}>Balance</p>
          <p className={account.balance >= 0 ? styles['balance'] : styles['balanceOwing']}>
            {money(account.balance)}
          </p>

          <dl className={styles['accountFacts']}>
            <div className={styles['accountFact']}>
              <dt>Credit limit</dt>
              <dd>
                {editingLimit ? (
                  <span className={styles['limitEdit']}>
                    <Input
                      type="number"
                      min="0"
                      value={newLimit}
                      onChange={(e) => onNewLimitChange(e.target.value)}
                      aria-label="New credit limit"
                      placeholder={String(account.credit_limit || 0)}
                    />
                    <Button size="sm" intent="primary" onClick={onSaveLimit}>
                      Save
                    </Button>
                    <Button size="sm" onClick={() => onEditLimit(false)}>
                      Cancel
                    </Button>
                  </span>
                ) : (
                  <span className={styles['limitValue']}>
                    {money(account.credit_limit || 0)}
                    <Button
                      intent="link"
                      size="sm"
                      onClick={() => {
                        onNewLimitChange(String(account.credit_limit || 0));
                        onEditLimit(true);
                      }}
                    >
                      Change
                    </Button>
                  </span>
                )}
              </dd>
            </div>
            <div className={styles['accountFact']}>
              <dt>Account type</dt>
              <dd className={styles['capitalise']}>{account.type}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <SegmentedControl
        value={mode}
        onValueChange={onModeChange}
        ariaLabel="What to record"
        options={[
          { value: 'deposit', label: 'Load Funds (Deposit)' },
          { value: 'charge', label: 'Log Dept Charge' },
        ]}
      />

      {mode === 'deposit' ? (
        <Card as="div">
          <CardBody>
            <div className={styles['form']}>
              <Field label="Amount to add (₦)" required>
                <Input
                  type="number"
                  min="1"
                  placeholder="Amount to add"
                  value={depositAmount}
                  onChange={(e) => onDepositAmountChange(e.target.value)}
                />
              </Field>
              <Field label="How it was paid">
                <Select
                  value={depositMethod}
                  onChange={(e) => onDepositMethodChange(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="pos">POS</option>
                  <option value="transfer">Bank Transfer</option>
                </Select>
              </Field>
              <Field label="Note" optional>
                <Input
                  placeholder="e.g. Monthly top-up"
                  value={depositNotes}
                  onChange={(e) => onDepositNotesChange(e.target.value)}
                />
              </Field>
              <Button intent="primary" fullWidth loading={depositing} onClick={onDeposit}>
                Load Funds
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card as="div">
          <CardBody>
            <form className={styles['form']} onSubmit={onLogCharge}>
              <Field label="Who it is for" required>
                <Select
                  value={expenseForm.patientId}
                  onChange={(e) => onExpenseFormChange({ ...expenseForm, patientId: e.target.value })}
                >
                  <option value="">Choose a member…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.firstName} {m.surname}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Department">
                <Select
                  value={expenseForm.department}
                  onChange={(e) =>
                    onExpenseFormChange({ ...expenseForm, department: e.target.value })
                  }
                >
                  <option value="pharmacy">Pharmacy</option>
                  <option value="consultation">Consultation</option>
                  <option value="ward">Ward / Admission</option>
                  <option value="nursing">Nursing / Dressing</option>
                  <option value="consumables">Consumables</option>
                  <option value="other">Other</option>
                </Select>
              </Field>

              <Field label="Receipt or bill number" required>
                <Input
                  placeholder="e.g. RX-2026-98"
                  value={expenseForm.receiptNumber}
                  onChange={(e) =>
                    onExpenseFormChange({ ...expenseForm, receiptNumber: e.target.value })
                  }
                />
              </Field>

              <Field label="Amount (₦)" required>
                <Input
                  type="number"
                  min="1"
                  placeholder="Amount"
                  value={expenseForm.amount}
                  onChange={(e) => onExpenseFormChange({ ...expenseForm, amount: e.target.value })}
                />
              </Field>

              <Field
                label="How it is being paid"
                hint={
                  expenseForm.paymentMethod === 'wallet'
                    ? 'This will come off the wallet balance.'
                    : 'Recorded against the patient, but not taken from the wallet.'
                }
              >
                <Select
                  value={expenseForm.paymentMethod}
                  onChange={(e) =>
                    onExpenseFormChange({ ...expenseForm, paymentMethod: e.target.value })
                  }
                >
                  <option value="wallet">Account Wallet</option>
                  <option value="cash">Cash</option>
                  <option value="pos">POS</option>
                  <option value="transfer">Bank Transfer</option>
                </Select>
              </Field>

              <Field label="What it was for" optional>
                <Input
                  placeholder="e.g. Pharmacy Drugs"
                  value={expenseForm.description}
                  onChange={(e) =>
                    onExpenseFormChange({ ...expenseForm, description: e.target.value })
                  }
                />
              </Field>

              <Button type="submit" intent="primary" fullWidth loading={saving}>
                Log &amp; Process Charge
              </Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
