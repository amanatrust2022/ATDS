'use client';

import { Button, Dialog, Field, Input } from '@/components/ui';
import type { CommissionEntry } from '@/lib/store';

import styles from './commissions.module.css';

const money = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

/**
 * Recording that a referrer has been paid.
 *
 * Was a hand-rolled overlay with a teal header band and a close button made of
 * a translucent white square — no focus trap, no Escape, and a scrim that sat
 * at rgba(0,0,0,0.5) in both themes. It is the shared Dialog now.
 */
export function SettleCommissionDialog({
  entry,
  notes,
  onNotesChange,
  processing,
  onConfirm,
  onClose,
}: {
  entry: CommissionEntry | null;
  notes: string;
  onNotesChange: (v: string) => void;
  processing: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!entry) return null;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="sm"
      title="Record this commission as paid"
      description={`${entry.referrerName} — for ${entry.patientName}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button intent="primary" loading={processing} onClick={onConfirm}>
            Mark as paid
          </Button>
        </>
      }
    >
      <div className={styles['settle']}>
        <dl className={styles['settleFacts']}>
          <div>
            <dt>Patient</dt>
            <dd>
              {entry.patientName} <span className={styles['slip']}>{entry.slipNumber}</span>
            </dd>
          </div>
          <div>
            <dt>Referred by</dt>
            <dd>{entry.referrerName}</dd>
          </div>
        </dl>

        <p className={styles['settleAmount']}>
          <span className={styles['settleAmountLabel']}>Commission owed</span>
          <span className={styles['settleAmountValue']}>{money(entry.commissionAmount)}</span>
        </p>

        <Field
          label="How it was paid"
          hint="A transfer reference or voucher number, so this can be traced later."
          optional
        >
          <Input
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="e.g. Transfer ref 8823, or cash voucher 41"
          />
        </Field>
      </div>
    </Dialog>
  );
}
