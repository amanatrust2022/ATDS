import React from 'react';
import { RiCheckLine, RiAddLine } from '@remixicon/react';
import { Test } from '@/lib/store';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { Alert, Badge, Field, Input } from '@/components/ui';

import styles from './testSearchPicker.module.css';

interface TestSearchPickerProps {
  catalogue: Test[];
  search: string;
  setSearch: (q: string) => void;
  error?: string;
}

/** Returns catalogue entries matching a free-text query across name, specimen, department and category. */
export const filterCatalogue = (catalogue: Test[], search: string): Test[] => {
  const q = search.trim().toLowerCase();
  if (!q) return catalogue;
  return catalogue.filter(test =>
    [test.name, test.specimen, test.department, test.category].join(' ').toLowerCase().includes(q)
  );
};

export default function TestSearchPicker({ catalogue, search, setSearch, error }: TestSearchPickerProps) {
  const { selectedTests, addTest, removeTest } = useRegistrationStore();
  const filteredTests = filterCatalogue(catalogue, search);

  const toggleTest = (id: string) => {
    if (selectedTests.includes(id)) {
      removeTest(id);
    } else {
      addTest(id);
    }
  };

  return (
    <>
      <div className={styles.panel}>
        <Field
          label="Search tests"
          hint="Type to find a test, then click it to add it to the selected list."
        >
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by test name, specimen, or department..."
          />
        </Field>

        <div className={styles.list}>
          {filteredTests.length === 0 ? (
            <div className={styles.empty}>No tests match your search.</div>
          ) : (
            filteredTests.map(test => {
              const isSelected = selectedTests.includes(test.id);
              const isLab = test.department === 'lab';
              return (
                <button
                  key={test.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggleTest(test.id)}
                  className={`${styles.row} ${isSelected ? styles.rowChosen : ''}`}
                >
                  <span className={styles.rowMain}>
                    <span className={styles.rowName}>{test.name}</span>
                    <span className={styles.rowMeta}>
                      <Badge tone={isLab ? 'accent' : 'info'}>{isLab ? 'Lab' : 'Radiology'}</Badge>
                      <span>{test.category} • {test.specimen}</span>
                    </span>
                  </span>
                  <span className={styles.action}>
                    {isSelected
                      ? <RiCheckLine size={14} aria-hidden="true" />
                      : <RiAddLine size={14} aria-hidden="true" />}
                    {isSelected ? 'Selected' : 'Add'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {error && (
        <Alert tone="critical" live>
          {error}
        </Alert>
      )}
    </>
  );
}
