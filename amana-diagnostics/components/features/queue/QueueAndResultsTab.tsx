import React from 'react';
import { RiMailOpenLine, RiFolderOpenLine } from '@remixicon/react';
import { useQueueStore, filterPatientsByDate, filterPatientsBySearchAndDept } from '@/lib/store/useQueueStore';
import { Patient } from '@/lib/store';
import PatientSearchFilters from './PatientSearchFilters';
import PatientCard from './PatientCard';

interface QueueAndResultsTabProps {
  patients: Patient[];
  mode: 'queue' | 'results';
  onViewSlip: (p: Patient) => void;
  onViewResult: (p: Patient) => void;
}

export default function QueueAndResultsTab({ patients, mode, onViewSlip, onViewResult }: QueueAndResultsTabProps) {
  const { searchQuery, deptFilter, dateFilter } = useQueueStore();

  // 1. Filter by status (queue = pending tests, results = completed tests)
  let basePatients = [];
  if (mode === 'queue') {
    basePatients = patients.filter(p => p.tests.some(t => t.status !== 'completed'));
  } else {
    basePatients = patients.filter(p => p.tests.some(t => t.status === 'completed'));
  }

  // 2. Filter by Date
  const dateFiltered = filterPatientsByDate(basePatients, dateFilter);

  // 3. Filter by Search and Dept
  const finalPatients = filterPatientsBySearchAndDept(dateFiltered, searchQuery, mode === 'queue' ? deptFilter : 'all');

  return (
    <div>
      <PatientSearchFilters />

      {finalPatients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--gray-400)' }}>
            {mode === 'results' ? <RiMailOpenLine size={64} /> : <RiFolderOpenLine size={64} />}
          </div>
          <p style={{ fontWeight: 600 }}>{mode === 'results' ? 'No results available yet' : 'No patients in queue'}</p>
          <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
            {mode === 'results' ? 'Results will appear here when departments complete tests.' : 'Register a patient to get started.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {finalPatients.map(p => (
            <PatientCard
              key={p.id}
              patient={p}
              mode={mode}
              onViewSlip={() => onViewSlip(p)}
              onViewResult={() => onViewResult(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
