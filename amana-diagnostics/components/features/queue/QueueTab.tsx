import React, { useMemo } from 'react';
import { QueueHeader } from './QueueHeader';
import { QueueList } from './QueueList';
import { Patient } from '@/lib/store';
import { useQueueStore, selectPendingPatients, filterPatientsBySearchAndDept } from '@/lib/store/useQueueStore';

interface QueueTabProps {
  patients: Patient[];
  onViewSlip: (p: Patient) => void;
  onViewResult: (p: Patient) => void;
}

export const QueueTab: React.FC<QueueTabProps> = ({ patients, onViewSlip, onViewResult }) => {
  const { searchQuery, dateFilter, deptFilter } = useQueueStore();

  // Same selector the "Patient Queue" tab badge counts, so the two cannot drift.
  const filtered = useMemo(() => {
    const pending = selectPendingPatients(patients, dateFilter);
    return filterPatientsBySearchAndDept(pending, searchQuery, deptFilter);
  }, [patients, searchQuery, dateFilter, deptFilter]);

  return (
    <div>
      <QueueHeader isResultsTab={false} />
      <QueueList
        patients={filtered}
        mode="queue"
        onViewSlip={onViewSlip}
        onViewResult={onViewResult}
      />
    </div>
  );
};
