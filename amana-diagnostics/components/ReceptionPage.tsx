'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RiHospitalLine, RiAddLine, RiClipboardLine, RiCheckLine, RiErrorWarningLine,
  RiTestTubeLine, RiRadarLine, RiMailOpenLine, RiFolderOpenLine, RiPrinterLine,
  RiFileTextLine, RiMoreLine, RiCloseLine, RiArrowUpSLine, RiArrowDownSLine, RiMailLine,
  RiUserHeartLine, RiSearchLine, RiMoneyDollarCircleLine,
} from '@remixicon/react';
import Header from '@/components/Header';
import {
  Patient, PatientTest, TEST_CATALOGUE, getTestById, fetchPatients, addPatient, generateSlipNumber, subscribeToPatients,
  ReferringDoctor, ReferringFacility, TestPrice,
  fetchReferringDoctors, fetchReferringFacilities, fetchTestPrices,
  addPatientWithReferral,
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

  // Returning patient lookup state
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [showPatientSearchDrop, setShowPatientSearchDrop] = useState(false);
  const [loadedPatientName, setLoadedPatientName] = useState('');
  const patientSearchRef = useRef<HTMLDivElement>(null);

  // Referral DB state
  const [doctors, setDoctors] = useState<ReferringDoctor[]>([]);
  const [facilities, setFacilities] = useState<ReferringFacility[]>([]);
  const [testPrices, setTestPrices] = useState<TestPrice[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [facilitySearch, setFacilitySearch] = useState('');
  const [showDoctorDrop, setShowDoctorDrop] = useState(false);
  const [showFacilityDrop, setShowFacilityDrop] = useState(false);
  const doctorRef = useRef<HTMLDivElement>(null);
  const facilityRef = useRef<HTMLDivElement>(null);

  const { profile, organization, signOut } = useAuth();
  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    const data = await fetchPatients(organization.id);
    setPatients(data);
  }, [organization?.id]);

  // Load referral databases
  useEffect(() => {
    if (!organization?.id) return;
    Promise.all([
      fetchReferringDoctors(organization.id),
      fetchReferringFacilities(organization.id),
      fetchTestPrices(organization.id),
    ]).then(([docs, facs, prices]) => {
      setDoctors(docs.filter(d => d.is_active));
      setFacilities(facs.filter(f => f.is_active));
      setTestPrices(prices);
    });
  }, [organization?.id]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (doctorRef.current && !doctorRef.current.contains(e.target as Node)) setShowDoctorDrop(false);
      if (facilityRef.current && !facilityRef.current.contains(e.target as Node)) setShowFacilityDrop(false);
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) setShowPatientSearchDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!organization?.id) return;
    refresh();
    const unsubscribe = subscribeToPatients(organization.id, refresh);
    return () => { unsubscribe(); };
  }, [organization?.id, refresh]);

  const filteredTests = TEST_CATALOGUE.filter(test => {
    const q = testSearch.trim().toLowerCase();
    if (!q) return true;

    return [test.name, test.specimen, test.department, test.category]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const pendingPatients = patients.filter(p => p.tests.some(t => t.status !== 'completed'));
  const resultsPatients = patients.filter(p => p.tests.some(t => t.status === 'completed'));
  const newResultsCount = patients.filter(p => p.tests.some(t => t.status === 'completed')).length;

  const toggleTest = (id: string) => {
    setSelectedTests(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const removeTest = (id: string) => {
    setSelectedTests(prev => prev.filter(x => x !== id));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.surname.trim()) e.surname = 'Surname is required';
    if (!form.age.trim()) e.age = 'Age is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    if (!selectedDoctorId && !form.referredBy.trim()) {
      e.referredBy = 'Referring doctor is required';
    }
    if (!selectedFacilityId && !form.referringFacility.trim()) {
      e.referringFacility = 'Referring facility is required';
    }
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

      // Find selected doctor/facility names
      const selDoctor = doctors.find(d => d.id === selectedDoctorId);
      const selFacility = facilities.find(f => f.id === selectedFacilityId);

      const patientData: Omit<Patient, 'id' | 'tests'> = {
        slipNumber,
        registeredAt: new Date().toISOString(),
        name: [form.firstName, form.middleName, form.surname].filter(Boolean).join(' '),
        ...form,
        referredBy: selDoctor ? `Dr. ${selDoctor.name}` : form.referredBy,
        referringFacility: selFacility ? selFacility.name : form.referringFacility,
        referringDoctorId: (selectedDoctorId && selectedDoctorId !== 'none') ? selectedDoctorId : undefined,
        referringFacilityId: (selectedFacilityId && selectedFacilityId !== 'none') ? selectedFacilityId : undefined,
      };

      await addPatientWithReferral(patientData, tests, organization?.id || '');

      const tempPatient: Patient = {
        id: 'temp',
        tests: tests as any,
        ...patientData
      };

      setShowSlipModal(tempPatient);
      setForm({ firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', email: '', address: '', referredBy: '', referringFacility: '' });
      setSelectedTests([]);
      setSelectedDoctorId('');
      setSelectedFacilityId('');
      setDoctorSearch('');
      setFacilitySearch('');
      setLoadedPatientName('');
      setPatientSearchQuery('');
      setErrors({});
    } catch (err: any) {
      alert('Registration failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = (tab === 'queue' ? pendingPatients : resultsPatients).filter(p => {
    const q = searchQ.toLowerCase();
    const pName = p.name || [p.firstName, p.middleName, p.surname].filter(Boolean).join(' ') || '';
    const nameMatch = pName.toLowerCase().includes(q) || (p.slipNumber || '').toLowerCase().includes(q);
    if (deptFilter === 'all') return nameMatch;
    return nameMatch && p.tests.some(t => t.department === deptFilter);
  });

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f5fbfa 0%, #f7f8fb 38%, #eef4f4 100%)', display: 'flex', flexDirection: 'column' }}>
      <Header
        title="Reception"
        subtitle={organization?.name || 'Amana Trust Diagnostics'}
        icon={<RiHospitalLine size={24} color="white" />}
        accentColor="var(--teal-600)"
        notifications={newResultsCount}
      />

      {/* Tabs */}
      <div style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(148,163,184,0.25)', padding: '0 1.5rem', display: 'flex', gap: 0 }}>
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
        {tab === 'register' && (
          <div style={{ marginBottom: '1rem', padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(13,148,136,0.16)', background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(236,253,245,0.9))', boxShadow: '0 18px 40px -24px rgba(15,23,42,0.45)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal-700)' }}>Reception Desk</div>
                <h1 style={{ margin: '0.25rem 0 0', fontFamily: 'var(--font-display)', fontSize: '1.35rem', lineHeight: 1.1, color: 'var(--gray-900)' }}>Register the patient, search tests, and keep the selected list visible on one screen.</h1>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ padding: '0.4rem 0.65rem', background: 'white', border: '1px solid var(--teal-100)', color: 'var(--teal-700)', fontSize: '0.72rem', fontWeight: 700, borderRadius: 0 }}>Searchable tests</span>
                <span style={{ padding: '0.4rem 0.65rem', background: 'white', border: '1px solid var(--teal-100)', color: 'var(--teal-700)', fontSize: '0.72rem', fontWeight: 700, borderRadius: 0 }}>Removable selection</span>
              </div>
            </div>
          </div>
        )}

        {/* ===== REGISTER TAB ===== */}
        {tab === 'register' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.9fr', gap: '1.5rem', alignItems: 'start' }}>

            {/* Patient Form */}
            <div style={{ background: 'rgba(255,255,255,0.96)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(148,163,184,0.22)', overflow: 'hidden', boxShadow: '0 18px 40px -28px rgba(15,23,42,0.35)' }}>
              <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem' }}>
                <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600 }}>Patient Information</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: '0.2rem' }}>Enter patient biodata</p>
              </div>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {/* Returning Patient Lookup */}
                <div ref={patientSearchRef} style={{ background: '#f0fdfa', border: '1px dashed var(--teal-200)', padding: '0.75rem', borderRadius: 'var(--radius)', position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-800)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Returning Patient Lookup
                  </label>
                  <div style={{ position: 'relative' }}>
                    <RiSearchLine size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--teal-600)' }} />
                    <input
                      style={{ ...inputStyle(false), paddingLeft: 30, borderColor: 'var(--teal-200)' }}
                      placeholder="Search by name, phone, or slip number..."
                      value={patientSearchQuery}
                      onChange={e => {
                        setPatientSearchQuery(e.target.value);
                        setShowPatientSearchDrop(true);
                      }}
                      onFocus={() => setShowPatientSearchDrop(true)}
                    />
                    {patientSearchQuery && (
                      <button
                        onClick={() => {
                          setPatientSearchQuery('');
                          setShowPatientSearchDrop(false);
                        }}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex' }}
                      >
                        <RiCloseLine size={16} />
                      </button>
                    )}
                  </div>

                  {showPatientSearchDrop && patientSearchQuery.trim().length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--gray-300)', zIndex: 60, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: 'var(--radius)', marginTop: '0.25rem' }}>
                      {patients
                        .filter(p => {
                          const q = patientSearchQuery.toLowerCase();
                          const fullName = `${p.firstName || ''} ${p.middleName || ''} ${p.surname || ''}`.toLowerCase();
                          const nameMatches = fullName.includes(q) || (p.name || '').toLowerCase().includes(q);
                          const phoneMatches = (p.phone || '').includes(q);
                          const slipMatches = (p.slipNumber || '').toLowerCase().includes(q);
                          return nameMatches || phoneMatches || slipMatches;
                        })
                        .slice(0, 10)
                        .map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setForm({
                                firstName: p.firstName || '',
                                surname: p.surname || '',
                                middleName: p.middleName || '',
                                age: p.age || '',
                                sex: p.sex || 'Male',
                                phone: p.phone || '',
                                email: p.email || '',
                                address: p.address || '',
                                referredBy: '',
                                referringFacility: '',
                              });
                              setSelectedDoctorId('');
                              setSelectedFacilityId('');
                              setDoctorSearch('');
                              setFacilitySearch('');
                              setLoadedPatientName(`${p.firstName} ${p.surname}`);
                              setPatientSearchQuery('');
                              setShowPatientSearchDrop(false);
                            }}
                            style={dropItemStyle}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-50)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--gray-900)' }}>
                                  {p.firstName} {p.middleName} {p.surname}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>
                                  {p.phone} • {p.age} • {p.sex}
                                </div>
                              </div>
                              <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'var(--teal-100)', color: 'var(--teal-800)', padding: '2px 6px', borderRadius: 4 }}>
                                {p.slipNumber}
                              </div>
                            </div>
                          </div>
                        ))}
                      {patients.filter(p => {
                        const q = patientSearchQuery.toLowerCase();
                        const fullName = `${p.firstName || ''} ${p.middleName || ''} ${p.surname || ''}`.toLowerCase();
                        const nameMatches = fullName.includes(q) || (p.name || '').toLowerCase().includes(q);
                        const phoneMatches = (p.phone || '').includes(q);
                        const slipMatches = (p.slipNumber || '').toLowerCase().includes(q);
                        return nameMatches || phoneMatches || slipMatches;
                      }).length === 0 && (
                        <div style={{ padding: '0.75rem', color: 'var(--gray-400)', fontSize: '0.75rem', textAlign: 'center' }}>
                          No matching patients found.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {loadedPatientName && (
                  <div style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-200)', padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--teal-800)', borderRadius: 'var(--radius)' }}>
                    <span>Loaded returning patient: <b>{loadedPatientName}</b></span>
                    <button
                      onClick={() => {
                        setLoadedPatientName('');
                        setForm({
                          firstName: '', surname: '', middleName: '', age: '', sex: 'Male',
                          phone: '', email: '', address: '', referredBy: '', referringFacility: ''
                        });
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--red)', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Clear / Register New
                    </button>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                  <Field label="First Name *" error={errors.firstName}>
                    <input style={inputStyle(!!errors.firstName)} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="e.g. Musa" />
                  </Field>
                  <Field label="Surname *" error={errors.surname}>
                    <input style={inputStyle(!!errors.surname)} value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} placeholder="e.g. Bello" />
                  </Field>
                  <Field label="Middle Name" error={errors.middleName}>
                    <input style={inputStyle(!!errors.middleName)} value={form.middleName} onChange={e => setForm({ ...form, middleName: e.target.value })} placeholder="e.g. Ibrahim" />
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
                  <Field label="Referred By (Doctor) *" error={errors.referredBy}>
                    <div ref={doctorRef} style={{ position: 'relative' }}>
                      <div style={{ position: 'relative' }}>
                        <RiSearchLine size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
                        <input
                          style={{ ...inputStyle(!!errors.referredBy), paddingLeft: 26 }}
                          value={selectedDoctorId ? (selectedDoctorId === 'none' ? 'Not referred by anyone' : `Dr. ${doctors.find(d => d.id === selectedDoctorId)?.name || ''}`) : doctorSearch}
                          onChange={e => { setDoctorSearch(e.target.value); setSelectedDoctorId(''); setShowDoctorDrop(true); }}
                          onFocus={() => setShowDoctorDrop(true)}
                          placeholder="Search or type doctor name…"
                        />
                        {selectedDoctorId && (
                          <button onClick={() => { setSelectedDoctorId(''); setDoctorSearch(''); setForm({ ...form, referredBy: '' }); }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex' }}>
                            <RiCloseLine size={14} />
                          </button>
                        )}
                      </div>
                      {showDoctorDrop && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--gray-300)', zIndex: 50, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {/* Free-text option */}
                          {doctorSearch && !selectedDoctorId && (
                            <div onClick={() => { setForm({ ...form, referredBy: doctorSearch }); setShowDoctorDrop(false); }} style={dropItemStyle}>
                              <span style={{ fontStyle: 'italic', color: 'var(--gray-500)' }}>Use "{doctorSearch}" as typed</span>
                            </div>
                          )}
                          {doctors.filter(d => !doctorSearch || d.name.toLowerCase().includes(doctorSearch.toLowerCase())).map(d => (
                            <div key={d.id} onClick={() => { setSelectedDoctorId(d.id); setDoctorSearch(''); setShowDoctorDrop(false); setForm({ ...form, referredBy: `Dr. ${d.name}` }); }} style={dropItemStyle}>
                              <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>Dr. {d.name}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>
                                {d.facility_name || 'Independent'} · {d.commission_value > 0 ? `${d.commission_type === 'percentage' ? d.commission_value + '%' : '₦' + d.commission_value} commission` : 'No commission'}
                              </div>
                            </div>
                          ))}
                          {doctors.filter(d => !doctorSearch || d.name.toLowerCase().includes(doctorSearch.toLowerCase())).length === 0 && !doctorSearch && (
                            <div style={{ padding: '0.6rem 0.75rem', color: 'var(--gray-400)', fontSize: '0.78rem' }}>No doctors in database. Type to use a custom name.</div>
                          )}
                          
                          {/* Not referred by anyone option */}
                          <div
                            onClick={() => {
                              setSelectedDoctorId('none');
                              setDoctorSearch('');
                              setShowDoctorDrop(false);
                              setForm(prev => ({ ...prev, referredBy: 'Not referred by anyone', referringFacility: 'None / Walk-in' }));
                              setSelectedFacilityId('none');
                              setFacilitySearch('');
                            }}
                            style={{ ...dropItemStyle, borderTop: '1px solid var(--gray-200)', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.05rem' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-100)'}
                            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                          >
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--gray-700)' }}>Not referred by anyone</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>Direct walk-in / self-referral</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Field>
                  <Field label="Referring Facility *" error={errors.referringFacility}>
                    <div ref={facilityRef} style={{ position: 'relative' }}>
                      <div style={{ position: 'relative' }}>
                        <RiSearchLine size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', pointerEvents: 'none' }} />
                        <input
                          style={{ ...inputStyle(!!errors.referringFacility), paddingLeft: 26 }}
                          value={selectedFacilityId ? (selectedFacilityId === 'none' ? 'None / Walk-in' : facilities.find(f => f.id === selectedFacilityId)?.name || '') : facilitySearch}
                          onChange={e => { setFacilitySearch(e.target.value); setSelectedFacilityId(''); setShowFacilityDrop(true); }}
                          onFocus={() => setShowFacilityDrop(true)}
                          placeholder="Search or type facility name…"
                        />
                        {selectedFacilityId && (
                          <button onClick={() => { setSelectedFacilityId(''); setFacilitySearch(''); setForm({ ...form, referringFacility: '' }); }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex' }}>
                            <RiCloseLine size={14} />
                          </button>
                        )}
                      </div>
                      {showFacilityDrop && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--gray-300)', zIndex: 50, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {facilitySearch && !selectedFacilityId && (
                            <div onClick={() => { setForm({ ...form, referringFacility: facilitySearch }); setShowFacilityDrop(false); }} style={dropItemStyle}>
                              <span style={{ fontStyle: 'italic', color: 'var(--gray-500)' }}>Use "{facilitySearch}" as typed</span>
                            </div>
                          )}
                          {facilities.filter(f => !facilitySearch || f.name.toLowerCase().includes(facilitySearch.toLowerCase())).map(f => (
                            <div key={f.id} onClick={() => { setSelectedFacilityId(f.id); setFacilitySearch(''); setShowFacilityDrop(false); setForm({ ...form, referringFacility: f.name }); }} style={dropItemStyle}>
                              <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{f.name}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>
                                {f.address || ''}{f.commission_value > 0 ? ` · ${f.commission_type === 'percentage' ? f.commission_value + '%' : '₦' + f.commission_value} commission` : ''}
                              </div>
                            </div>
                          ))}
                          {facilities.filter(f => !facilitySearch || f.name.toLowerCase().includes(facilitySearch.toLowerCase())).length === 0 && !facilitySearch && (
                            <div style={{ padding: '0.6rem 0.75rem', color: 'var(--gray-400)', fontSize: '0.78rem' }}>No facilities in database. Type to use a custom name.</div>
                          )}

                          {/* None / Walk-in option */}
                          <div
                            onClick={() => {
                              setSelectedFacilityId('none');
                              setFacilitySearch('');
                              setShowFacilityDrop(false);
                              setForm(prev => ({ ...prev, referringFacility: 'None / Walk-in' }));
                            }}
                            style={{ ...dropItemStyle, borderTop: '1px solid var(--gray-200)', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.05rem' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-100)'}
                            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                          >
                            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--gray-700)' }}>None / Walk-in</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)' }}>Direct walk-in patient</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
                <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '0.2rem' }}>Search Tests</h3>
                    <p style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>Type to find a test, then click it to add it to the selected list.</p>
                  </div>
                  <input
                    value={testSearch}
                    onChange={e => setTestSearch(e.target.value)}
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

            {/* Selected Tests */}
            <div style={{ background: 'rgba(255,255,255,0.96)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(148,163,184,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'sticky', top: '1.5rem', boxShadow: '0 18px 40px -28px rgba(15,23,42,0.35)' }}>
              <div style={{ background: 'linear-gradient(135deg, var(--teal-800), var(--teal-700))', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600 }}>Selected Tests</h2>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                    {selectedTests.length} test{selectedTests.length !== 1 ? 's' : ''} selected
                  </p>
                </div>
                {selectedTests.length > 0 && (
                  <button
                    onClick={() => setSelectedTests([])}
                    style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: 0, padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div style={{ padding: '1rem', background: 'linear-gradient(180deg, #effaf8 0%, #f8fbfb 100%)', flex: 1 }}>
                {selectedTests.length === 0 ? (
                  <div style={{ border: '1px dashed var(--gray-300)', background: 'rgba(255,255,255,0.92)', padding: '1rem', color: 'var(--gray-500)', fontSize: '0.78rem', textAlign: 'center' }}>
                    No tests selected yet. Search and add tests from the patient information panel.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {selectedTests.map(tid => {
                      const t = getTestById(tid);
                      if (!t) return null;

                      return (
                        <div key={tid} style={{ background: 'white', border: `1px solid ${t.department === 'lab' ? 'var(--teal-200)' : '#c4b5fd'}`, padding: '0.75rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', boxShadow: '0 10px 20px -18px rgba(15,23,42,0.45)' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-900)' }}>{t.name}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)', marginTop: '0.15rem' }}>{t.category} • {t.specimen}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeTest(tid)}
                            aria-label={`Remove ${t.name}`}
                            style={{
                              border: '1px solid var(--gray-300)',
                              background: 'white',
                              color: 'var(--gray-600)',
                              cursor: 'pointer',
                              borderRadius: 0,
                              width: 30,
                              height: 30,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <RiCloseLine size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Cost + Commission Summary */}
              {selectedTests.length > 0 && (() => {
                const priceMap = new Map(testPrices.map(p => [p.test_id, p.price]));
                const totalCost = selectedTests.reduce((sum, tid) => sum + (priceMap.get(tid) || 0), 0);
                const selDoctor = doctors.find(d => d.id === selectedDoctorId);
                const selFacility = facilities.find(f => f.id === selectedFacilityId);
                const referrer = selDoctor || selFacility;
                const commissionAmt = referrer
                  ? referrer.commission_type === 'percentage'
                    ? (totalCost * referrer.commission_value) / 100
                    : referrer.commission_value
                  : 0;
                if (totalCost === 0 && !referrer) return null;
                return (
                  <div style={{ borderTop: '1px solid var(--teal-100)', padding: '0.85rem 1rem', background: 'rgba(68,114,196,0.04)' }}>
                    {totalCost > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: referrer ? '0.4rem' : 0 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)', fontWeight: 600 }}>Est. Total Bill</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1a6aaf' }}>₦{totalCost.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {referrer && commissionAmt > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: totalCost > 0 ? '0.35rem' : 0, borderTop: totalCost > 0 ? '1px dashed var(--teal-200)' : 'none' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>
                          Commission ({selDoctor ? `Dr. ${selDoctor.name}` : selFacility?.name})
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--gold)' }}>₦{commissionAmt.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
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
          <button
            onClick={() => {
              handlePrint();
              onClose();
            }}
            style={{ ...btnStyle('primary'), flex: 1, justifyContent: 'center' }}
          >
            <RiPrinterLine size={14} /> Print Slip &amp; Notify
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
            const isMcs = t.testId.toLowerCase().endsWith('_mcs') || t.testId.toLowerCase().includes('mcs') || t.testId.toLowerCase() === 'sfmcs' || t.testName.toLowerCase().includes('mcs') || t.testName.toLowerCase().includes('culture & sensitivity') || t.testName.toLowerCase().includes('culture and sensitivity');

            let colour = '—';
            let appearance = '—';
            const microscopyRows: { parameter: string; value: string }[] = [];
            let growth = '—';
            let organism = '—';
            let degree = '—';
            let gramReaction = '—';
            let shape = '—';
            let incubationPeriod = '—';
            let incubationTemperature = '—';

            const sensitiveList: string[] = [];
            const intermediateList: string[] = [];
            const resistantList: string[] = [];

            if (isMcs) {
              (t.results || []).forEach(r => {
                const param = r.parameter;
                const val = r.result;

                if (param.startsWith('Macroscopy: ')) {
                  const field = param.replace('Macroscopy: ', '');
                  if (field === 'Colour') colour = val || '—';
                  if (field === 'Appearance') appearance = val || '—';
                } else if (param.startsWith('Microscopy: ')) {
                  const pName = param.replace('Microscopy: ', '');
                  microscopyRows.push({ parameter: pName, value: val });
                } else if (param.startsWith('Culture: ')) {
                  const field = param.replace('Culture: ', '');
                  if (field === 'Growth') growth = val || '—';
                  if (field === 'Organism') organism = val || '—';
                  if (field === 'Degree') degree = val || '—';
                  if (field === 'Gram Reaction') gramReaction = val || '—';
                  if (field === 'Shape') shape = val || '—';
                  if (field === 'Incubation Period') incubationPeriod = val || '—';
                  if (field === 'Incubation Temperature') incubationTemperature = val || '—';
                } else if (param.startsWith('Sensitivity: ')) {
                  const match = param.match(/Sensitivity:\s+(.+)\s+\((.+)\)/);
                  if (match) {
                    const antibioticText = `${match[1]} (${match[2]})`;
                    if (val === 'S') sensitiveList.push(antibioticText);
                    else if (val === 'I') intermediateList.push(antibioticText);
                    else if (val === 'R') resistantList.push(antibioticText);
                  }
                }
              });
            }

            const isNoGrowth = ['no growth', 'sterile', 'no-growth'].includes(growth.trim().toLowerCase());

            const maxRows = Math.max(sensitiveList.length, intermediateList.length, resistantList.length);
            const sensitivityRows = [];
            for (let i = 0; i < maxRows; i++) {
              sensitivityRows.push({
                s: sensitiveList[i] || '',
                i: intermediateList[i] || '',
                r: resistantList[i] || ''
              });
            }

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

                {isMcs ? (
                  <div style={{ padding: '0.85rem', fontSize: '0.78rem' }}>
                    {/* Macroscopy & Microscopy */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div style={{ border: '1px solid var(--gray-200)', borderRadius: 4, padding: '0.5rem' }}>
                        <div style={{ fontWeight: 700, borderBottom: '1px solid var(--gray-200)', marginBottom: '0.35rem', color: 'var(--teal-800)' }}>MACROSCOPY</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.15rem 0' }}>
                          <span style={{ fontWeight: 600 }}>Colour:</span> <span>{colour}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.15rem 0' }}>
                          <span style={{ fontWeight: 600 }}>Appearance:</span> <span>{appearance}</span>
                        </div>
                      </div>
                      <div style={{ border: '1px solid var(--gray-200)', borderRadius: 4, padding: '0.5rem' }}>
                        <div style={{ fontWeight: 700, borderBottom: '1px solid var(--gray-200)', marginBottom: '0.35rem', color: 'var(--teal-800)' }}>MICROSCOPY</div>
                        {microscopyRows.length > 0 ? microscopyRows.map((m, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.15rem 0' }}>
                            <span style={{ fontWeight: 600 }}>{m.parameter}:</span> <span>{m.value || 'Nil'}</span>
                          </div>
                        )) : <div style={{ fontStyle: 'italic', color: 'var(--gray-400)' }}>No microscopy parameters</div>}
                      </div>
                    </div>

                    {/* Culture findings */}
                    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 4, padding: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ fontWeight: 700, borderBottom: '1px solid var(--gray-200)', marginBottom: '0.35rem', color: 'var(--teal-800)' }}>CULTURE FINDINGS</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                        <div><span style={{ fontWeight: 600 }}>Growth:</span> {growth}</div>
                        {!isNoGrowth && (
                          <>
                            <div><span style={{ fontWeight: 600 }}>Organism:</span> <span style={{ fontStyle: 'italic' }}>{organism}</span></div>
                            <div><span style={{ fontWeight: 600 }}>Degree:</span> {degree}</div>
                            <div><span style={{ fontWeight: 600 }}>Reaction:</span> {gramReaction} ({shape})</div>
                            <div style={{ gridColumn: 'span 2' }}><span style={{ fontWeight: 600 }}>Incubation:</span> {incubationPeriod} @ {incubationTemperature}</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Sensitivity */}
                    {!isNoGrowth && (
                      <div style={{ border: '1px solid var(--gray-200)', borderRadius: 4, padding: '0.5rem' }}>
                        <div style={{ fontWeight: 700, borderBottom: '1px solid var(--gray-200)', marginBottom: '0.35rem', color: 'var(--teal-800)' }}>ANTIBIOTIC SENSITIVITY PROFILE</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                          <thead>
                            <tr style={{ background: 'var(--gray-50)' }}>
                              <th style={{ padding: '0.3rem', textAlign: 'left', color: 'var(--green)', borderBottom: '1.5px solid var(--gray-200)' }}>SENSITIVE (S)</th>
                              <th style={{ padding: '0.3rem', textAlign: 'left', color: 'var(--amber)', borderBottom: '1.5px solid var(--gray-200)' }}>INTERMEDIATE (I)</th>
                              <th style={{ padding: '0.3rem', textAlign: 'left', color: 'var(--red)', borderBottom: '1.5px solid var(--gray-200)' }}>RESISTANT (R)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sensitivityRows.length > 0 ? sensitivityRows.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                <td style={{ padding: '0.25rem 0.3rem', color: 'var(--green)' }}>{row.s}</td>
                                <td style={{ padding: '0.25rem 0.3rem', color: 'var(--amber)' }}>{row.i}</td>
                                <td style={{ padding: '0.25rem 0.3rem', color: 'var(--red)', fontWeight: 600 }}>{row.r}</td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan={3} style={{ textAlign: 'center', padding: '0.5rem', fontStyle: 'italic', color: 'var(--gray-400)' }}>No sensitivity results</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  t.results && t.results.length > 0 && (
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
                  )
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

const dropItemStyle: React.CSSProperties = {
  padding: '0.55rem 0.75rem',
  cursor: 'pointer',
  borderBottom: '1px solid var(--gray-100)',
  transition: 'background 0.1s',
};

const closeBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)', border: 'none',
  color: 'white', cursor: 'pointer', borderRadius: 0,
  width: 30, height: 30, fontSize: '0.85rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
