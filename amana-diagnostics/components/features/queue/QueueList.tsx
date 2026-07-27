import React from 'react';
import { RiMailOpenLine, RiFolderOpenLine } from '@remixicon/react';
import { PatientCard } from './PatientCard';
import { Patient } from '@/lib/store';

interface QueueListProps {
  patients: Patient[];
  mode: 'queue' | 'results';
  onViewSlip: (p: Patient) => void;
  onViewResult: (p: Patient) => void;
}

export const QueueList: React.FC<QueueListProps> = ({ patients, mode, onViewSlip, onViewResult }) => {
  if (patients.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--gray-400)' }}>
          {mode === 'results' ? <RiMailOpenLine size={64} /> : <RiFolderOpenLine size={64} />}
        </div>
        <p style={{ fontWeight: 600 }}>{mode === 'results' ? 'No results available yet' : 'No patients in queue'}</p>
        <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
          {mode === 'results' ? 'Results will appear here when departments complete tests.' : 'Register a patient to get started.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {patients.map(p => (
        <PatientCard
          key={p.id}
          patient={p}
          mode={mode}
          onViewSlip={() => onViewSlip(p)}
          onViewResult={() => onViewResult(p)}
        />
      ))}
    </div>
  );
};
