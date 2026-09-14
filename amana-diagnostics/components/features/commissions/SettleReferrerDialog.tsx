'use client';

import { useState } from 'react';
import { Alert, Button, Dialog, Field, Input, Table } from '@/components/ui';
import type { CommissionEntry } from '@/lib/store';
import type { SettleResult } from '@/lib/commissionsView';

import styles from './settle.module.css';

const money = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

/**
 * Pay out all outstanding commissions for one referrer in a single action.
 *
 * The single-entry dialog settles one patient visit. This settles every pending
 * visit a referrer has, which is the operation a clinic actually performs: they
 * hand over one bank transfer and tick off the list, rather than clicking into
 * each slip separately.
 */
export function SettleReferrerDialog({
  referrerName,
  pendingEntries,
  open,
  onClose,
  onSettle,
}: {
  referrerName: string;
  pendingEntries: CommissionEntry[];
  open: boolean;
  onClose: () => void;
  /** Called with the settle result so the screen can notify, undo, reload. */
  onSettle: (reference: string, result: SettleResult) => void;
}) {
  const [reference, setReference] = useState('');
  const [processing, setProcessing] = useState(false);
  const [partialError, setPartialError] = useState<SettleResult['failed'] | null>(null);

  const total = pendingEntries.reduce((s, e) => s + e.commissionAmount, 0);

  const handleSettle = async () => {
    setProcessing(true);
    setPartialError(null);
    try {
      // The actual settling is done by the parent — it owns markCommissionPaid,
      // the audit writer, and the notify/undo chain.
      const { settleMany } = await import('@/lib/commissionsView');
      const { markCommissionPaid } = await import('@/lib/store');
      const ids = pendingEntries.map((e) => e.patientId);
      const result = await settleMany(ids, reference, markCommissionPaid);

      if (result.failed.length > 0 && result.paid.length === 0) {
        // Everything failed — stay in dialog, show errors
        setPartialError(result.failed);
        setProcessing(false);
        return;
      }

      onSettle(reference, result);
      if (result.failed.length > 0) {
        setPartialError(result.failed);
        // Partial success: dialog stays open so the partial error is visible.
        setProcessing(false);
      } else {
        // Full success — parent closes the dialog and notifies.
        setReference('');
        setProcessing(false);
        onClose();
      }
    } catch (e: any) {
      setPartialError([{ id: 'batch', error: e.message || 'Unexpected error.' }]);
      setProcessing(false);
    }
  };

  const retry = () => {
    setPartialError(null);
    void handleSettle();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !processing) {
          setReference('');
          setPartialError(null);
          onClose();
        }
      }}
      title={`Pay out ${referrerName}`}
      description={`${pendingEntries.length} pending visit${pendingEntries.length === 1 ? '' : 's'} · ${money(total)} owed`}
      footer={
        <>
          <Button onClick={onClose} disabled={processing}>Cancel</Button>
          <Button intent="primary" loading={processing} onClick={handleSettle}>
            Settle {pendingEntries.length} visit{pendingEntries.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className={styles['body']}>
        {partialError && partialError.length > 0 && (
          <Alert
            tone="warning"
            title={`${partialError.length} visit${partialError.length === 1 ? '' : 's'} could not be settled`}
            actions={<Button size="sm" onClick={retry} loading={processing}>Retry failed</Button>}
          >
            <ul className={styles['failList']}>
              {partialError.map((f) => (
                <li key={String(f.id)}>
                  Slip {String(f.id)} — {f.error}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <div className={styles['amount']}>
          <span className={styles['amountLabel']}>Total to pay out</span>
          <span className={styles['amountValue']}>{money(total)}</span>
        </div>

        <Table
          caption={`Pending visits for ${referrerName}`}
          rows={pendingEntries}
          rowKey={(e) => e.patientId}
          columns={[
            {
              key: 'patient',
              header: 'Patient',
              render: (e: CommissionEntry) => (
                <span className={styles['stack']}>
                  <span className={styles['strong']}>{e.patientName}</span>
                  <span className={styles['slip']}>{e.slipNumber}</span>
                </span>
              ),
            },
            {
              key: 'date',
              header: 'Date',
              render: (e: CommissionEntry) => new Date(e.registeredAt).toLocaleDateString('en-NG'),
            },
            {
              key: 'commission',
              header: 'Commission',
              numeric: true,
              render: (e: CommissionEntry) => money(e.commissionAmount),
            },
          ]}
        />

        <Field
          label="Payment reference"
          hint="A bank transfer ref or voucher number, so this can be traced later."
          optional
        >
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. Transfer ref 8823, or cash payment"
          />
        </Field>
      </div>
    </Dialog>
  );
}
