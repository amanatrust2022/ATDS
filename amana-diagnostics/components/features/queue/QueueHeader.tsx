import React from 'react';
import { RiTestTubeLine, RiRadarLine } from '@remixicon/react';
import { useQueueStore } from '@/lib/store/useQueueStore';

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '0.55rem 0.75rem',
  border: `1px solid ${hasError ? 'var(--red)' : 'var(--gray-300)'}`,
  borderRadius: 'var(--radius)', fontSize: '0.82rem',
  color: 'var(--gray-900)', background: 'white', outline: 'none',
  fontFamily: 'var(--font-body)',
});

export const QueueHeader: React.FC<{ isResultsTab?: boolean }> = ({ isResultsTab }) => {
  const { searchQuery, setSearchQuery, dateFilter, setDateFilter, deptFilter, setDeptFilter } = useQueueStore();

  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search by name or slip number..."
        style={{ ...inputStyle(false), flex: 1, maxWidth: 300 }}
      />

      {/* Date Range Filters */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--gray-200)', padding: '0.2rem', borderRadius: 'var(--radius)' }}>
        {[
          { id: 'today', label: 'Today' },
          { id: 'seven_days', label: 'Last 7 Days' },
          { id: 'thirty_days', label: 'Last 30 Days' }
        ].map(f => (
          <button key={f.id} onClick={() => setDateFilter(f.id as any)} style={{
            padding: '0.4rem 0.85rem', border: 'none',
            borderRadius: 'calc(var(--radius) - 1px)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            background: dateFilter === f.id ? 'white' : 'transparent',
            color: dateFilter === f.id ? 'var(--teal-800)' : 'var(--gray-600)',
            boxShadow: dateFilter === f.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s'
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {!isResultsTab && (
        <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
          {['all', 'lab', 'radiology'].map(d => (
            <button key={d} onClick={() => setDeptFilter(d as any)} style={{
              padding: '0.45rem 0.9rem', border: '1px solid var(--gray-300)',
              borderRadius: 0, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              background: deptFilter === d ? 'var(--teal-700)' : 'white',
              color: deptFilter === d ? 'white' : 'var(--gray-600)',
            }}>
              {d === 'all' ? 'All' : d === 'lab' ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiTestTubeLine size={14} /> Lab</span> : <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiRadarLine size={14} /> Radiology</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
