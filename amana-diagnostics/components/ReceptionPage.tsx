'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  RiHospitalLine, RiAddLine, RiClipboardLine, RiCheckLine, RiErrorWarningLine,
  RiTestTubeLine, RiRadarLine, RiMailOpenLine, RiFolderOpenLine, RiPrinterLine,
  RiFileTextLine, RiMoreLine, RiCloseLine, RiArrowUpSLine, RiArrowDownSLine, RiMailLine
} from '@remixicon/react';
import Header from '@/components/Header';
import {
  Patient, PatientTest, TEST_CATALOGUE, getTestById, fetchPatients, addPatient, generateSlipNumber, subscribeToPatients
} from '@/lib/store';
import { getResultTemplate, getSlipTemplate } from '@/lib/templates';
import { useAuth } from '@/components/AuthProvider';
import { RiLogoutCircleLine } from '@remixicon/react';

type Tab = 'register' | 'queue' | 'results';

export default function ReceptionPage() {
  const [tab, setTab] = useState<Tab>('register');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [showSlipModal, setShowSlipModal] = useState<Patient | null>(null);
  const [showResultModal, setShowResultModal] = useState<Patient | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [deptFilter, setDeptFilter] = useState<'all' | 'lab' | 'radiology'>('all');
  const [testSearch, setTestSearch] = useState('');
  const [form, setForm] = useState({
    firstName: '', surname: '', middleName: '', age: '', sex: 'Male' as 'Male' | 'Female',
    phone: '', email: '', address: '', referredBy: '', referringFacility: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { profile, organization, signOut } = useAuth();
  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    const data = await fetchPatients(organization.id);
    setPatients(data);
  }, [organization?.id]);

  useEffect(() => {
    if (!organization?.id) return;
    refresh();
    const unsubscribe = subscribeToPatients(organization.id, refresh);
    return () => { unsubscribe(); };
  }, [organization?.id, refresh]);

  const categories = Array.from(new Set(TEST_CATALOGUE.map(t => t.category)));
  const testsByCategory = (cat: string) => TEST_CATALOGUE.filter(t => t.category === cat && t.name.toLowerCase().includes(testSearch.toLowerCase()));
  const filteredCategories = categories.filter(cat => testsByCategory(cat).length > 0);

  const pendingPatients = patients.filter(p => p.tests.some(t => t.status !== 'completed'));
  const resultsPatients = patients.filter(p => p.tests.some(t => t.status === 'completed'));
  const newResultsCount = patients.filter(p => p.tests.some(t => t.status === 'completed')).length;

  const toggleTest = (id: string) => {
    setSelectedTests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.surname.trim()) e.surname = 'Surname is required';
    if (!form.age.trim()) e.age = 'Age is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    if (selectedTests.length === 0) e.tests = 'Select at least one test';
    return e;
  };

  const handleRegister = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    
    try {
      const slipNumber = await generateSlipNumber(organization?.id || '');
      const tests: Omit<PatientTest, 'id' | 'patient_id'>[] = selectedTests.map(tid => {
        const t = getTestById(tid)!;
        return { testId: t.id, testName: t.name, department: t.department, status: 'pending', specimen: t.specimen };
      });
      
      const patientData: Omit<Patient, 'id' | 'tests'> = {
        slipNumber,
        registeredAt: new Date().toISOString(),
        name: [form.firstName, form.middleName, form.surname].filter(Boolean).join(' '),
        ...form,
      };

      await addPatient(patientData, tests, organization?.id || '');
      
      // For local modal display only
      const tempPatient: Patient = { 
        id: 'temp', 
        tests: tests as any, 
        ...patientData 
      };
      
      setShowSlipModal(tempPatient);
      setForm({ firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', email: '', address: '', referredBy: '', referringFacility: '' });
      setSelectedTests([]);
      setErrors({});
    } catch (err: any) {
      alert('Registration failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = (tab === 'queue' ? pendingPatients : resultsPatients).filter(p => {
    const q = searchQ.toLowerCase();
    const nameMatch = p.name.toLowerCase().includes(q) || p.slipNumber.toLowerCase().includes(q);
    if (deptFilter === 'all') return nameMatch;
    return nameMatch && p.tests.some(t => t.department === deptFilter);
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)', display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Reception"
        subtitle={organization?.name || 'Amana Trust Diagnostics'}
        icon={<RiHospitalLine size={24} color="white" />}
        accentColor="var(--teal-600)"
        notifications={newResultsCount}
      />

      {/* Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-300)', padding: '0 1.5rem', display: 'flex', gap: 0 }}>
        {[
          { id: 'register', label: 'Register Patient', icon: <RiAddLine size={18} /> },
          { id: 'queue', label: `Patient Queue (${pendingPatients.length})`, icon: <RiClipboardLine size={18} /> },
          { id: 'results', label: `Results Ready (${newResultsCount})`, icon: <RiCheckLine size={18} />, badge: newResultsCount },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            style={{
              padding: '0.9rem 1.25rem',
              border: 'none', background: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600,
              color: tab === t.id ? 'var(--teal-700)' : 'var(--gray-500)',
              borderBottom: tab === t.id ? '2px solid var(--teal-600)' : '2px solid transparent',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              position: 'relative',
            }}
          >
            {t.icon} {t.label}
            {t.badge && t.badge > 0 && (
              <span style={{
                background: 'var(--red)', color: 'white', borderRadius: 0,
                padding: '0 5px', fontSize: '0.65rem', fontWeight: 700, lineHeight: '16px',
              }}>{t.badge}</span>
            )}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* User profile & signout moved to universal Header dropdown */}
        </div>
      </div>

      <div style={{ flex: 1, padding: '1.5rem', maxWidth: 1400, margin: '0 auto', width: '100%' }}>

        {/* ===== REGISTER TAB ===== */}
        {tab === 'register' && (
          <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

            {/* Patient Form */}
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem' }}>
                <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600 }}>Patient Information</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: '0.2rem' }}>Enter patient biodata</p>
              </div>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <Field label="First Name *" error={errors.firstName}>
                    <input style={inputStyle(!!errors.firstName)} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="e.g. Musa" />
                  </Field>
                  <Field label="Middle Name" error={errors.middleName}>
                    <input style={inputStyle(!!errors.middleName)} value={form.middleName} onChange={e => setForm({ ...form, middleName: e.target.value })} placeholder="e.g. Ibrahim" />
                  </Field>
                  <Field label="Surname *" error={errors.surname}>
                    <input style={inputStyle(!!errors.surname)} value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} placeholder="e.g. Bello" />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Field label="Age *" error={errors.age}>
                    <input style={inputStyle(!!errors.age)} value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} placeholder="e.g. 35yrs" />
                  </Field>
                  <Field label="Sex">
                    <select style={inputStyle(false)} value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value as 'Male' | 'Female' })}>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Field label="Phone Number *" error={errors.phone}>
                    <input style={inputStyle(!!errors.phone)} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+234 803 000 0000" />
                  </Field>
                  <Field label="Patient Email (for results)">
                    <input style={inputStyle(false)} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="patient@example.com" />
                  </Field>
                </div>
                <Field label="Address">
                  <input style={inputStyle(false)} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Patient address" />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <Field label="Referred By">
                    <input style={inputStyle(false)} value={form.referredBy} onChange={e => setForm({ ...form, referredBy: e.target.value })} placeholder="Referring doctor / self" />
                  </Field>
                  <Field label="Referring Facility">
                    <input style={inputStyle(false)} value={form.referringFacility} onChange={e => setForm({ ...form, referringFacility: e.target.value })} placeholder="Hospital / Clinic" />
                  </Field>
                </div>
                {errors.tests && <div style={{ color: 'var(--red)', fontSize: '0.75rem', background: 'var(--red-light)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid #f5c6cb', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiErrorWarningLine size={14} /> {errors.tests}</div>}
                <button
                  onClick={handleRegister}
                  disabled={saving}
                  style={{
                    background: 'var(--teal-700)', color: 'white', border: 'none',
                    borderRadius: 'var(--radius)', padding: '0.75rem',
                    fontSize: '0.88rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                    marginTop: '0.5rem', letterSpacing: '0.02em',
                    opacity: saving ? 0.7 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {saving ? 'Registering...' : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}><RiCheckLine size={16} /> Register & Generate Slip</span>}
                </button>
              </div>
            </div>

            {/* Test Selection */}
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600 }}>Select Tests</h2>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                      {selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                  {selectedTests.length > 0 && (
                    <button onClick={() => setSelectedTests([])} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: 0, padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}>
                      Clear all
                    </button>
                  )}
                </div>
                <input 
                  value={testSearch} 
                  onChange={e => setTestSearch(e.target.value)} 
                  placeholder="Search tests..." 
                  style={{ ...inputStyle(false), padding: '0.4rem 0.6rem', fontSize: '0.75rem', background: 'white' }} 
                />
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                {filteredCategories.map(cat => (
                  <TestGroup 
                    key={cat} 
                    label={
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {cat === 'Radiology' ? <RiRadarLine size={16} /> : <RiTestTubeLine size={16} />} 
                        {cat}
                      </span>
                    } 
                    tests={testsByCategory(cat)} 
                    selected={selectedTests} 
                    onToggle={toggleTest} 
                  />
                ))}
              </div>
              {selectedTests.length > 0 && (
                <div style={{ borderTop: '1px solid var(--gray-300)', padding: '0.75rem 1rem', background: 'var(--teal-50)' }}>
                  <p style={{ fontSize: '0.72rem', color: 'var(--teal-700)', fontWeight: 600, marginBottom: '0.4rem' }}>Selected:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {selectedTests.map(tid => {
                      const t = getTestById(tid);
                      return t ? (
                        <span key={tid} style={{
                          background: t.department === 'lab' ? 'var(--teal-100)' : '#ede9fe',
                          color: t.department === 'lab' ? 'var(--teal-800)' : '#5b21b6',
                          border: `1px solid ${t.department === 'lab' ? 'var(--teal-200)' : '#c4b5fd'}`,
                          borderRadius: 0, padding: '0.15rem 0.6rem', fontSize: '0.7rem', fontWeight: 500,
                        }}>
                          {t.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Preview Block */}
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'sticky', top: '1.5rem' }}>
              <div style={{ background: 'var(--teal-900)', padding: '1rem 1.25rem' }}>
                <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600 }}>Live Preview</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: '0.2rem' }}>Slip as it will appear</p>
              </div>
              <div style={{ padding: '1.5rem', flex: 1, background: '#f8fafc', overflowY: 'auto', maxHeight: '75vh' }}>
                <div style={{ 
                  background: 'white', 
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', 
                  padding: '1.5rem', 
                  width: '300px', 
                  margin: '0 auto',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#000',
                  border: '1px solid var(--gray-200)'
                }}>
                  {/* ── Org Header ── */}
                  <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '10px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{(organization?.name || 'YOUR FACILITY').toUpperCase()}</div>
                    {organization?.letterhead_line2 && <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{organization.letterhead_line2.toUpperCase()}</div>}
                    {organization?.address && <div style={{ fontSize: '9px', marginTop: '2px' }}>{organization.address}</div>}
                    {organization?.phone && <div style={{ fontSize: '9px' }}>{organization.phone}</div>}
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '10px' }}>INVESTIGATION SLIP</div>
                  <div style={{ marginBottom: '10px', lineHeight: '1.4' }}>
                    <div>ID: <span style={{ float: 'right' }}>—/—/—</span></div>
                    <div>NAME: <span style={{ float: 'right', fontWeight: 'bold' }}>{(form.firstName || form.surname) ? `${form.firstName} ${form.middleName} ${form.surname}`.trim() : '—'}</span></div>
                    <div>AGE/SEX: <span style={{ float: 'right' }}>{form.age || '—'} / {form.sex}</span></div>
                    <div>DATE: <span style={{ float: 'right' }}>{new Date().toLocaleDateString('en-NG')}</span></div>
                  </div>
                  <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '5px' }}>TESTS ORDERED ({selectedTests.length})</div>
                  <div style={{ minHeight: '50px' }}>
                    {selectedTests.length === 0 ? (
                      <div style={{ color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: '10px' }}>No tests selected</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {selectedTests.map(tid => {
                            const t = getTestById(tid);
                            return t ? (
                              <tr key={tid} style={{ borderBottom: '1px dashed #eee' }}>
                                <td style={{ padding: '2px 0' }}>{t.name} <span style={{ fontSize: '9px', color: '#666' }}>({t.specimen})</span></td>
                                <td style={{ textAlign: 'right', padding: '2px 0' }}>{t.department === 'lab' ? 'Lab' : 'Radio'}</td>
                              </tr>
                            ) : null;
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {/* ── Footer ── */}
                  <div style={{ marginTop: '15px', borderTop: '1px dashed #000', paddingTop: '8px', textAlign: 'center', fontSize: '9px', color: '#666' }}>
                    Please proceed to respective department with this slip<br/>
                    {(organization?.name || 'Your Facility')} &copy; {new Date().getFullYear()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== QUEUE TAB ===== */}
        {(tab === 'queue' || tab === 'results') && (
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search by name or slip number..."
                style={{ ...inputStyle(false), flex: 1, maxWidth: 300 }}
              />
              {tab === 'queue' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
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
        )}
      </div>

      {/* Slip Modal */}
      {showSlipModal && (
        <SlipModal patient={showSlipModal} org={organization} onClose={() => { setShowSlipModal(null); setTab('queue'); }} />
      )}

      {/* Result Modal */}
      {showResultModal && (
        <ResultModal patient={showResultModal} org={organization} onClose={() => setShowResultModal(null)} />
      )}
    </div>
  );
}

/* ---- Field wrapper ---- */
function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.3rem' }}>{label}</label>
      {children}
      {error && <p style={{ color: 'var(--red)', fontSize: '0.7rem', marginTop: '0.2rem' }}>{error}</p>}
    </div>
  );
}

/* ---- Test group ---- */
function TestGroup({ label, tests, selected, onToggle }: any) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', background: 'var(--gray-100)', border: 'none', cursor: 'pointer',
        padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', textAlign: 'left',
        fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.4rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {label} <span style={{ display: 'flex' }}>{open ? <RiArrowUpSLine size={16} /> : <RiArrowDownSLine size={16} />}</span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '0.25rem' }}>
          {tests.map((t: any) => (
            <label key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.45rem 0.6rem', borderRadius: 0, cursor: 'pointer',
              background: selected.includes(t.id) ? (t.department === 'lab' ? 'var(--teal-50)' : '#f5f3ff') : 'transparent',
              border: `1px solid ${selected.includes(t.id) ? (t.department === 'lab' ? 'var(--teal-200)' : '#c4b5fd') : 'transparent'}`,
              transition: 'all 0.1s',
            }}>
              <input type="checkbox" checked={selected.includes(t.id)} onChange={() => onToggle(t.id)} style={{ accentColor: t.department === 'lab' ? 'var(--teal-600)' : '#7c3aed' }} />
              <span style={{ fontSize: '0.78rem', color: 'var(--gray-800)', fontWeight: selected.includes(t.id) ? 600 : 400 }}>{t.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Patient Card ---- */
function PatientCard({ patient, mode, onViewSlip, onViewResult }: any) {
  const labTests = patient.tests.filter((t: PatientTest) => t.department === 'lab');
  const radioTests = patient.tests.filter((t: PatientTest) => t.department === 'radiology');
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

/* ---- Slip Modal ---- */
function SlipModal({ patient, onClose, org }: { patient: Patient; onClose: () => void; org?: any }) {
  const regDate = new Date(patient.registeredAt).toLocaleDateString('en-NG');
  const specimens = Array.from(new Set(patient.tests.map((t: any) => t.specimen))).filter(Boolean).join(', ') || '—';

  const orgName = org?.name || 'AMANA TRUST DIAGNOSTICS';
  const orgLine2 = org?.letterhead_line2 || '';
  const orgAddress = org?.address || '';
  const orgPhone = org?.phone || '';

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(getSlipTemplate(patient, org));
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
  };

  // Shared styles for the preview widget
  const previewWrap: React.CSSProperties = {
    background: 'white', border: '1px solid var(--gray-300)', borderRadius: 6,
    padding: '12px 14px', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    fontSize: 12, color: '#000', maxWidth: 320, margin: '0 auto',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  };

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalBox, maxWidth: 520 }}>
        {/* Modal chrome header */}
        <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Investigation Request Slip</h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', marginTop: '0.15rem' }}>Live Preview — Slip as it will appear</p>
          </div>
          <button onClick={onClose} style={closeBtn}><RiCloseLine size={16} /></button>
        </div>

        {/* Live preview */}
        <div style={{ padding: '1.25rem', background: 'var(--gray-100)' }}>
          <div style={previewWrap}>

            {/* ── Org Header ── */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', lineHeight: 1.2, margin: 0 }}>{orgName.toUpperCase()}</div>
              {orgLine2 && <div style={{ fontSize: 11, fontWeight: 'bold', margin: '2px 0 4px' }}>{orgLine2.toUpperCase()}</div>}
              {orgAddress && <div style={{ fontSize: 10, margin: '2px 0' }}>{orgAddress}</div>}
              {orgPhone && <div style={{ fontSize: 10, margin: 0 }}>{orgPhone}</div>}
            </div>

            {/* ── Slip title ── */}
            <div style={{ fontSize: 14, fontWeight: 'bold', textAlign: 'center', margin: '8px 0 10px', borderBottom: '1px solid #000', paddingBottom: 4 }}>
              INVESTIGATION SLIP
            </div>

            {/* ── Patient info ── */}
            <div style={{ marginBottom: 10, fontSize: 12, lineHeight: 1.6 }}>
              {[
                ['ID', patient.slipNumber],
                ['Name', patient.name],
                ['Age / Sex', `${patient.age} / ${patient.sex}`],
                ['Date', regDate],
                ['Specimen(s)', specimens],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>{l}:</span>
                  <span style={{ textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* ── Tests ── */}
            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: 2, marginTop: 10, fontSize: 12 }}>
              TESTS ORDERED ({patient.tests.length})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #000', textAlign: 'left', padding: '3px 0', fontWeight: 700 }}>Test</th>
                  <th style={{ borderBottom: '1px solid #000', textAlign: 'right', padding: '3px 0', fontWeight: 700 }}>Dept</th>
                </tr>
              </thead>
              <tbody>
                {patient.tests.map((t: any) => (
                  <tr key={t.testId} style={{ borderBottom: '1px dashed #ccc' }}>
                    <td style={{ padding: '3px 0', fontSize: 11 }}>
                      {t.testName}
                      {t.specimen && <span style={{ fontSize: 9, color: '#666' }}> ({t.specimen})</span>}
                    </td>
                    <td style={{ padding: '3px 0', textAlign: 'right', fontSize: 11 }}>
                      {t.department === 'lab' ? 'Lab' : 'Radio'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Footer ── */}
            <div style={{ marginTop: 14, borderTop: '1px dashed #000', paddingTop: 8, fontSize: 10, textAlign: 'center', lineHeight: 1.5 }}>
              Please proceed to the respective department with this slip<br />
              {orgName} &copy; {new Date().getFullYear()}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: '0.75rem', background: 'white' }}>
          <button onClick={handlePrint} style={{ ...btnStyle('primary'), flex: 1, justifyContent: 'center' }}>
            <RiPrinterLine size={14} /> Print Slip
          </button>
          <button onClick={onClose} style={{ ...btnStyle('outline'), flex: 1, justifyContent: 'center' }}>
            Close &amp; Notify
          </button>
        </div>
      </div>
    </div>
  );
}


/* ---- Result Modal ---- */
function ResultModal({ patient, onClose, org }: { patient: Patient; onClose: () => void; org?: any }) {
  const completedTests = patient.tests.filter(t => t.status === 'completed');
  const [sendingEmail, setSendingEmail] = useState(false);
  // Selective print: all checked by default
  const [selectedIds, setSelectedIds] = useState<string[]>(completedTests.map(t => t.testId));

  const toggleTest = (testId: string) => {
    setSelectedIds(prev =>
      prev.includes(testId) ? prev.filter(id => id !== testId) : [...prev, testId]
    );
  };
  const toggleAll = () => {
    setSelectedIds(selectedIds.length === completedTests.length ? [] : completedTests.map(t => t.testId));
  };

  const handlePrint = () => {
    const testsToPrint = completedTests.filter(t => selectedIds.includes(t.testId));
    if (testsToPrint.length === 0) {
      alert('Please select at least one test to print.');
      return;
    }
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(getResultTemplate(patient, testsToPrint, org));
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 500);
  };

  const handleEmail = async () => {
    if (!patient.email) {
      alert('This patient does not have an email address recorded. Please update their details first.');
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch('/api/send-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient, completedTests, org }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send email');
      }

      alert(`Report successfully emailed to ${patient.email}!`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalBox, maxWidth: 700 }}>
        {/* Header */}
        <div style={{ background: 'var(--teal-800)', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700 }}>Result Report</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: '0.2rem' }}>{patient.slipNumber} • {patient.name}</p>
          </div>
          <button onClick={onClose} style={closeBtn}><RiCloseLine size={16} /></button>
        </div>

        {/* Test selector */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase' }}>
              Select tests to include in print
            </span>
            <button
              onClick={toggleAll}
              style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--teal-600)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {selectedIds.length === completedTests.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {completedTests.map(t => {
              const checked = selectedIds.includes(t.testId);
              return (
                <button
                  key={t.testId}
                  onClick={() => toggleTest(t.testId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.3rem 0.75rem', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: checked ? 'var(--teal-700)' : 'white',
                    color: checked ? 'white' : 'var(--gray-600)',
                    border: `1px solid ${checked ? 'var(--teal-700)' : 'var(--gray-300)'}`,
                  }}
                >
                  {checked ? <RiCheckLine size={12} /> : <span style={{ width: 12, height: 12, border: '1.5px solid var(--gray-400)', borderRadius: '50%', display: 'inline-block' }} />}
                  {t.testName}
                </button>
              );
            })}
          </div>
          {selectedIds.length > 0 && (
            <p style={{ fontSize: '0.7rem', color: 'var(--teal-700)', marginTop: '0.4rem', fontWeight: 600 }}>
              {selectedIds.length} of {completedTests.length} test{completedTests.length !== 1 ? 's' : ''} selected for printing
            </p>
          )}
        </div>

        {/* Results preview */}
        <div style={{ padding: '1.25rem', maxHeight: '45vh', overflowY: 'auto' }}>
          {completedTests.map(t => {
            const isSelected = selectedIds.includes(t.testId);
            return (
              <div key={t.testId} style={{
                marginBottom: '1.25rem', border: `1px solid ${isSelected ? 'var(--teal-300)' : 'var(--gray-200)'}`,
                borderRadius: 'var(--radius)', overflow: 'hidden', opacity: isSelected ? 1 : 0.45,
                transition: 'opacity 0.2s',
              }}>
                <div style={{ background: isSelected ? 'var(--teal-800)' : 'var(--gray-400)', padding: '0.6rem 1rem', color: 'white', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{t.testName}</span>
                  {!isSelected && <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>excluded from print</span>}
                </div>
                {t.results && t.results.length > 0 && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--teal-50)' }}>
                        {['Parameter', 'Result', 'Unit', 'Reference Range'].map(h => (
                          <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--teal-800)', fontWeight: 700, borderBottom: '1px solid var(--teal-200)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.results.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                          <td style={{ padding: '0.45rem 0.75rem' }}>{r.parameter}</td>
                          <td style={{ padding: '0.45rem 0.75rem', fontWeight: 700, color: r.flag === 'H' ? 'var(--red)' : r.flag === 'L' ? '#1a6aaf' : 'var(--gray-900)' }}>
                            {r.result}{r.flag ? ` (${r.flag})` : ''}
                          </td>
                          <td style={{ padding: '0.45rem 0.75rem', color: 'var(--gray-500)' }}>{r.unit || '—'}</td>
                          <td style={{ padding: '0.45rem 0.75rem', color: 'var(--gray-500)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{r.range || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {t.notes && <div style={{ padding: '0.5rem 0.75rem', background: '#fffbe6', fontSize: '0.75rem', fontStyle: 'italic', borderTop: '1px solid var(--gray-200)' }}><b>Comment:</b> {t.notes}</div>}
                <div style={{ padding: '0.45rem 0.75rem', background: 'var(--gray-50)', fontSize: '0.7rem', color: 'var(--gray-500)', borderTop: '1px solid var(--gray-200)' }}>
                  Analysed by: <b style={{ color: 'var(--gray-700)' }}>{t.completedBy || '—'}</b> • {t.completedAt ? new Date(t.completedAt).toLocaleString('en-NG') : '—'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--gray-300)', display: 'flex', gap: '0.75rem', background: 'var(--gray-50)' }}>
          <button
            onClick={handlePrint}
            disabled={selectedIds.length === 0}
            style={{ ...btnStyle('primary'), flex: 1, justifyContent: 'center', opacity: selectedIds.length === 0 ? 0.5 : 1, cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            <RiPrinterLine size={14} /> Print {selectedIds.length > 0 ? `${selectedIds.length} Test${selectedIds.length !== 1 ? 's' : ''}` : 'Report'}
          </button>
          <button onClick={handleEmail} disabled={sendingEmail} style={{ ...btnStyle('outline'), flex: 1, justifyContent: 'center', borderColor: 'var(--teal-600)', color: 'var(--teal-700)' }}>
            {sendingEmail ? 'Sending Email...' : <><RiMailLine size={14} /> Email Report to Patient</>}
          </button>
          <button onClick={onClose} style={btnStyle('outline')}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Shared styles ---- */
const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: '100%', padding: '0.55rem 0.75rem',
  border: `1px solid ${hasError ? 'var(--red)' : 'var(--gray-300)'}`,
  borderRadius: 'var(--radius)', fontSize: '0.82rem',
  color: 'var(--gray-900)', background: 'white', outline: 'none',
  fontFamily: 'var(--font-body)',
});

const btnStyle = (variant: 'primary' | 'outline'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
  padding: '0.5rem 1rem', borderRadius: 'var(--radius)',
  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
  border: variant === 'primary' ? 'none' : '1px solid var(--gray-300)',
  background: variant === 'primary' ? 'var(--teal-700)' : 'white',
  color: variant === 'primary' ? 'white' : 'var(--gray-700)',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
});

const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '1rem',
};

const modalBox: React.CSSProperties = {
  background: 'white', borderRadius: 'var(--radius-lg)',
  width: '100%', boxShadow: 'var(--shadow-lg)',
  overflow: 'hidden', animation: 'fadeIn 0.2s ease',
};

const closeBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)', border: 'none',
  color: 'white', cursor: 'pointer', borderRadius: 0,
  width: 30, height: 30, fontSize: '0.85rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
