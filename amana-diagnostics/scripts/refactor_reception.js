const fs = require('fs');
const path = require('path');

const recPath = path.join(__dirname, '../components/ReceptionPage.tsx');
let recContent = fs.readFileSync(recPath, 'utf8');

// 1. Add Imports
if (!recContent.includes("import { QueueTab } from './features/queue/QueueTab';")) {
  recContent = recContent.replace(
    "import React, { useState, useEffect, useCallback } from 'react';",
    "import React, { useState, useEffect, useCallback } from 'react';\nimport { QueueTab } from './features/queue/QueueTab';\nimport { ResultsTab } from './features/queue/ResultsTab';"
  );
}

// 2. Remove state from ReceptionPage that moved to useQueueStore
// Wait, we need to make sure we don't break anything. 
// Actually, let's just replace the JSX for now, and leave the state in ReceptionPage as unused variables to avoid breaking other things if they exist.
// Let's check if searchQ, dateFilter, deptFilter are used anywhere else.
// searchQ is used at line 867.
// `const filtered = (tab === 'queue' ? pendingPatients : resultsPatients).filter(p => { ... })`
// We need to remove the `filtered` logic and `pendingPatients` logic from ReceptionPage.tsx because it's now inside the components!

const jsxToReplace = `{/* ===== QUEUE TAB ===== */}
        {(tab === 'queue' || tab === 'results') && (
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
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

              {tab === 'queue' && (
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

            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--gray-400)' }}>{tab === 'results' ? <RiMailOpenLine size={64} /> : <RiFolderOpenLine size={64} />}</div>
                <p style={{ fontWeight: 600 }}>{tab === 'results' ? 'No results available yet' : 'No patients in queue'}</p>
                <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                  {tab === 'results' ? 'Results will appear here when departments complete tests.' : 'Register a patient to get started.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.map(p => (
                  <PatientCard
                    key={p.id} patient={p} mode={tab}
                    onViewSlip={() => setShowSlipModal(p)}
                    onViewResult={() => setShowResultModal(p)}
                  />
                ))}
              </div>
            )}
          </div>
        )}`;

const newJsx = `{/* ===== QUEUE TAB ===== */}
        {tab === 'queue' && (
          <QueueTab
            patients={patients}
            onViewSlip={(p) => setShowSlipModal(p)}
            onViewResult={(p) => setShowResultModal(p)}
          />
        )}
        
        {/* ===== RESULTS TAB ===== */}
        {tab === 'results' && (
          <ResultsTab
            patients={patients}
            onViewSlip={(p) => setShowSlipModal(p)}
            onViewResult={(p) => setShowResultModal(p)}
          />
        )}`;

// Clean up line endings just in case
const normalizedContent = recContent.replace(/\\r\\n/g, '\\n');
const normalizedTarget = jsxToReplace.replace(/\\r\\n/g, '\\n');

if (normalizedContent.includes(normalizedTarget)) {
  const result = normalizedContent.replace(normalizedTarget, newJsx);
  fs.writeFileSync(recPath, result, 'utf8');
  console.log('Successfully replaced Queue/Results JSX');
} else {
  console.log('ERROR: Could not find the JSX block to replace. Did the file change?');
}
