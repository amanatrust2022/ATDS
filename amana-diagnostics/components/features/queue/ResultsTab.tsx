import React, { useMemo } from 'react';
import { QueueHeader } from './QueueHeader';
import { QueueList } from './QueueList';
import { Patient, PatientTest } from '@/lib/store';
import { useQueueStore, filterPatientsByDate, filterPatientsBySearchAndDept } from '@/lib/store/useQueueStore';

interface ResultsTabProps {
  patients: Patient[];
  onViewSlip: (p: Patient) => void;
  onViewResult: (p: Patient) => void;
}

export const ResultsTab: React.FC<ResultsTabProps> = ({ patients, onViewSlip, onViewResult }) => {
  const { searchQuery, dateFilter, deptFilter } = useQueueStore();

  const resultsPatients = useMemo(() => {
    return patients.filter(p => p.tests.length > 0 && p.tests.every((t: PatientTest) => t.status === 'completed'));
  }, [patients]);

  const filtered = useMemo(() => {
    let result = resultsPatients;
    result = filterPatientsByDate(result, dateFilter);
    result = filterPatientsBySearchAndDept(result, searchQuery, deptFilter);
    return result;
  }, [resultsPatients, searchQuery, dateFilter, deptFilter]);

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
