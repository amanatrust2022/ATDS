'use client';
import { RiTestTubeLine, RiRadarLine, RiCheckLine, RiMoreLine, RiTimeLine } from '@remixicon/react';
import type { Department, Patient, PatientTest } from '@/lib/store';
import type { DepartmentTheme } from './theme';

interface Props {
  department: Department;
  /** Patients with at least one unfinished test in this department. */
  pending: Patient[];
  /** Patients with a test finished today in this department. */
  completedToday: Patient[];
  /** Counts only tests still `pending`, so it excludes ones already picked up. */
  pendingCount: number;
  loading: boolean;
  onOpenTest: (patient: Patient, test: PatientTest) => void;
  theme: DepartmentTheme;
}

const fullName = (p: Patient) =>
  p.name || [p.firstName, p.middleName, p.surname].filter(Boolean).join(' ');

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function DepartmentQueue({
  department, pending, completedToday, pendingCount, loading, onOpenTest, theme,
}: Props) {
  const isLab = department === 'lab';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--gray-900)' }}>
          Pending {isLab ? 'Lab' : 'Radiology'} Requests
        </h2>
        <span style={{ background: theme.light, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 0, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700 }}>
          {pendingCount} pending
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)' }}>Loading queue...</div>
      ) : pending.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)' }}>
          <div style={{ marginBottom: '1rem', color: 'var(--gray-300)' }}>{isLab ? <RiTestTubeLine size={56} /> : <RiRadarLine size={56} />}</div>
          <p style={{ fontWeight: 600 }}>No pending requests</p>
          <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>New patient tests will appear here automatically.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {pending.map(patient => (
            <div key={patient.id} style={{ background: 'white', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', background: theme.light, color: theme.text, padding: '0.15rem 0.5rem', borderRadius: 0, fontWeight: 700 }}>{patient.slipNumber}</span>
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{fullName(patient)}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{patient.age} • {patient.sex}</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <RiTimeLine size={12} /> {timeAgo(patient.registeredAt)}
                </span>
              </div>
              <div style={{ padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {patient.tests.filter(t => t.department === department && t.status !== 'completed').map(test => (
                  <div key={test.testId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', background: test.status === 'in_progress' ? 'var(--amber-light)' : theme.light, border: `1px solid ${test.status === 'in_progress' ? '#f0c97a' : theme.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: test.status === 'in_progress' ? 'var(--amber)' : 'var(--gray-400)' }} />
                      <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{test.testName}</span>
                      {test.status === 'in_progress' && <span style={{ fontSize: '0.68rem', background: 'var(--amber)', color: 'white', padding: '0.1rem 0.5rem', borderRadius: 0, fontWeight: 700 }}>In Progress</span>}
                    </div>
                    <button onClick={() => onOpenTest(patient, test)} style={{ background: theme.accent, color: 'white', border: 'none', borderRadius: 0, padding: '0.35rem 0.9rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                      {test.status === 'in_progress' ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}><RiMoreLine size={12} /> Continue</span> : 'Enter Results →'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {completedToday.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Completed Today ({completedToday.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {completedToday.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', background: 'var(--green-light)', border: '1px solid #a7d7c5', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}>
                <RiCheckLine size={14} color="var(--green)" />
                <span style={{ fontWeight: 700, color: 'var(--gray-800)' }}>{fullName(p)}</span>
                <span style={{ color: 'var(--gray-500)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{p.slipNumber}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--green)', fontWeight: 600 }}>
                  {p.tests.filter(t => t.department === department && t.status === 'completed').map(t => t.testName).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
