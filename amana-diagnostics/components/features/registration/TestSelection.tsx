import React from 'react';
import { RiCloseLine } from '@remixicon/react';
import { Test } from '@/lib/store';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { SelectedTestDetail } from '@/lib/store/registrationBilling';
import { Badge, EmptyState } from '@/components/ui';

import styles from './testSelection.module.css';

interface TestSelectionProps {
  catalogue: Test[];
  selectedTestDetails: SelectedTestDetail[];
}

/** The sticky right-hand panel listing the tests chosen for this visit. */
export default function TestSelection({ catalogue, selectedTestDetails }: TestSelectionProps) {
  const { selectedTests, removeTest, clearTests } = useRegistrationStore();
  const getTestById = (id: string) => catalogue.find((t) => t.id === id);

  return (
    <>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Selected tests</h2>
          <p className={styles.count}>
            {selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''} selected
          </p>
        </div>
        {selectedTests.length > 0 && (
          <button type="button" className={styles.clear} onClick={() => clearTests()}>
            Clear all
          </button>
        )}
      </div>

      <div className={styles.body}>
        {selectedTests.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState title="No tests selected yet">
              Search and add tests from the patient information panel.
            </EmptyState>
          </div>
        ) : (
          <div className={styles.list}>
            {selectedTests.map((tid) => {
              const t = getTestById(tid);
              if (!t) return null;

              const priceDetail = selectedTestDetails.find((d) => d.testId === tid);
              const price = priceDetail ? priceDetail.price : 0;
              const isLab = t.department === 'lab';

              return (
                <div
                  key={tid}
                  className={`${styles.row} ${isLab ? styles.rowLab : styles.rowRadiology}`}
                >
                  <div className={styles.rowMain}>
                    <div className={styles.rowName}>{t.name}</div>
                    <div className={styles.rowMeta}>
                      <Badge tone={isLab ? 'accent' : 'info'}>{isLab ? 'Lab' : 'Radiology'}</Badge>
                      <span>{t.category} • {t.specimen}</span>
                    </div>
                  </div>
                  <div className={styles.rowSide}>
                    <span className={styles.price}>
                      ₦{price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => removeTest(tid)}
                      aria-label={`Remove ${t.name}`}
                    >
                      <RiCloseLine size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
