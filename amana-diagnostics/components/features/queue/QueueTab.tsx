import React, { useMemo } from 'react';
import { QueueHeader } from './QueueHeader';
import { QueueList } from './QueueList';
import { Patient, PatientTest } from '@/lib/store';
import { useQueueStore, filterPatientsByDate, filterPatientsBySearchAndDept } from '@/lib/store/useQueueStore';

interface QueueTabProps {
  patients: Patient[];
  onViewSlip: (p: Patient) => void;
  onViewResult: (p: Patient) => void;
}

export const QueueTab: React.FC<QueueTabProps> = ({ patients, onViewSlip, onViewResult }) => {
  const { searchQuery, dateFilter, deptFilter } = useQueueStore();

  const pendingPatients = useMemo(() => {
    return patients.filter(p => p.tests.length > 0 && p.tests.some((t: PatientTest) => t.status === 'in_progress'));
  }, [patients]);

  const filtered = useMemo(() => {
    let result = pendingPatients;
    result = filterPatientsByDate(result, dateFilter);
    result = filterPatientsBySearchAndDept(result, searchQuery, deptFilter);
    return result;
  }, [pendingPatients, searchQuery, dateFilter, deptFilter]);

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
