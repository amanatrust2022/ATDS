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
  const { searchQuery, dateFilter } = useQueueStore();

  // Same selector the "Results Ready" tab badge counts, so the two cannot drift.
  //
  // Deliberately not the department filter. This tab does not show that control
  // — a report is a report, whichever bench produced it — but it was still
  // applying whatever the queue tab had been left set to. Someone who narrowed
  // the queue to Radiology and then came here to print a blood count was shown
  // an empty list, with no control on screen to explain it and nothing to
  // switch back. 'all', always, so the list matches what is visible above it.
  const filtered = useMemo(() => {
    const completed = selectCompletedPatients(patients, dateFilter);
    return filterPatientsBySearchAndDept(completed, searchQuery, 'all');
  }, [patients, searchQuery, dateFilter]);

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
