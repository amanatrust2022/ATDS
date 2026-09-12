import React from 'react';
import { RiMailOpenLine, RiFolderOpenLine } from '@remixicon/react';
import { PatientCard } from './PatientCard';
import { Patient } from '@/lib/store';
import { EmptyState } from '@/components/ui';

import styles from './queueList.module.css';

interface QueueListProps {
  patients: Patient[];
  mode: 'queue' | 'results';
  onViewSlip: (p: Patient) => void;
  onViewResult: (p: Patient) => void;
}

export const QueueList: React.FC<QueueListProps> = ({ patients, mode, onViewSlip, onViewResult }) => {
  const isResults = mode === 'results';

  if (patients.length === 0) {
    return (
      <EmptyState
        title={isResults ? 'No results available yet' : 'No patients in queue'}
        icon={isResults ? <RiMailOpenLine size={48} /> : <RiFolderOpenLine size={48} />}
      >
        {isResults
          ? 'Results will appear here when departments complete tests.'
          : 'Register a patient to get started.'}
      </EmptyState>
    );
  }

  return (
    <ul
      className={styles.list}
      aria-label={isResults ? 'Patients with a result ready' : 'Patients waiting in the queue'}
    >
      {patients.map(p => (
        <li key={p.id}>
          <PatientCard
            patient={p}
            mode={mode}
            onViewSlip={() => onViewSlip(p)}
            onViewResult={() => onViewResult(p)}
          />
        </li>
      ))}
    </ul>
  );
};
