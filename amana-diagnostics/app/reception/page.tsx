'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  RiHospitalLine, RiAddLine, RiClipboardLine, RiCheckLine, RiErrorWarningLine,
  RiTestTubeLine, RiRadarLine, RiMailOpenLine, RiFolderOpenLine, RiPrinterLine,
  RiFileTextLine, RiMoreLine, RiCloseLine, RiArrowUpSLine, RiArrowDownSLine
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
    phone: '', address: '', referredBy: '', referringFacility: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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
      const slipNumber = await generateSlipNumber();
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

      await addPatient(patientData, tests);
      
      // For local modal display only
      const tempPatient: Patient = { 
        id: 'temp', 
        tests: tests as any, 
        ...patientData 
      };
      
      setShowSlipModal(tempPatient);
      setForm({ firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', address: '', referredBy: '', referringFacility: '' });
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
        subtitle="Amana Trust Diagnostics & Clinical Services Ltd"
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
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-800)' }}>{profile?.full_name}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--teal-600)', fontWeight: 600, textTransform: 'uppercase' }}>{profile?.role}</div>
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
                <Field label="Phone Number *" error={errors.phone}>
                  <input style={inputStyle(!!errors.phone)} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+234 803 000 0000" />
                </Field>
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
                  <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '10px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>AMANA TRUST DIAGNOSTICS</div>
                    <div style={{ fontSize: '10px' }}>AND CLINICAL SERVICES LTD</div>
                    <div style={{ fontSize: '9px', marginTop: '2px' }}>No 15, C Tudun Wada Bus Stop</div>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '10px' }}>INVESTIGATION SLIP</div>
                  <div style={{ marginBottom: '10px', lineHeight: '1.4' }}>
                    <div>ID: <span style={{ float: 'right' }}>ATD/2026.../0001</span></div>
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
                  <div style={{ marginTop: '15px', borderTop: '1px dashed #000', paddingTop: '8px', textAlign: 'center', fontSize: '9px', color: '#666' }}>
                    Please proceed to respective dept...<br/>
                    Amana Trust &copy; 2026
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
        <SlipModal patient={showSlipModal} onClose={() => { setShowSlipModal(null); setTab('queue'); }} />
      )}

      {/* Result Modal */}
      {showResultModal && (
        <ResultModal patient={showResultModal} onClose={() => setShowResultModal(null)} />
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
function SlipModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const labTests = patient.tests.filter(t => t.department === 'lab');
  const radioTests = patient.tests.filter(t => t.department === 'radiology');
  const regDate = new Date(patient.registeredAt);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(getSlipTemplate(patient));
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
  };

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalBox, maxWidth: 520 }}>
        <div style={{ background: 'var(--teal-800)', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700 }}>Investigation Request Slip</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: '0.2rem' }}>Patient registered successfully</p>
          </div>
          <button onClick={onClose} style={closeBtn}><RiCloseLine size={16} /></button>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <div style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-200)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', marginBottom: '1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--teal-600)', fontWeight: 600, marginBottom: '0.2rem' }}>SLIP NUMBER</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--teal-800)', letterSpacing: '0.05em' }}>{patient.slipNumber}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
            {[
              ['Patient', patient.name],
              ['Age / Sex', `${patient.age} / ${patient.sex}`],
              ['Phone', patient.phone || '—'],
              ['Referred By', patient.referredBy || 'Self'],
            ].map(([l, v]) => (
              <div key={l} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 0, padding: '0.5rem 0.75rem' }}>
                <p style={{ fontSize: '0.65rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase' }}>{l}</p>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--gray-800)' }}>{v}</p>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Tests Ordered ({patient.tests.length})</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {patient.tests.map(t => (
                <div key={t.testId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.4rem 0.75rem', borderRadius: 0,
                  background: t.department === 'lab' ? 'var(--teal-50)' : '#f5f3ff',
                  border: `1px solid ${t.department === 'lab' ? 'var(--teal-200)' : '#c4b5fd'}`,
                  fontSize: '0.78rem',
                }}>
                  <span style={{ fontWeight: 500 }}>{t.testName}</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: t.department === 'lab' ? 'var(--teal-700)' : '#5b21b6' }}>
                    {t.department === 'lab' ? <><RiTestTubeLine size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Lab</> : <><RiRadarLine size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Radiology</>}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--green-light)', border: '1px solid #a7d7c5', borderRadius: 0, padding: '0.6rem 0.75rem', marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--green)' }}>
            <RiCheckLine size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} /> Department notification sent automatically on print/close
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handlePrint} style={{ ...btnStyle('primary'), flex: 1, justifyContent: 'center' }}><RiPrinterLine size={14} /> Print Slip</button>
            <button onClick={onClose} style={{ ...btnStyle('outline'), flex: 1, justifyContent: 'center' }}>Close & Notify</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Result Modal ---- */
function ResultModal({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const completedTests = patient.tests.filter(t => t.status === 'completed');

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(getResultTemplate(patient, completedTests));
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 500);
  };

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalBox, maxWidth: 680 }}>
        <div style={{ background: 'var(--teal-800)', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700 }}>Result Report</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: '0.2rem' }}>{patient.slipNumber} • {patient.name}</p>
          </div>
          <button onClick={onClose} style={closeBtn}><RiCloseLine size={16} /></button>
        </div>
        <div style={{ padding: '1.25rem', maxHeight: '60vh', overflowY: 'auto' }}>
          {completedTests.map(t => (
            <div key={t.testId} style={{ marginBottom: '1.25rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--teal-800)', padding: '0.6rem 1rem', color: 'white', fontSize: '0.82rem', fontWeight: 700 }}>
                {t.testName}
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
          ))}
        </div>
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--gray-300)', display: 'flex', gap: '0.75rem' }}>
          <button onClick={handlePrint} style={{ ...btnStyle('primary'), flex: 1, justifyContent: 'center' }}><RiPrinterLine size={14} /> Print Official Report</button>
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
