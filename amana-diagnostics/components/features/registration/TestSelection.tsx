import React from 'react';
import { RiCloseLine } from '@remixicon/react';
import { Test } from '@/lib/store';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { SelectedTestDetail } from '@/lib/store/registrationBilling';

interface TestSelectionProps {
  catalogue: Test[];
  selectedTestDetails: SelectedTestDetail[];
}

/** The sticky right-hand panel listing the tests chosen for this visit. */
export default function TestSelection({ catalogue, selectedTestDetails }: TestSelectionProps) {
  const { selectedTests, removeTest, clearTests } = useRegistrationStore();
  const getTestById = (id: string) => catalogue.find(t => t.id === id);

  return (
    <>
      <div style={{ background: 'linear-gradient(135deg, var(--teal-800), var(--teal-700))', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600 }}>Selected Tests</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
            {selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''} selected
          </p>
        </div>
        {selectedTests.length > 0 && (
          <button
            type="button"
            onClick={() => clearTests()}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: 0, padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}
          >
            Clear all
          </button>
        )}
      </div>
      <div style={{ padding: '1rem', background: 'linear-gradient(180deg, #effaf8 0%, #f8fbfb 100%)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 200 }}>
        {selectedTests.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', justifyContent: 'center' }}>
            <div style={{ border: '1px dashed var(--gray-300)', background: 'rgba(255,255,255,0.92)', padding: '1.5rem 1rem', color: 'var(--gray-500)', fontSize: '0.78rem', textAlign: 'center', borderRadius: 'var(--radius)' }}>
              No tests selected yet. Search and add tests from the patient information panel.
            </div>
            <button
              disabled
              style={{
                background: 'var(--gray-300)', color: 'var(--gray-500)', border: 'none',
                borderRadius: 'var(--radius)', padding: '0.75rem',
                fontSize: '0.82rem', fontWeight: 700, cursor: 'not-allowed',
                textAlign: 'center', width: '100%'
              }}
            >
              Select tests to proceed
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {selectedTests.map(tid => {
              const t = getTestById(tid);
              if (!t) return null;

              const priceDetail = selectedTestDetails.find(d => d.testId === tid);
              const price = priceDetail ? priceDetail.price : 0;

              return (
                <div key={tid} style={{ background: 'white', border: `1px solid ${t.department === 'lab' ? 'var(--teal-200)' : '#c4b5fd'}`, padding: '0.75rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', boxShadow: '0 10px 20px -18px rgba(15,23,42,0.45)' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-900)' }}>{t.name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)', marginTop: '0.15rem' }}>{t.category} • {t.specimen}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--teal-700)' }}>
                      ₦{price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTest(tid)}
                      aria-label={`Remove ${t.name}`}
                      style={{
                        border: '1px solid var(--gray-300)',
                        background: 'white',
                        color: 'var(--gray-600)',
                        cursor: 'pointer',
                        borderRadius: 0,
                        width: 30,
                        height: 30,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
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
