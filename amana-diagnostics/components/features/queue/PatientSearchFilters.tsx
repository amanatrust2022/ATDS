import React from 'react';
import { RiSearchLine } from '@remixicon/react';
import { useQueueStore } from '@/lib/store/useQueueStore';

const inputStyle = {
  padding: '0.65rem 1rem', borderRadius: 'var(--radius)',
  border: '1px solid var(--gray-300)',
  fontSize: '0.82rem', fontFamily: 'var(--font-sans)', outline: 'none'
};

const filterBtnStyle = (active: boolean) => ({
  padding: '0.65rem 1rem', background: active ? 'var(--teal-700)' : 'white',
  color: active ? 'white' : 'var(--gray-600)',
  border: active ? '1px solid var(--teal-700)' : '1px solid var(--gray-300)',
  borderRadius: 'var(--radius)', fontSize: '0.82rem', cursor: 'pointer', fontWeight: 600,
  transition: 'all 0.15s'
});

export default function PatientSearchFilters() {
  const { searchQuery, setSearchQuery, deptFilter, setDeptFilter, dateFilter, setDateFilter } = useQueueStore();

  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search by name or slip number..."
        style={{ ...inputStyle, flex: 1, maxWidth: 300 }}
      />

      <select
        value={deptFilter}
        onChange={e => setDeptFilter(e.target.value as any)}
        style={{ ...inputStyle, width: 'auto' }}
      >
        <option value="all">All Departments</option>
        <option value="lab">Laboratory</option>
        <option value="radiology">Radiology</option>
      </select>

      <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
        <button
          onClick={() => setDateFilter('today')}
          style={filterBtnStyle(dateFilter === 'today')}
        >
          Today
        </button>
        <button
          onClick={() => setDateFilter('seven_days')}
          style={filterBtnStyle(dateFilter === 'seven_days')}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => setDateFilter('thirty_days')}
          style={filterBtnStyle(dateFilter === 'thirty_days')}
        >
          Last 30 Days
        </button>
      </div>
    </div>
  );
}
