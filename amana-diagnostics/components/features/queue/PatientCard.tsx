import React from 'react';
import { RiTestTubeLine, RiRadarLine, RiCheckLine, RiMoreLine, RiTimeLine, RiPrinterLine, RiFileTextLine } from '@remixicon/react';
import { Patient, PatientTest, TestStatus } from '@/lib/store';
import { patientDisplayName } from '@/lib/store/patientName';
import { Button } from '@/components/ui';

import styles from './patientCard.module.css';

const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ');

const STATUS: Record<TestStatus, { label: string; chip: string; Icon: typeof RiCheckLine }> = {
  completed: { label: 'Completed', chip: styles.chipDone, Icon: RiCheckLine },
  in_progress: { label: 'In progress', chip: styles.chipProgress, Icon: RiMoreLine },
  pending: { label: 'Pending', chip: styles.chipPending, Icon: RiTimeLine },
};

interface PatientCardProps {
  patient: Patient;
  mode: 'queue' | 'results';
  onViewSlip: () => void;
  onViewResult: () => void;
}

export function PatientCard({ patient, mode, onViewSlip, onViewResult }: PatientCardProps) {
  const completedCount = patient.tests.filter((t: PatientTest) => t.status === 'completed').length;

  return (
    <div className={styles.card}>
      <div className={styles.main}>
        <div className={styles.identity}>
          <span className={styles.slip}>{patient.slipNumber}</span>
          <span className={styles.name}>{patientDisplayName(patient)}</span>
          <span className={styles.demographics}>{patient.age} • {patient.sex}</span>
        </div>

        <ul className={styles.chips}>
          {patient.tests.map((t: PatientTest) => {
            const isLab = t.department === 'lab';
            const status = STATUS[t.status] ?? STATUS.pending;
            const StatusIcon = status.Icon;
            return (
              <li key={t.testId} className={cx(styles.chip, status.chip)}>
                <span aria-hidden="true">
                  {isLab ? <RiTestTubeLine size={12} /> : <RiRadarLine size={12} />}
                </span>
                <span className="sr-only">{isLab ? 'Lab' : 'Radiology'}</span>{' '}
                <span className={styles.chipName}>{t.testName}</span>
                <span className={styles.chipStatus}>
                  <StatusIcon size={12} aria-hidden="true" />
                  {status.label}
                </span>
              </li>
            );
          })}
        </ul>

        <div className={styles.footnote}>
          Registered: {new Date(patient.registeredAt).toLocaleString('en-NG')}
          {patient.referredBy && ` • Ref: ${patient.referredBy}`}
          {completedCount > 0 && (
            <span className={styles.done}> • {completedCount}/{patient.tests.length} completed</span>
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <Button intent="secondary" size="sm" icon={<RiPrinterLine size={14} />} onClick={onViewSlip}>
          Slip
        </Button>
        {mode === 'results' && (
          <Button intent="primary" size="sm" icon={<RiFileTextLine size={14} />} onClick={onViewResult}>
            View &amp; Print Result
          </Button>
        )}
      </div>
    </div>
  );
}
