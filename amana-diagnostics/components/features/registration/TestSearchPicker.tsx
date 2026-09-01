import React from 'react';
import { RiErrorWarningLine } from '@remixicon/react';
import { Test } from '@/lib/store';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { inputStyle } from './styles';

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
      <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div>
          <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.2rem' }}>Search Tests</h3>
          <p style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>Type to find a test, then click it to add it to the selected list.</p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by test name, specimen, or department..."
          style={inputStyle(false)}
        />
        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredTests.length === 0 ? (
            <div style={{ padding: '0.9rem', border: '1px dashed var(--gray-300)', color: 'var(--gray-500)', fontSize: '0.75rem' }}>
              No tests match your search.
            </div>
          ) : (
            filteredTests.map(test => {
              const isSelected = selectedTests.includes(test.id);
              return (
                <button
                  key={test.id}
                  type="button"
                  onClick={() => toggleTest(test.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.7rem 0.8rem',
                    borderRadius: 0,
                    border: `1px solid ${isSelected ? (test.department === 'lab' ? 'var(--teal-200)' : '#c4b5fd') : 'var(--gray-200)'}`,
                    background: isSelected ? (test.department === 'lab' ? 'var(--teal-50)' : '#f5f3ff') : 'white',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-900)' }}>{test.name}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>{test.category} • {test.specimen}</span>
                  </span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: test.department === 'lab' ? 'var(--teal-700)' : '#7c3aed' }}>
                    {isSelected ? 'Selected' : 'Add'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
      {error && (
        <div style={{ color: 'var(--red)', fontSize: '0.75rem', background: 'var(--red-light)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid #f5c6cb', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <RiErrorWarningLine size={14} /> {error}
        </div>
      )}
    </>
  );
}
