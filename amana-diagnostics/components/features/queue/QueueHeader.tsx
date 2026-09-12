import React from 'react';
import { RiTestTubeLine, RiRadarLine, RiSearchLine } from '@remixicon/react';
import { useQueueStore } from '@/lib/store/useQueueStore';
import { Field, Input, SegmentedControl } from '@/components/ui';

import styles from './queueHeader.module.css';

type DateFilter = 'today' | 'seven_days' | 'thirty_days';
type DeptFilter = 'all' | 'lab' | 'radiology';

const DATE_WINDOWS: { value: DateFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'seven_days', label: 'Last 7 Days' },
  { value: 'thirty_days', label: 'Last 30 Days' },
];

const DEPARTMENTS: { value: DeptFilter; label: string; icon?: React.ReactNode }[] = [
  { value: 'all', label: 'All' },
  { value: 'lab', label: 'Lab', icon: <RiTestTubeLine size={14} /> },
  { value: 'radiology', label: 'Radiology', icon: <RiRadarLine size={14} /> },
];

export const QueueHeader: React.FC<{ isResultsTab?: boolean }> = ({ isResultsTab }) => {
  const { searchQuery, setSearchQuery, dateFilter, setDateFilter, deptFilter, setDeptFilter } = useQueueStore();

  return (
    <div className={styles.bar}>
      <div className={styles.search}>
        <Field label="Search the queue" labelHidden>
          <Input
            type="search"
            prefix={<RiSearchLine size={14} />}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or slip number..."
          />
        </Field>
      </div>

      <SegmentedControl
        ariaLabel="Date range"
        value={dateFilter as DateFilter}
        onValueChange={setDateFilter}
        options={DATE_WINDOWS}
      />

      {!isResultsTab && (
        <div className={styles.departments}>
          <SegmentedControl
            ariaLabel="Department"
            value={deptFilter as DeptFilter}
            onValueChange={setDeptFilter}
            options={DEPARTMENTS}
          />
        </div>
      )}
    </div>
  );
};
