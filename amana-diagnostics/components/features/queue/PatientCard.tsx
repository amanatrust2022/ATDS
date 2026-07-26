import React from 'react';
import { RiTestTubeLine, RiRadarLine, RiCheckLine, RiMoreLine, RiPrinterLine, RiFileTextLine } from '@remixicon/react';
import { Patient, PatientTest } from '@/lib/store';

const btnStyle = (type: 'primary' | 'outline' = 'primary') => ({
  background: type === 'primary' ? 'var(--teal-700)' : 'white',
  color: type === 'primary' ? 'white' : 'var(--teal-700)',
  border: type === 'primary' ? 'none' : '1px solid var(--teal-600)',
  padding: '0.45rem 0.85rem',
  borderRadius: 'var(--radius)',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.25rem',
  transition: 'all 0.15s'
});

interface PatientCardProps {
  patient: Patient;
  mode: 'queue' | 'results' | 'wallet' | 'register';
  onViewSlip: () => void;
  onViewResult: () => void;
}

export default function PatientCard({ patient, mode, onViewSlip, onViewResult }: PatientCardProps) {
  const completedCount = patient.tests.filter((t: PatientTest) => t.status === 'completed').length;

  return (
    <div style={{
      background: 'white', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--gray-300)', padding: '1rem 1.25rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '1rem', animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
            background: 'var(--teal-100)', color: 'var(--teal-800)',
            padding: '0.15rem 0.5rem', borderRadius: 0, fontWeight: 600,
          }}>{patient.slipNumber}</span>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--gray-900)' }}>{patient.name}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{patient.age} • {patient.sex}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {patient.tests.map((t: PatientTest) => (
            <span key={t.testId} style={{
              fontSize: '0.68rem', fontWeight: 500, padding: '0.15rem 0.5rem', borderRadius: 0,
              background: t.status === 'completed' ? 'var(--green-light)' : t.status === 'in_progress' ? 'var(--amber-light)' : 'var(--gray-100)',
              color: t.status === 'completed' ? 'var(--green)' : t.status === 'in_progress' ? 'var(--amber)' : 'var(--gray-600)',
              border: `1px solid ${t.status === 'completed' ? '#a7d7c5' : t.status === 'in_progress' ? '#f0c97a' : 'var(--gray-300)'}`,
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>{t.department === 'lab' ? <RiTestTubeLine size={12} /> : <RiRadarLine size={12} />} {t.testName}</span>
              {t.status === 'completed' ? <RiCheckLine size={12} style={{ marginLeft: '0.1rem' }} /> : t.status === 'in_progress' ? <RiMoreLine size={12} style={{ marginLeft: '0.1rem' }} /> : ''}
            </span>
          ))}
        </div>
        <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--gray-500)' }}>
          Registered: {new Date(patient.registeredAt).toLocaleString('en-NG')}
          {patient.referredBy && ` • Ref: ${patient.referredBy}`}
          {completedCount > 0 && <span style={{ color: 'var(--green)', fontWeight: 600 }}> • {completedCount}/{patient.tests.length} completed</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button onClick={onViewSlip} style={btnStyle('outline')}><RiPrinterLine size={14} /> Slip</button>
        {mode === 'results' && (
          <button onClick={onViewResult} style={btnStyle('primary')}><RiFileTextLine size={14} /> View & Print Result</button>
        )}
      </div>
    </div>
  );
}
