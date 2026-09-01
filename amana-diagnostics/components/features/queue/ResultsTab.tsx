import React, { useMemo } from 'react';
import { QueueHeader } from './QueueHeader';
import { QueueList } from './QueueList';
import { Patient } from '@/lib/store';
import { useQueueStore, selectCompletedPatients, filterPatientsBySearchAndDept } from '@/lib/store/useQueueStore';

interface ResultsTabProps {
  patients: Patient[];
  onViewSlip: (p: Patient) => void;
  onViewResult: (p: Patient) => void;
}

export const ResultsTab: React.FC<ResultsTabProps> = ({ patients, onViewSlip, onViewResult }) => {
  const { searchQuery, dateFilter, deptFilter } = useQueueStore();

  // Same selector the "Results Ready" tab badge counts, so the two cannot drift.
  const filtered = useMemo(() => {
    const completed = selectCompletedPatients(patients, dateFilter);
    return filterPatientsBySearchAndDept(completed, searchQuery, deptFilter);
  }, [patients, searchQuery, dateFilter, deptFilter]);

  return (
    <div>
      <QueueHeader isResultsTab={true} />
      <QueueList
        patients={filtered}
        mode="results"
        onViewSlip={onViewSlip}
        onViewResult={onViewResult}
      />
    </div>
  );
};
