'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, ResultFlag } from '@/components/ui';
import type { criticalRows } from './ParameterTable';
import styles from './entryForm.module.css';

/**
 * The release interlock.
 *
 * Nothing about the old save distinguished a potassium of 7.1 from a normal
 * one. The flag was a dropdown nobody had to touch, so a panic value went to
 * reception looking exactly like anything else, and there was no record that
 * anyone had seen it.
 *
 * This does not ask permission — it makes the technologist read the value back
 * and confirm the clinician has been told. It cannot be dismissed by clicking
 * away or pressing Escape, which is the one place in this product where that
 * is the right call: closing it by accident would mean a critical result was
 * released without anyone looking at it.
 */
export function CriticalValueDialog({
  rows,
  professional,
  onCancel,
  onAcknowledge,
}: {
  rows: ReturnType<typeof criticalRows>;
  /** Who is signing the result. Recorded with the acknowledgement. */
  professional: string;
  onCancel: () => void;
  onAcknowledge: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const open = rows.length > 0;

  // Each new set of criticals is its own decision. Carrying the tick over from
  // the last one would defeat the whole point.
  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open, rows]);

  if (!open) return null;

  const plural = rows.length === 1 ? 'value' : 'values';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      dismissible={false}
      title={`${rows.length} critical ${plural} on this test`}
      description="These results need a clinician told now, not at the end of the round."
      size="md"
      footer={
        <>
          <Button intent="ghost" onClick={onCancel}>
            Go back and check
          </Button>
          <Button intent="danger" disabled={!confirmed} onClick={onAcknowledge}>
            Acknowledge and release
          </Button>
        </>
      }
    >
      <Alert tone="critical" title="Read the value back before you release it">
        A transposed digit and a genuine emergency look the same on screen. Confirm the
        figure against the analyser, then say who you told.
      </Alert>

      <ul className={styles['criticalList']}>
        {rows.map(({ row, flag }) => (
          <li key={row.parameter} className={styles['criticalRow']}>
            <div>
              <div className={styles['criticalParam']}>{row.parameter}</div>
              <div className={styles['criticalValue']}>
                {row.result} {row.unit}
              </div>
              <div className={styles['criticalRange']}>
                Reference range {row.range || 'not recorded'}
              </div>
            </div>
            <ResultFlag value={flag} />
          </li>
        ))}
      </ul>

      <Checkbox
        checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)}
        label={`I have checked ${rows.length === 1 ? 'this figure' : 'these figures'} and told the requesting clinician`}
        hint={
          professional
            ? `Recorded against ${professional} with the result.`
            : 'Enter your name on the form first — the acknowledgement is recorded against it.'
        }
      />
    </Dialog>
  );
}
