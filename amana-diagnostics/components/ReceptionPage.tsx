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
  addPatientWithReferral, addReferringDoctor, addReferringFacility,
  fetchCustomTests, setCustomCatalogueCache, Test
} from '@/lib/store';
import { getResultTemplate, getSlipTemplate, getInvoiceTemplate } from '@/lib/templates';
import { useAuth } from '@/components/AuthProvider';
import { RiLogoutCircleLine } from '@remixicon/react';

type Tab = 'register' | 'queue' | 'results';

export default function ReceptionPage() {
  const [tab, setTab] = useState<Tab>('register');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dateFilter, setDateFilter] = useState<'today' | 'seven_days' | 'thirty_days'>('today');
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
  const [catalogue, setCatalogue] = useState<Test[]>(TEST_CATALOGUE);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [facilitySearch, setFacilitySearch] = useState('');
  const [showDoctorDrop, setShowDoctorDrop] = useState(false);
  const [showFacilityDrop, setShowFacilityDrop] = useState(false);
  const doctorRef = useRef<HTMLDivElement>(null);
  const facilityRef = useRef<HTMLDivElement>(null);

  // Billing and discount states
  const [discountType, setDiscountType] = useState<'none' | 'flat' | 'percentage'>('none');
  const [discountValue, setDiscountValue] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Quick register modal states
  const [showQuickDoctor, setShowQuickDoctor] = useState(false);
  const [showQuickFacility, setShowQuickFacility] = useState(false);
  const [quickDoctorForm, setQuickDoctorForm] = useState({ name: '', phone: '', email: '', facility_id: '' });
  const [quickFacilityForm, setQuickFacilityForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [quickError, setQuickError] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  const { profile, organization, signOut } = useAuth();
  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    const data = await fetchPatients(organization.id);
    setPatients(data);
  }, [organization?.id]);

  // Load referral databases
  // Load referral databases & custom tests
  useEffect(() => {
    if (!organization?.id) return;
    Promise.all([
      fetchReferringDoctors(organization.id),
      fetchReferringFacilities(organization.id),
      fetchTestPrices(organization.id),
      fetchCustomTests(organization.id),
    ]).then(([docs, facs, prices, customTests]) => {
      setDoctors(docs.filter(d => d.is_active));
      setFacilities(facs.filter(f => f.is_active));
      setTestPrices(prices);

      setCustomCatalogueCache(customTests);

      // Merge defaults with custom tests
      const merged = [...TEST_CATALOGUE];
      customTests.forEach(ct => {
        const idx = merged.findIndex(t => t.id === ct.id);
        if (idx !== -1) {
          if (ct.is_active === false) {
            merged.splice(idx, 1);
          } else {
            merged[idx] = ct;
          }
        } else if (ct.is_active !== false) {
          merged.push(ct);
        }
      });
      setCatalogue(merged);
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

  const filteredTests = catalogue.filter(test => {
    const q = testSearch.trim().toLowerCase();
    if (!q) return true;

    return [test.name, test.specimen, test.department, test.category]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const filterByDate = (dateString: string | number | Date) => {
    const pDate = new Date(dateString);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateFilter === 'today') {
      return pDate >= startOfToday;
    } else if (dateFilter === 'seven_days') {
      const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
      return pDate >= sevenDaysAgo;
    } else if (dateFilter === 'thirty_days') {
      const thirtyDaysAgo = new Date(startOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);
      return pDate >= thirtyDaysAgo;
    }
    return true;
  };

  const pendingPatients = patients.filter(p => p.tests.some(t => t.status !== 'completed') && filterByDate(p.registeredAt));
  const resultsPatients = patients.filter(p => p.tests.some(t => t.status === 'completed') && filterByDate(p.registeredAt));
  const newResultsCount = resultsPatients.length;

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

  // ─── BILLING CALCULATIONS ───────────────────────────────────────────────────
  const selectedTestDetails = selectedTests.map(tid => {
    const test = getTestById(tid)!;
    const catalog = testPrices.find(p => p.test_id === tid);
    return {
      testId: test.id,
      testName: test.name,
      department: test.department,
      specimen: test.specimen,
      price: catalog ? catalog.price : 0,
      commissionType: catalog ? catalog.commission_type : 'none',
      commissionValue: catalog ? catalog.commission_value : 0,
    };
  });

  const subtotal = selectedTestDetails.reduce((sum, t) => sum + t.price, 0);
  const discVal = parseFloat(discountValue) || 0;
  const discountAmount = discountType === 'percentage'
    ? (subtotal * discVal) / 100
    : discountType === 'flat'
      ? discVal
      : 0;
  const netBill = Math.max(0, subtotal - discountAmount);
  const amountPaidVal = paidAmount === '' ? netBill : (parseFloat(paidAmount) || 0);
  const balance = netBill - amountPaidVal;
  const paymentStatus = amountPaidVal >= netBill
    ? 'paid'
    : amountPaidVal > 0
      ? 'partial'
      : 'unpaid';

  const isReferral = !!(selectedDoctorId && selectedDoctorId !== 'none') || !!(selectedFacilityId && selectedFacilityId !== 'none');
  const totalCommission = selectedTestDetails.reduce((sum, t) => {
    let commAmt = 0;
    if (isReferral && t.commissionType !== 'none') {
      if (t.commissionType === 'percentage') {
        commAmt = (t.price * (t.commissionValue || 0)) / 100;
      } else if (t.commissionType === 'flat') {
        commAmt = t.commissionValue || 0;
      }
    }
    return sum + commAmt;
  }, 0);

  const handleQuickDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDoctorForm.name.trim()) {
      setQuickError('Name is required');
      return;
    }
    if (!organization?.id) return;
    setQuickSaving(true);
    setQuickError('');
    try {
      const doc = await addReferringDoctor({
        organization_id: organization.id,
        name: quickDoctorForm.name.trim(),
        phone: quickDoctorForm.phone.trim() || undefined,
        email: quickDoctorForm.email.trim() || undefined,
        facility_id: quickDoctorForm.facility_id || undefined,
        commission_type: 'percentage',
        commission_value: 0,
        is_active: true,
      }, organization.id);

      const updatedDocs = await fetchReferringDoctors(organization.id);
      setDoctors(updatedDocs.filter(d => d.is_active));
      setSelectedDoctorId(doc.id);
      setDoctorSearch('');
      setForm(prev => ({ ...prev, referredBy: `Dr. ${doc.name}` }));

      if (doc.facility_id) {
        setSelectedFacilityId(doc.facility_id);
        const fac = facilities.find(f => f.id === doc.facility_id);
        if (fac) {
          setForm(prev => ({ ...prev, referringFacility: fac.name }));
        }
      }

      setShowQuickDoctor(false);
    } catch (err: any) {
      setQuickError(err.message || 'Failed to register doctor');
    } finally {
      setQuickSaving(false);
    }
  };

  const handleQuickFacilitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickFacilityForm.name.trim()) {
      setQuickError('Facility name is required');
      return;
    }
    if (!organization?.id) return;
    setQuickSaving(true);
    setQuickError('');
    try {
      const fac = await addReferringFacility({
        organization_id: organization.id,
        name: quickFacilityForm.name.trim(),
        address: quickFacilityForm.address.trim() || undefined,
        phone: quickFacilityForm.phone.trim() || undefined,
        email: quickFacilityForm.email.trim() || undefined,
        commission_type: 'percentage',
        commission_value: 0,
        is_active: true,
      }, organization.id);

      const updatedFacs = await fetchReferringFacilities(organization.id);
      setFacilities(updatedFacs.filter(f => f.is_active));
      setSelectedFacilityId(fac.id);
      setFacilitySearch('');
      setForm(prev => ({ ...prev, referringFacility: fac.name }));

      setShowQuickFacility(false);
    } catch (err: any) {
      setQuickError(err.message || 'Failed to register facility');
    } finally {
      setQuickSaving(false);
    }
  };

  const handleRegister = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);

    try {
      const slipNumber = await generateSlipNumber(organization?.id || '');
      const isReferral = !!(selectedDoctorId && selectedDoctorId !== 'none') || !!(selectedFacilityId && selectedFacilityId !== 'none');

      const tests = selectedTestDetails.map(t => {
        let commAmt = 0;
        if (isReferral && t.commissionType !== 'none') {
          if (t.commissionType === 'percentage') {
            commAmt = (t.price * (t.commissionValue || 0)) / 100;
          } else if (t.commissionType === 'flat') {
            commAmt = t.commissionValue || 0;
          }
        }
        return {
          testId: t.testId,
          testName: t.testName,
          department: t.department,
          status: 'pending' as const,
          specimen: t.specimen,
          price: t.price,
          commissionType: t.commissionType as any || 'none',
          commissionValue: t.commissionValue || 0,
          commissionAmount: commAmt,
        };
      });

      const totalCommission = tests.reduce((sum, t) => sum + (t.commissionAmount || 0), 0);

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
        commissionAssigned: isReferral && totalCommission > 0,
        commissionType: isReferral && totalCommission > 0 ? 'varies' : undefined,
        commissionValue: 0,
        commissionAmount: totalCommission,
        totalAmount: subtotal,
        discountType: discountType,
        discountValue: discVal,
        discountAmount: discountAmount,
        netAmount: netBill,
        paidAmount: amountPaidVal,
        paymentStatus: paymentStatus,
        paymentMethod: paymentMethod,
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
      setDiscountType('none');
      setDiscountValue('');
      setPaidAmount('');
      setPaymentMethod('cash');
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
                  <Field
                    label="Referred By (Doctor) *"
                    error={errors.referredBy}
                    actionNode={
                      <button
                        type="button"
                        onClick={() => {
                          setQuickDoctorForm({ name: '', phone: '', email: '', facility_id: selectedFacilityId && selectedFacilityId !== 'none' ? selectedFacilityId : '' });
                          setQuickError('');
                          setShowQuickDoctor(true);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--teal-600)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.15rem' }}
                      >
                        <RiAddLine size={12} /> Quick Register
                      </button>
                    }
                  >
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
                  <Field
                    label="Referring Facility *"
                    error={errors.referringFacility}
                    actionNode={
                      <button
                        type="button"
                        onClick={() => {
                          setQuickFacilityForm({ name: '', address: '', phone: '', email: '' });
                          setQuickError('');
                          setShowQuickFacility(true);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--teal-600)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.15rem' }}
                      >
                        <RiAddLine size={12} /> Quick Register
                      </button>
                    }
                  >
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
                    type="button"
                    onClick={() => setSelectedTests([])}
                    style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', borderRadius: 0, padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div style={{ padding: '1rem', background: 'linear-gradient(180deg, #effaf8 0%, #f8fbfb 100%)', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 200 }}>
                {selectedTests.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', justifyContent: 'center' }}>
                    <div style={{ border: '1px dashed var(--gray-300)', background: 'rgba(255,255,255,0.92)', padding: '1.5rem 1rem', color: 'var(--gray-500)', fontSize: '0.78rem', textAlign: 'center', borderRadius: 'var(--radius)' }}>
                      No tests selected yet. Search and add tests from the patient information panel.
                    </div>
                    <button
                      disabled
                      style={{
                        background: 'var(--gray-300)', color: 'var(--gray-500)', border: 'none',
                        borderRadius: 'var(--radius)', padding: '0.75rem',
                        fontSize: '0.82rem', fontWeight: 700, cursor: 'not-allowed',
                        textAlign: 'center', width: '100%'
                      }}
                    >
                      Select tests to proceed
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {selectedTests.map(tid => {
                      const t = getTestById(tid);
                      if (!t) return null;

                      const priceDetail = selectedTestDetails.find(d => d.testId === tid);
                      const price = priceDetail ? priceDetail.price : 0;

                      return (
                        <div key={tid} style={{ background: 'white', border: `1px solid ${t.department === 'lab' ? 'var(--teal-200)' : '#c4b5fd'}`, padding: '0.75rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', boxShadow: '0 10px 20px -18px rgba(15,23,42,0.45)' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-900)' }}>{t.name}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)', marginTop: '0.15rem' }}>{t.category} • {t.specimen}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--teal-700)' }}>
                              ₦{price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                            </span>
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Checkout & Billing Panel */}
              {selectedTests.length > 0 && (
                <div style={{ borderTop: '1px solid var(--teal-100)', padding: '1rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--teal-800)', borderBottom: '1px solid rgba(13,148,136,0.1)', paddingBottom: '0.35rem', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Billing & Checkout
                  </h3>

                  {/* Subtotal */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)', fontWeight: 600 }}>Subtotal</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--gray-800)' }}>
                      ₦{subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Discount Section */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '0.15rem' }}>Discount Type</label>
                      <select
                        style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                        value={discountType}
                        onChange={e => {
                          setDiscountType(e.target.value as any);
                          setDiscountValue('');
                        }}
                      >
                        <option value="none">No Discount</option>
                        <option value="percentage">Percentage (%)</option>
                        <option value="flat">Flat (₦)</option>
                      </select>
                    </div>
                    {discountType !== 'none' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '0.15rem' }}>
                          Value {discountType === 'percentage' ? '(%)' : '(₦)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                          placeholder={discountType === 'percentage' ? 'e.g. 10' : 'e.g. 1000'}
                          value={discountValue}
                          onChange={e => setDiscountValue(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Discount Amount (if any) */}
                  {discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', padding: '0.35rem 0.5rem', border: '1px solid #fee2e2', borderRadius: 4 }}>
                      <span style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600 }}>Discount Allowed</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b91c1c' }}>
                        -₦{discountAmount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {/* Net Bill */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--gray-300)', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-800)', fontWeight: 700 }}>Net Bill</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--teal-700)' }}>
                      ₦{netBill.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Paid Amount & Payment Method */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '0.15rem' }}>Amount Paid (₦)</label>
                      <input
                        type="number"
                        min="0"
                        style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                        placeholder={netBill.toString()}
                        value={paidAmount}
                        onChange={e => setPaidAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '0.15rem' }}>Payment Method</label>
                      <select
                        style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value)}
                      >
                        <option value="cash">Cash</option>
                        <option value="pos">POS</option>
                        <option value="transfer">Bank Transfer</option>
                        <option value="split">Split Payment</option>
                      </select>
                    </div>
                  </div>

                  {/* Balance Due */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: balance > 0 ? '#fff7ed' : '#f0fdf4', padding: '0.4rem 0.6rem', border: `1px solid ${balance > 0 ? '#ffedd5' : '#bbf7d0'}`, borderRadius: 4 }}>
                    <span style={{ fontSize: '0.72rem', color: balance > 0 ? '#c2410c' : '#15803d', fontWeight: 600 }}>
                      {balance > 0 ? 'Balance Due (Unpaid)' : 'Payment Cleared'}
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: balance > 0 ? '#c2410c' : '#15803d' }}>
                      ₦{balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Referral Commission Summary (informative) */}
                  {isReferral && totalCommission > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fefcf0', border: '1px solid #fef08a', padding: '0.4rem 0.6rem', borderRadius: 4 }}>
                      <span style={{ fontSize: '0.72rem', color: '#a16207', fontWeight: 600 }}>
                        Referral Commission
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#a16207' }}>
                        ₦{totalCommission.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handleRegister}
                    disabled={saving}
                    style={{
                      background: 'var(--teal-700)', color: 'white', border: 'none',
                      borderRadius: 'var(--radius)', padding: '0.65rem',
                      fontSize: '0.82rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                      marginTop: '0.25rem', letterSpacing: '0.02em',
                      opacity: saving ? 0.7 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {saving ? 'Registering...' : (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                        <RiCheckLine size={16} /> Register &amp; Print Receipt
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== QUEUE TAB ===== */}
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

      {/* Quick Add Doctor Modal */}
      {showQuickDoctor && (
        <div style={modalOverlay}>
          <form onSubmit={handleQuickDoctorSubmit} style={{ ...modalBox, maxWidth: 450 }}>
            <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Quick Register Referring Doctor</h2>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', marginTop: '0.15rem' }}>Add a new referring doctor to the system database</p>
              </div>
              <button type="button" onClick={() => setShowQuickDoctor(false)} style={closeBtn}><RiCloseLine size={16} /></button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', background: 'white' }}>
              {quickError && (
                <div style={{ color: 'var(--red)', fontSize: '0.75rem', background: 'var(--red-light)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid #f5c6cb' }}>
                  {quickError}
                </div>
              )}

              <Field label="Doctor's Name *">
                <input
                  required
                  style={inputStyle(false)}
                  placeholder="e.g. John Doe"
                  value={quickDoctorForm.name}
                  onChange={e => setQuickDoctorForm({ ...quickDoctorForm, name: e.target.value })}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Phone Number">
                  <input
                    style={inputStyle(false)}
                    placeholder="e.g. +234 80..."
                    value={quickDoctorForm.phone}
                    onChange={e => setQuickDoctorForm({ ...quickDoctorForm, phone: e.target.value })}
                  />
                </Field>
                <Field label="Email Address">
                  <input
                    type="email"
                    style={inputStyle(false)}
                    placeholder="e.g. doc@hospital.com"
                    value={quickDoctorForm.email}
                    onChange={e => setQuickDoctorForm({ ...quickDoctorForm, email: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Affiliated Facility">
                <select
                  style={inputStyle(false)}
                  value={quickDoctorForm.facility_id}
                  onChange={e => setQuickDoctorForm({ ...quickDoctorForm, facility_id: e.target.value })}
                >
                  <option value="">Independent / None</option>
                  {facilities.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: '0.75rem', background: '#f8fafc', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowQuickDoctor(false)} style={btnStyle('outline')}>Cancel</button>
              <button
                type="submit"
                disabled={quickSaving}
                style={{
                  ...btnStyle('primary'),
                  cursor: quickSaving ? 'not-allowed' : 'pointer',
                  opacity: quickSaving ? 0.7 : 1
                }}
              >
                {quickSaving ? 'Saving...' : 'Register Doctor'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add Facility Modal */}
      {showQuickFacility && (
        <div style={modalOverlay}>
          <form onSubmit={handleQuickFacilitySubmit} style={{ ...modalBox, maxWidth: 450 }}>
            <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Quick Register Referring Facility</h2>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', marginTop: '0.15rem' }}>Add a new referring facility to the system database</p>
              </div>
              <button type="button" onClick={() => setShowQuickFacility(false)} style={closeBtn}><RiCloseLine size={16} /></button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', background: 'white' }}>
              {quickError && (
                <div style={{ color: 'var(--red)', fontSize: '0.75rem', background: 'var(--red-light)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid #f5c6cb' }}>
                  {quickError}
                </div>
              )}

              <Field label="Facility Name *">
                <input
                  required
                  style={inputStyle(false)}
                  placeholder="e.g. City General Hospital"
                  value={quickFacilityForm.name}
                  onChange={e => setQuickFacilityForm({ ...quickFacilityForm, name: e.target.value })}
                />
              </Field>

              <Field label="Address">
                <input
                  style={inputStyle(false)}
                  placeholder="e.g. 12 Clinic Road, Kano"
                  value={quickFacilityForm.address}
                  onChange={e => setQuickFacilityForm({ ...quickFacilityForm, address: e.target.value })}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Phone Number">
                  <input
                    style={inputStyle(false)}
                    placeholder="e.g. +234 80..."
                    value={quickFacilityForm.phone}
                    onChange={e => setQuickFacilityForm({ ...quickFacilityForm, phone: e.target.value })}
                  />
                </Field>
                <Field label="Email Address">
                  <input
                    type="email"
                    style={inputStyle(false)}
                    placeholder="e.g. contact@facility.com"
                    value={quickFacilityForm.email}
                    onChange={e => setQuickFacilityForm({ ...quickFacilityForm, email: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: '0.75rem', background: '#f8fafc', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowQuickFacility(false)} style={btnStyle('outline')}>Cancel</button>
              <button
                type="submit"
                disabled={quickSaving}
                style={{
                  ...btnStyle('primary'),
                  cursor: quickSaving ? 'not-allowed' : 'pointer',
                  opacity: quickSaving ? 0.7 : 1
                }}
              >
                {quickSaving ? 'Saving...' : 'Register Facility'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ---- Field wrapper ---- */
function Field({ label, children, error, actionNode }: { label: string; children: React.ReactNode; error?: string; actionNode?: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-700)' }}>{label}</label>
        {actionNode}
      </div>
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
  const [modalTab, setModalTab] = useState<'slip' | 'invoice'>('slip');
  const regDate = new Date(patient.registeredAt).toLocaleDateString('en-NG');
  const specimens = Array.from(new Set(patient.tests.map((t: any) => t.specimen))).filter(Boolean).join(', ') || '—';

  const orgName = org?.name || 'AMANA TRUST DIAGNOSTICS';
  const orgLine2 = org?.letterhead_line2 || '';
  const orgAddress = org?.address || '';
  const orgPhone = org?.phone || '';

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    if (modalTab === 'slip') {
      win.document.write(getSlipTemplate(patient, org));
    } else {
      win.document.write(getInvoiceTemplate(patient, org));
    }
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
            <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>
              {modalTab === 'slip' ? 'Investigation Request Slip' : 'Payment Receipt / Invoice'}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', marginTop: '0.15rem' }}></p>
          </div>
          <button onClick={onClose} style={closeBtn}><RiCloseLine size={16} /></button>
        </div>

        {/* Tab Switcher */}
        <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', display: 'flex' }}>
          <button
            type="button"
            onClick={() => setModalTab('slip')}
            style={{
              flex: 1, padding: '0.75rem', border: 'none', background: modalTab === 'slip' ? 'var(--teal-50)' : 'white',
              color: modalTab === 'slip' ? 'var(--teal-700)' : 'var(--gray-500)',
              fontWeight: 600, fontSize: '0.8rem', borderBottom: modalTab === 'slip' ? '2px solid var(--teal-600)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            Investigation Request Slip
          </button>
          <button
            type="button"
            onClick={() => setModalTab('invoice')}
            style={{
              flex: 1, padding: '0.75rem', border: 'none', background: modalTab === 'invoice' ? 'var(--teal-50)' : 'white',
              color: modalTab === 'invoice' ? 'var(--teal-700)' : 'var(--gray-500)',
              fontWeight: 600, fontSize: '0.8rem', borderBottom: modalTab === 'invoice' ? '2px solid var(--teal-600)' : '2px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            Payment Receipt
          </button>
        </div>

        {/* Live preview */}
        <div style={{ padding: '1.25rem', background: 'var(--gray-100)', maxHeight: '60vh', overflowY: 'auto' }}>
          {modalTab === 'slip' ? (
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
          ) : (
            <div style={previewWrap}>
              {/* ── Org Header ── */}
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 'bold', lineHeight: 1.2, margin: 0 }}>{orgName.toUpperCase()}</div>
                {orgLine2 && <div style={{ fontSize: 11, fontWeight: 'bold', margin: '2px 0 4px' }}>{orgLine2.toUpperCase()}</div>}
                {orgAddress && <div style={{ fontSize: 10, margin: '2px 0' }}>{orgAddress}</div>}
                {orgPhone && <div style={{ fontSize: 10, margin: 0 }}>{orgPhone}</div>}
              </div>

              {/* ── Invoice Title ── */}
              <div style={{ fontSize: 14, fontWeight: 'bold', textAlign: 'center', margin: '8px 0 10px', borderBottom: '1px solid #000', paddingBottom: 4 }}>
                PAYMENT RECEIPT
              </div>

              {/* ── Patient & Referral Info ── */}
              <div style={{ marginBottom: 10, fontSize: 12, lineHeight: 1.6, borderBottom: '1px dashed #000', paddingBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>Invoice No:</span> <span>{patient.slipNumber}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>Patient Name:</span> <span>{patient.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>Age/Sex:</span> <span>{patient.age} / {patient.sex}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>Date:</span> <span>{regDate}</span>
                </div>
              </div>

              {/* ── Invoice Items ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ borderBottom: '1px solid #000', textAlign: 'left', padding: '3px 0', fontWeight: 700 }}>Investigation</th>
                    <th style={{ borderBottom: '1px solid #000', textAlign: 'right', padding: '3px 0', fontWeight: 700 }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {patient.tests.map((t: any) => (
                    <tr key={t.testId} style={{ borderBottom: '1px dashed #eee' }}>
                      <td style={{ padding: '3px 0', fontSize: 11 }}>{t.testName}</td>
                      <td style={{ padding: '3px 0', textAlign: 'right', fontSize: 11 }}>
                        ₦{(t.price || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ── Billing Summary ── */}
              <div style={{ marginTop: 10, borderTop: '1px solid #000', paddingTop: 6, fontSize: 12, lineHeight: 1.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>₦{(patient.totalAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
                {(patient.discountAmount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {patient.discountType === 'percentage'
                        ? `Discount (${patient.discountValue}%)`
                        : patient.discountType === 'flat'
                          ? 'Discount (Flat)'
                          : 'Discount'}
                      :
                    </span>
                    <span>-₦{(patient.discountAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13, borderBottom: '1px dashed #000', paddingBottom: 4, marginBottom: 4 }}>
                  <span>Net Amount:</span>
                  <span>₦{(patient.netAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Amount Paid:</span>
                  <span>₦{(patient.paidAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: ((patient.netAmount || 0) - (patient.paidAmount || 0)) > 0 ? '#c0392b' : '#000' }}>
                  <span>Balance Due:</span>
                  <span>₦{((patient.netAmount || 0) - (patient.paidAmount || 0)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', marginTop: 4 }}>
                  <span>Payment Method:</span>
                  <span style={{ textTransform: 'uppercase' }}>{patient.paymentMethod || 'cash'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
                  <span>Payment Status:</span>
                  <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{patient.paymentStatus || 'paid'}</span>
                </div>
              </div>

              {/* ── Footer ── */}
              <div style={{ marginTop: 14, borderTop: '1px dashed #000', paddingTop: 8, fontSize: 10, textAlign: 'center', lineHeight: 1.5 }}>
                Thank you for your patronage.<br />
                Please retain this receipt for your records.<br />
                {orgName} &copy; {new Date().getFullYear()}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: '0.75rem', background: 'white' }}>
          <button
            type="button"
            onClick={() => {
              handlePrint();
              onClose();
            }}
            style={{ ...btnStyle('primary'), flex: 1, justifyContent: 'center' }}
          >
            <RiPrinterLine size={14} /> Print Document
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

    const testsToPrint = completedTests.filter(t => selectedIds.includes(t.testId));
    if (testsToPrint.length === 0) {
      alert('Please select at least one test to email.');
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch('/api/send-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient, completedTests: testsToPrint, org }),
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
      <div style={{ ...modalBox, maxWidth: 900 }}>
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
        <div style={{ borderTop: '1px solid var(--gray-200)', borderBottom: '1px solid var(--gray-200)', height: '45vh', background: '#f8fafc' }}>
          <iframe
            srcDoc={getResultTemplate(patient, completedTests.filter(t => selectedIds.includes(t.testId)), org)}
            style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
            title="Result Preview"
          />
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
