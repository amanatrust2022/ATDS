'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  RiHospitalLine, RiAddLine, RiClipboardLine, RiCheckLine, RiErrorWarningLine,
  RiTestTubeLine, RiRadarLine, RiMailOpenLine, RiFolderOpenLine, RiPrinterLine,
  RiFileTextLine, RiMoreLine, RiCloseLine, RiArrowUpSLine, RiArrowDownSLine
} from '@remixicon/react';
import Header from '@/components/Header';
import {
  Patient, PatientTest, TEST_CATALOGUE, getPatients, addPatient,
  generateSlipNumber, getTestById
} from '@/lib/store';

type Tab = 'register' | 'queue' | 'results';

export default function ReceptionPage() {
  const [tab, setTab] = useState<Tab>('register');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [showSlipModal, setShowSlipModal] = useState<Patient | null>(null);
  const [showResultModal, setShowResultModal] = useState<Patient | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [deptFilter, setDeptFilter] = useState<'all' | 'lab' | 'radiology'>('all');
  const [form, setForm] = useState({
    name: '', age: '', sex: 'Male' as 'Male' | 'Female',
    phone: '', address: '', referredBy: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(() => setPatients(getPatients()), []);

  useEffect(() => {
    refresh();
    window.addEventListener('amana_update', refresh);
    const interval = setInterval(refresh, 3000);
    return () => { window.removeEventListener('amana_update', refresh); clearInterval(interval); };
  }, [refresh]);

  const labTests = TEST_CATALOGUE.filter(t => t.department === 'lab');
  const radioTests = TEST_CATALOGUE.filter(t => t.department === 'radiology');

  const pendingPatients = patients.filter(p => p.tests.some(t => t.status !== 'completed'));
  const resultsPatients = patients.filter(p => p.tests.some(t => t.status === 'completed'));
  const newResultsCount = patients.filter(p => p.tests.some(t => t.status === 'completed')).length;

  const toggleTest = (id: string) => {
    setSelectedTests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Patient name is required';
    if (!form.age.trim()) e.age = 'Age is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    if (selectedTests.length === 0) e.tests = 'Select at least one test';
    return e;
  };

  const handleRegister = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    const tests: PatientTest[] = selectedTests.map(tid => {
      const t = getTestById(tid)!;
      return { testId: t.id, testName: t.name, department: t.department, status: 'pending' };
    });
    const patient: Patient = {
      id: Date.now().toString(),
      slipNumber: generateSlipNumber(),
      registeredAt: new Date().toISOString(),
      ...form,
      tests,
    };
    addPatient(patient);
    setSaving(false);
    setShowSlipModal(patient);
    setForm({ name: '', age: '', sex: 'Male', phone: '', address: '', referredBy: '' });
    setSelectedTests([]);
    setErrors({});
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
      </div>

      <div style={{ flex: 1, padding: '1.5rem', maxWidth: 1100, margin: '0 auto', width: '100%' }}>

        {/* ===== REGISTER TAB ===== */}
        {tab === 'register' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem' }}>

            {/* Patient Form */}
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)', overflow: 'hidden' }}>
              <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem' }}>
                <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600 }}>Patient Information</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: '0.2rem' }}>Enter patient biodata</p>
              </div>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <Field label="Full Name *" error={errors.name}>
                  <input style={inputStyle(!!errors.name)} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Musa Ibrahim Bello" />
                </Field>
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
                <Field label="Referred By">
                  <input style={inputStyle(false)} value={form.referredBy} onChange={e => setForm({ ...form, referredBy: e.target.value })} placeholder="Referring doctor / self" />
                </Field>
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
              <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                <TestGroup label={<span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiTestTubeLine size={16} /> Laboratory Tests</span>} tests={labTests} selected={selectedTests} onToggle={toggleTest} />
                <TestGroup label={<span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiRadarLine size={16} /> Radiology Tests</span>} tests={radioTests} selected={selectedTests} onToggle={toggleTest} />
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
    const testRows = patient.tests.map(t => `
      <tr>
        <td>${t.testName}</td>
        <td style="text-align:center">${t.department === 'lab' ? 'Laboratory' : 'Radiology'}</td>
      </tr>`).join('');
    win.document.write(`
      <!DOCTYPE html><html><head><title>Patient Slip - \${patient.slipNumber}</title>
      <style>
        body { font-family: Times New Roman, sans-serif; margin: 0; padding: 20px; font-size: 11pt; color: #000; min-width: 750px; }
        .header { text-align: center; border-bottom: 2px solid #4472c4; padding-bottom: 12px; margin-bottom: 16px; margin-left: 0; margin-right: 0; padding-left: 0; padding-right: 0; }
        .org-name-1 { font-size: 40pt; white-space: nowrap; color: #0563c1; margin: 0; padding: 0; line-height: 1; }
        .org-name-2 { font-size: 26pt; white-space: nowrap; color: #0563c1; margin: 0; padding: 0; line-height: 1; }
        .org-addr { font-size: 14pt; color: #222a35; margin: 0; padding: 0; line-height: 1; }
        .org-contact { font-size: 14pt; color: #c00000; margin: 0; padding: 0; line-height: 1; }
        .org-email { font-size: 14pt; margin: 0; padding: 0; line-height: 1; padding-bottom: 12px; }
        .slip-title { font-size: 14pt; font-weight: bold; text-align: center; margin: 12px 0 16px; text-decoration: underline; text-transform: uppercase; }
        .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; font-size: 12pt; border: 1px solid #4472c4; padding: 12px; }
        .pi-label { font-weight: bold; margin-right: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #4472c4; color: white; padding: 6px 8px; text-align: left; font-size: 11pt; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11pt; }
        .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 9pt; color: #888; text-align: center; border-color: #4472c4; }
      </style></head><body>
      <div class="header">
        <div class="org-name-1">AMANA TRUST DIAGNOSTICS</div>
        <div class="org-name-2">AND CLINICAL SERVICES LIMITED</div>
        <div class="org-addr">No 15, C Tudun Wada Bus Stop, Nasarawa LGA, Kano State.</div>
        <div class="org-contact"><b>Phone;</b> +2348033390574, +2347032663898</div>
        <div class="org-email"><b>Email;</b> <span style="color:#0563c1">amanatrust2022@gmail.com</span></div>
      </div>
      <div class="slip-title">PATIENT INVESTIGATION REQUEST SLIP</div>
      <div class="patient-info">
        <div><span class="pi-label">Patient Name;</span> \${patient.name}</div>
        <div><span class="pi-label">Patient ID;</span> \${patient.slipNumber}</div>
        <div><span class="pi-label">Age;</span> \${patient.age}</div>
        <div><span class="pi-label">Sex;</span> \${patient.sex}</div>
        <div><span class="pi-label">Requested Date;</span> \${regDate.toLocaleDateString('en-NG')}</div>
        <div><span class="pi-label">Reporting Date;</span> —</div>
      </div>
      <div class="patient-info" style="grid-template-columns: 1fr;">
        <div><span class="pi-label">Investigation(s);</span> \${patient.tests.length} tests</div>
        <div><span class="pi-label">Specimen;</span> —</div>
      </div>
      <table><thead><tr><th>Test Name</th><th>Department</th></tr></thead><tbody>\${testRows}</tbody></table>
      <div class="footer">Please proceed to the respective department with this slip &bull; Amana Trust Diagnostics &copy; \${new Date().getFullYear()}</div>
      </body></html>\`);
    win.document.close();
    win.print();
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

    const testSections = completedTests.map(t => {
      const rows = (t.results || []).map(r => `
        <tr>
          <td>${r.parameter}</td>
          <td style="font-weight:bold; color:${r.flag === 'H' ? '#c0392b' : r.flag === 'L' ? '#1a6aaf' : '#000'}">
            ${r.result}${r.flag ? ` (${r.flag})` : ''}
          </td>
          <td>${r.unit || '—'}</td>
          <td>${r.range || '—'}</td>
        </tr>`).join('');
      return `
        <div class="test-block">
          <div class="test-header">${t.testName}</div>
          ${t.results && t.results.length > 0 ? `
          <table>
            <thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference Range</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>` : ''}
          ${t.notes ? `<div class="notes"><b>Comment:</b> ${t.notes}</div>` : ''}
          <div class="completed-by">
            Analysed by: <b>${t.completedBy || '—'}</b> &nbsp;|&nbsp; Date: <b>${t.completedAt ? new Date(t.completedAt).toLocaleString('en-NG') : '—'}</b>
          </div>
        </div>`;
    }).join('');

    win.document.write(`
      <!DOCTYPE html><html><head><title>Result - \${patient.slipNumber}</title>
      <style>
        body { font-family: Times New Roman, sans-serif; margin: 0; padding: 20px; font-size: 11pt; color: #000; min-width: 750px; }
        @page { margin-top: 4mm; }
        @media screen {
          body { max-width: 860px; margin: 0 auto; padding: 32px 40px; background: #f0f2f5; }
          html { background: #f0f2f5; }
        }
        @media print {
          body { margin: 0; padding: 10px 20px 20px; background: white; max-width: none; }
        }
        .header { text-align: center; border-bottom: 2px solid #4472c4; padding-bottom: 0; margin-bottom: 0; margin-left: 0; margin-right: 0; padding-left: 0; padding-right: 0; }
        .org-name-1 { font-size: 40pt; white-space: nowrap; color: #0563c1; margin: 0; padding: 0; line-height: 1; }
        .org-name-2 { font-size: 26pt; white-space: nowrap; color: #0563c1; margin: 0; padding: 0; line-height: 1; }
        .org-addr { font-size: 14pt; color: #222a35; margin: 0; padding: 0; line-height: 1; }
        .org-contact { font-size: 14pt; color: #c00000; margin: 0; padding: 0; line-height: 1; }
        .org-email { font-size: 14pt; margin: 0; padding: 0; line-height: 1; padding-bottom: 5px; }
        .report-title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin: 2.5px 0 10px; color: #4472c4; text-decoration: underline; }
        .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; font-size: 12pt; border: 1px solid #4472c4; padding: 12px; }
        .pi-label { font-weight: bold; margin-right: 8px; }
        .test-block { margin-bottom: 18px; border: 1px solid #ddd; }
        .test-header { background: #4472c4; color: white; padding: 7px 12px; font-size: 11pt; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #4472c4; color: white; padding: 6px 8px; text-align: left; font-size: 11pt; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11pt; }
        .notes { padding: 6px 12px; font-size: 10pt; background: #fffbe6; border-top: 1px solid #eee; font-style: italic; }
        .sig-section { margin-top: 24px; display: flex; justify-content: flex-end; }
        .sig-box { text-align: center; width: 200px; }
        .sig-line { border-top: 1px solid #333; padding-top: 4px; font-size: 10pt; color: #333; }
      </style></head><body>
      <div class="header">
        <div class="org-name-1">AMANA TRUST DIAGNOSTICS</div>
        <div class="org-name-2">AND CLINICAL SERVICES LIMITED</div>
        <div class="org-addr">No 15, C Tudun Wada Bus Stop, Nasarawa LGA, Kano State.</div>
        <div class="org-contact"><b>Phone;</b> +2348033390574, +2347032663898</div>
        <div class="org-email"><b>Email;</b> <span style="color:#0563c1">amanatrust2022@gmail.com</span></div>
      </div>
      <div class="report-title">
        \${completedTests.every(t => t.department === 'lab') ? 'LABORATORY RESULT REPORT' : 
          completedTests.every(t => t.department === 'radiology') ? 'RADIOLOGY RESULT REPORT' : 
          'LABORATORY / RADIOLOGY RESULT REPORT'}
      </div>
      <div class="patient-info">
        <div><span class="pi-label">Patient Name;</span> \${patient.name}</div>
        <div><span class="pi-label">Patient ID;</span> \${patient.slipNumber}</div>
        <div>
          <span style="margin-right: 30px;"><span class="pi-label">Age;</span> \${patient.age}</span>
          <span><span class="pi-label">Requested Date;</span> \${new Date(patient.registeredAt).toLocaleDateString('en-NG')}</span>
        </div>
        <div>
          <span style="margin-right: 30px;"><span class="pi-label">Sex;</span> \${patient.sex}</span>
          <span><span class="pi-label">Reporting Date;</span> \${completedTests[0]?.completedAt ? new Date(completedTests[0].completedAt).toLocaleDateString('en-NG') : '—'}</span>
        </div>
        <div><span class="pi-label">Investigation(s);</span> \${completedTests.map(t => t.testName).join(', ')}</div>
        <div><span class="pi-label">Specimen;</span> \${completedTests[0]?.specimen || '—'}</div>
      </div>
      \${testSections}
      <div class="sig-section">
        <div class="sig-box">
          <div style="height:60px;"></div>
          <div class="sig-line">\${completedTests[0]?.completedBy || 'Authorised Professional'}</div>
          <div style="font-size:9pt; color:#333; margin-top:2px; font-weight:bold;">Signature & Stamp</div>
        </div>
      </div>
      <div style="text-align:center; margin-top:20px; font-weight:bold; text-transform:uppercase; font-size:10pt; color:#000;">
        *** END OF REPORT ***
      </div>
      </body></html>\`);
    win.document.close();
    win.print();
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
