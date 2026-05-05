'use client';
import { useState, useEffect, useCallback } from 'react';
import Header from './Header';
import { Department, Patient, PatientTest, getTestById, fetchPatients, updateTestResult, subscribeToPatients } from '@/lib/store';
import { RiTestTubeLine, RiRadarLine, RiCheckLine, RiMoreLine, RiLogoutCircleLine } from '@remixicon/react';
import { useAuth } from '@/components/AuthProvider';

interface Props { department: Department; }

type ViewMode = 'queue' | 'entry';

export default function DepartmentPage({ department }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<{ patient: Patient; test: PatientTest } | null>(null);
  const [results, setResults] = useState<{ parameter: string; result: string; unit: string; range: string; flag: string }[]>([]);
  const [professional, setProfessional] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isLab = department === 'lab';
  const accentColor = isLab ? 'var(--teal-600)' : '#7c3aed';
  const lightColor = isLab ? 'var(--teal-50)' : '#f5f3ff';
  const borderColor = isLab ? 'var(--teal-200)' : '#c4b5fd';
  const textColor = isLab ? 'var(--teal-800)' : '#5b21b6';

  const { profile, signOut } = useAuth();
  const refresh = useCallback(async () => {
    const data = await fetchPatients();
    setPatients(data);
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribeToPatients(refresh);
    return () => { unsubscribe(); };
  }, [refresh]);

  const deptPatients = patients.filter(p =>
    p.tests.some(t => t.department === department && t.status !== 'completed')
  );

  const pendingCount = deptPatients.reduce((n, p) =>
    n + p.tests.filter(t => t.department === department && t.status === 'pending').length, 0
  );

  const openEntry = async (patient: Patient, test: PatientTest) => {
    const testDef = getTestById(test.testId);
    const initResults = (testDef?.parameters || []).map(p => ({
      parameter: p.name, result: '', unit: p.unit, range: p.range, flag: '',
    }));
    setResults(initResults);
    setNotes('');
    setSelected({ patient, test });

    // Mark as in_progress in DB
    if (test.status === 'pending') {
      try {
        await updateTestResult(test.id!, { status: 'in_progress' });
      } catch (err) {
        console.error('Failed to update status:', err);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selected) return;
    if (!professional.trim()) { alert('Please enter your name / staff ID'); return; }
    setSaving(true);
    
    try {
      await updateTestResult(selected.test.id!, {
        status: 'completed',
        results,
        completedBy: professional,
        completedAt: new Date().toISOString(),
        notes,
      });
      setSuccessMsg(`Result for "${selected.test.testName}" sent to reception!`);
      setSelected(null);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      alert('Failed to save result: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateResult = (i: number, field: string, value: string) => {
    setResults(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)', display: 'flex', flexDirection: 'column' }}>
      <Header
        title={isLab ? 'Laboratory' : 'Radiology'}
        subtitle="Amana Trust Diagnostics & Clinical Services Ltd"
        icon={isLab ? <RiTestTubeLine size={24} color="white" /> : <RiRadarLine size={24} color="white" />}
        accentColor={accentColor}
        notifications={pendingCount}
      />

      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-300)', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ padding: '0.9rem 0', fontSize: '0.82rem', fontWeight: 600, color: 'var(--gray-500)' }}>
          Active Session: <span style={{ color: textColor }}>{isLab ? 'Lab' : 'Radio'} Department</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-800)' }}>{profile?.full_name}</div>
            <div style={{ fontSize: '0.65rem', color: textColor, fontWeight: 600, textTransform: 'uppercase' }}>{profile?.role}</div>
          </div>
          <button 
            onClick={() => signOut()}
            style={{ background: 'var(--gray-100)', border: '1px solid var(--gray-300)', padding: '0.4rem', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--gray-600)' }}
            title="Sign Out"
          >
            <RiLogoutCircleLine size={18} />
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{
          background: 'var(--green)', color: 'white', padding: '0.75rem 1.5rem',
          fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <RiCheckLine size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} /> {successMsg}
        </div>
      )}

      <div style={{ flex: 1, padding: '1.5rem', maxWidth: 900, margin: '0 auto', width: '100%' }}>

        {/* Result Entry Panel */}
        {selected && (
          <div style={{
            background: 'white', borderRadius: 'var(--radius-lg)',
            border: `1px solid ${borderColor}`, marginBottom: '1.5rem',
            overflow: 'hidden', animation: 'fadeIn 0.2s ease',
          }}>
            <div style={{ background: accentColor, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
                  Entering Results: {selected.test.testName}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', marginTop: '0.15rem' }}>
                  Patient: {selected.patient.name} &nbsp;•&nbsp; {selected.patient.slipNumber} &nbsp;•&nbsp; Specimen: <b>{selected.test.specimen || 'Not Specified'}</b>
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: 0, padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
              >
                Cancel
              </button>
            </div>

            <div style={{ padding: '1.25rem' }}>
              {/* Professional name */}
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Professional Name / Staff ID *
                  </label>
                  <input
                    value={professional}
                    onChange={e => setProfessional(e.target.value)}
                    placeholder={isLab ? 'e.g. MLS ABDULLAHI SHEHU' : 'e.g. Dr. Fatima Abdullahi (Radiologist)'}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '0.82rem', fontFamily: 'var(--font-body)' }}
                  />
                </div>
                <div style={{ width: 200 }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Specimen (Fixed)
                  </label>
                  <div style={{ padding: '0.55rem 0.75rem', border: '1px solid var(--gray-200)', background: 'var(--gray-50)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--gray-600)', fontWeight: 600 }}>
                    {selected.test.specimen || '—'}
                  </div>
                </div>
              </div>

              {/* Results table */}
              <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: lightColor }}>
                      {['Parameter', 'Result', 'Unit', 'Reference Range', 'Flag'].map(h => (
                        <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700, color: textColor, borderBottom: `1px solid ${borderColor}`, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                        <td style={{ padding: '0.45rem 0.75rem', fontWeight: 500 }}>{r.parameter}</td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>
                          <input
                            value={r.result}
                            onChange={e => updateResult(i, 'result', e.target.value)}
                            placeholder="Enter result"
                            style={{
                              padding: '0.35rem 0.6rem', border: '1px solid var(--gray-300)',
                              borderRadius: 0, fontSize: '0.8rem', width: '100%', minWidth: 120,
                              background: r.flag === 'H' ? '#fdf2f2' : r.flag === 'L' ? '#eff6ff' : 'white',
                              fontFamily: 'var(--font-body)',
                            }}
                          />
                        </td>
                        <td style={{ padding: '0.45rem 0.75rem', color: 'var(--gray-500)' }}>{r.unit || '—'}</td>
                        <td style={{ padding: '0.45rem 0.75rem', color: 'var(--gray-500)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{r.range || '—'}</td>
                        <td style={{ padding: '0.3rem 0.5rem' }}>
                          <select
                            value={r.flag}
                            onChange={e => updateResult(i, 'flag', e.target.value)}
                            style={{
                              padding: '0.35rem 0.5rem', borderRadius: 0, fontSize: '0.8rem',
                              border: '1px solid var(--gray-300)',
                              background: r.flag === 'H' ? '#fdf2f2' : r.flag === 'L' ? '#eff6ff' : 'white',
                              color: r.flag === 'H' ? 'var(--red)' : r.flag === 'L' ? '#1a6aaf' : 'var(--gray-500)',
                              fontWeight: r.flag ? 700 : 400,
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            <option value="">Normal</option>
                            <option value="H">H (High)</option>
                            <option value="L">L (Low)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                  Comments / Remarks (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional clinical comments, quality notes, or interpretation..."
                  style={{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '0.82rem', resize: 'vertical', fontFamily: 'var(--font-body)' }}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  background: accentColor, color: 'white', border: 'none',
                  borderRadius: 'var(--radius)', padding: '0.75rem 2rem',
                  fontSize: '0.88rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1, transition: 'all 0.15s',
                }}
              >
                {saving ? 'Sending...' : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}><RiCheckLine size={16} /> Submit & Send to Reception</span>}
              </button>
            </div>
          </div>
        )}

        {/* Patient Queue */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, color: 'var(--gray-900)' }}>
              {isLab ? <RiTestTubeLine size={18} style={{ display: 'inline', verticalAlign: 'middle' }} /> : <RiRadarLine size={18} style={{ display: 'inline', verticalAlign: 'middle' }} />} Pending {isLab ? 'Laboratory' : 'Radiology'} Requests
            </h2>
            <span style={{
              background: lightColor, color: textColor, border: `1px solid ${borderColor}`,
              borderRadius: 0, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700,
            }}>
              {pendingCount} pending
            </span>
          </div>

          {deptPatients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--gray-500)', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--gray-400)' }}>{isLab ? <RiTestTubeLine size={64} /> : <RiRadarLine size={64} />}</div>
              <p style={{ fontWeight: 600 }}>No pending requests</p>
              <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>New patient tests will appear here automatically.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {deptPatients.map(patient => (
                <div key={patient.id} style={{
                  background: 'white', border: '1px solid var(--gray-300)',
                  borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                  animation: 'fadeIn 0.3s ease',
                }}>
                  {/* Patient header */}
                  <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', background: lightColor, color: textColor, padding: '0.15rem 0.5rem', borderRadius: 0, fontWeight: 700 }}>
                      {patient.slipNumber}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{patient.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{patient.age} • {patient.sex}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginLeft: 'auto' }}>
                      {new Date(patient.registeredAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {/* Tests */}
                  <div style={{ padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {patient.tests.filter(t => t.department === department && t.status !== 'completed').map(test => (
                      <div key={test.testId} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)',
                        background: test.status === 'in_progress' ? 'var(--amber-light)' : lightColor,
                        border: `1px solid ${test.status === 'in_progress' ? '#f0c97a' : borderColor}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                            background: test.status === 'in_progress' ? 'var(--amber)' : 'var(--gray-400)',
                          }} />
                          <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{test.testName}</span>
                          {test.status === 'in_progress' && (
                            <span style={{ fontSize: '0.68rem', background: 'var(--amber)', color: 'white', padding: '0.1rem 0.5rem', borderRadius: 0, fontWeight: 700 }}>In Progress</span>
                          )}
                        </div>
                        <button
                          onClick={() => openEntry(patient, test)}
                          style={{
                            background: accentColor, color: 'white', border: 'none',
                            borderRadius: 0, padding: '0.35rem 0.9rem',
                            fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {test.status === 'in_progress' ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}><RiMoreLine size={12} /> Continue</span> : 'Enter Results →'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
