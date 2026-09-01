import React, { useRef, useState, useEffect } from 'react';
import { 
  RiHospitalLine, RiAddLine, RiClipboardLine, RiCheckLine, RiErrorWarningLine,
  RiTestTubeLine, RiRadarLine, RiMailOpenLine, RiFolderOpenLine, RiPrinterLine,
  RiFileTextLine, RiMoreLine, RiCloseLine, RiArrowUpSLine, RiArrowDownSLine, RiMailLine,
  RiUserHeartLine, RiSearchLine, RiMoneyDollarCircleLine, RiWalletLine, RiFolderUserLine,
} from '@remixicon/react';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { Patient, PatientProfile, ReferringDoctor, ReferringFacility, TestPrice, Test, BillingAccount } from '@/lib/store';
import { generateSlipNumber, addPatientWithReferral, addReferringDoctor, addReferringFacility, fetchReferringDoctors, fetchReferringFacilities } from '@/lib/store';
import type { Organization } from '@/components/AuthProvider';

const inputStyle = (error?: boolean) => ({
  width: '100%', padding: '0.65rem 1rem', borderRadius: 'var(--radius)',
  border: error ? '1px solid var(--red)' : '1px solid var(--gray-300)',
  fontSize: '0.82rem', fontFamily: 'var(--font-sans)', outline: 'none'
});

const closeBtn = { background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '0.4rem', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex' };
const dropItemStyle = { padding: '0.65rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)', transition: 'background 0.15s' };

function Field({ label, children, error, actionNode }: { label: string; children: React.ReactNode; error?: string; actionNode?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
        {actionNode}
      </div>
      {children}
      {error && <span style={{ color: 'var(--red)', fontSize: '0.7rem' }}>{error}</span>}
    </div>
  );
}

interface RegistrationTabProps {
  patients: Patient[];
  patientProfiles: PatientProfile[];
  doctors: ReferringDoctor[];
  setDoctors: React.Dispatch<React.SetStateAction<ReferringDoctor[]>>;
  facilities: ReferringFacility[];
  setFacilities: React.Dispatch<React.SetStateAction<ReferringFacility[]>>;
  testPrices: TestPrice[];
  catalogue: Test[];
  billingAccounts: BillingAccount[];
  organization: Organization | null;
  setShowSlipModal: React.Dispatch<React.SetStateAction<Patient | null>>;
}

export default function RegistrationTab({
  patients, patientProfiles, doctors, setDoctors, facilities, setFacilities,
  testPrices, catalogue, billingAccounts, organization,
  setShowSlipModal
}: RegistrationTabProps) {
  // Local state that wasn't moved to store
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [showPatientSearchDrop, setShowPatientSearchDrop] = useState(false);
  const [loadedPatientName, setLoadedPatientName] = useState('');
  const [selectedPatientProfileId, setSelectedPatientProfileId] = useState<number | null>(null);
  
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [facilitySearch, setFacilitySearch] = useState('');
  const [showDoctorDrop, setShowDoctorDrop] = useState(false);
  const [showFacilityDrop, setShowFacilityDrop] = useState(false);
  const [testSearch, setTestSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [showQuickDoctor, setShowQuickDoctor] = useState(false);
  const [showQuickFacility, setShowQuickFacility] = useState(false);
  const [quickDoctorForm, setQuickDoctorForm] = useState({ name: '', phone: '', email: '', facility_id: '' });
  const [quickFacilityForm, setQuickFacilityForm] = useState({ name: '', address: '', phone: '', email: '' });
  const [quickError, setQuickError] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  
  const [selectedPatientBillingAccountId, setSelectedPatientBillingAccountId] = useState<string | null>(null);
  const [checkoutBillingAccountId, setCheckoutBillingAccountId] = useState<string>('');
  const [linkedAccount, setLinkedAccount] = useState<BillingAccount | null>(null);
  
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const doctorRef = useRef<HTMLDivElement>(null);
  const facilityRef = useRef<HTMLDivElement>(null);

  const store = useRegistrationStore();
  const { form, setForm, selectedTests, addTest, removeTest, clearTests, discountType, setDiscount, discountValue, paymentMethod, setPaymentMethod, paidAmount, setPaidAmount } = store;

  const getTestById = (id: string) => catalogue.find(t => t.id === id);

  // Filter logic
  const filteredTests = catalogue.filter(test => {
    const q = testSearch.trim().toLowerCase();
    if (!q) return true;
    return [test.name, test.specimen, test.department, test.category].join(' ').toLowerCase().includes(q);
  });
  
  const toggleTest = (id: string) => {
    if (selectedTests.includes(id)) {
      removeTest(id);
    } else {
      addTest(id);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required';
    if (!form.surname.trim()) e.surname = 'Surname is required';
    if (!form.age.trim()) e.age = 'Age is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    const hasDoctor = !!selectedDoctorId || !!form.referredBy.trim();
    const hasFacility = !!selectedFacilityId || !!form.referringFacility.trim();
    if (!hasDoctor && !hasFacility) {
      e.referredBy = 'Either Referring doctor or facility is required';
      e.referringFacility = 'Either Referring doctor or facility is required';
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
  // Auto-set paid amount if wallet is used
  useEffect(() => {
    if (paymentMethod === 'wallet') {
      setPaidAmount(netBill.toString());
    }
  }, [paymentMethod, netBill]);
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
      setForm({ referredBy: `Dr. ${doc.name}` });

      if (doc.facility_id) {
        setSelectedFacilityId(doc.facility_id);
        const fac = facilities.find(f => f.id === doc.facility_id);
        if (fac) {
          setForm({ referringFacility: fac.name });
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
      setForm({ referringFacility: fac.name });

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

    if (paymentMethod === 'wallet') {
      if (!checkoutBillingAccountId) {
        alert('Please select a wallet account for payment.');
        return;
      }
      const acc = billingAccounts.find(a => a.id === checkoutBillingAccountId);
      if (!acc) {
        alert('Selected wallet account not found.');
        return;
      }
      if ((acc.balance + acc.credit_limit) < netBill) {
        alert(`Insufficient wallet balance on "${acc.name}". Available: ₦${(acc.balance + acc.credit_limit).toLocaleString('en-NG')}`);
        return;
      }
    }

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

      const patientData: Omit<Patient, 'id' | 'tests'> & { id?: number; patientProfileId?: number | null } = {
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
        billingAccountId: paymentMethod === 'wallet' ? checkoutBillingAccountId : (selectedPatientBillingAccountId || undefined),
        patientProfileId: selectedPatientProfileId || undefined,
      };

      await addPatientWithReferral(patientData, tests, organization?.id || '');

      const tempPatient: Patient = {
        id: 0,
        tests: tests as any,
        ...patientData
      };

      setShowSlipModal(tempPatient);
      setForm({ firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', email: '', address: '', referredBy: '', referringFacility: '' });
      clearTests();
      setSelectedDoctorId('');
      setSelectedFacilityId('');
      setDoctorSearch('');
      setFacilitySearch('');
      setLoadedPatientName('');
      setSelectedPatientBillingAccountId(null);
      setSelectedPatientProfileId(null);
      setPatientSearchQuery('');
      setDiscount('none', '');
      setPaidAmount('');
      setPaymentMethod('cash');
      setErrors({});
    } catch (err: any) {
      alert('Registration failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  

  // Handle wallet default selection
  useEffect(() => {
    if (!selectedPatientBillingAccountId) {
      setLinkedAccount(null);
      setCheckoutBillingAccountId('');
      if (paymentMethod === 'wallet') {
        setPaymentMethod('cash');
      }
      return;
    }
    const acc = billingAccounts.find((a: any) => a.id === selectedPatientBillingAccountId);
    setLinkedAccount(acc || null);
    if (acc) {
      setCheckoutBillingAccountId(acc.id);
      setPaymentMethod('wallet'); 
    }
  }, [selectedPatientBillingAccountId, billingAccounts, paymentMethod, setPaymentMethod]);

  return (
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
                      {patientProfiles
                        .filter(p => {
                          const q = patientSearchQuery.toLowerCase();
                          const fullName = `${p.firstName || ''} ${p.middleName || ''} ${p.surname || ''}`.toLowerCase();
                          const nameMatches = fullName.includes(q);
                          const phoneMatches = (p.phone || '').includes(q);
                          return nameMatches || phoneMatches;
                        })
                        .slice(0, 10)
                        .map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              const latestVisitForAge = patients
                                .filter(v => v.patientProfileId === p.id)
                                .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())[0];

                              setForm({
                                firstName: p.firstName || '',
                                surname: p.surname || '',
                                middleName: p.middleName || '',
                                age: latestVisitForAge?.age || '',
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
                              
                              const latestVisitWithWallet = patients
                                .filter(v => v.patientProfileId === p.id && v.billingAccountId)
                                .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())[0];
                              setSelectedPatientBillingAccountId(latestVisitWithWallet?.billingAccountId || null);
                              
                              setSelectedPatientProfileId(p.id);
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
                                  {p.phone} • {p.sex} • Patient ID: {p.id}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      {patientProfiles.filter(p => {
                        const q = patientSearchQuery.toLowerCase();
                        const fullName = `${p.firstName || ''} ${p.middleName || ''} ${p.surname || ''}`.toLowerCase();
                        const nameMatches = fullName.includes(q);
                        const phoneMatches = (p.phone || '').includes(q);
                        return nameMatches || phoneMatches;
                      }).length === 0 && (
                          <div style={{ padding: '0.75rem', color: 'var(--gray-400)', fontSize: '0.75rem', textAlign: 'center' }}>
                            No matching patient profiles found.
                          </div>
                        )}
                    </div>
                  )}
                </div>

                {loadedPatientName && (
                  <div style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-200)', padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--teal-800)', borderRadius: 'var(--radius)' }}>
                    <span>Loaded returning patient: <b>{loadedPatientName}</b> (Patient ID: {selectedPatientProfileId})</span>
                    <button
                      onClick={() => {
                        setLoadedPatientName('');
                        setSelectedPatientBillingAccountId(null);
                        setSelectedPatientProfileId(null);
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
                              setForm({ referredBy: 'Not referred by anyone', referringFacility: 'None / Walk-in' });
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
                              setForm({ referringFacility: 'None / Walk-in' });
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
                    onClick={() => clearTests()}
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

                  {/* Pay with Account Wallet Card */}
                  {linkedAccount && (
                    <div style={{
                      background: 'linear-gradient(135deg, var(--teal-50) 0%, #f0fdfa 100%)',
                      border: '1px solid var(--teal-200)',
                      borderRadius: 6,
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      boxShadow: '0 2px 8px rgba(13,148,136,0.04)',
                      marginBottom: '0.25rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--teal-800)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <RiWalletLine size={15} color="var(--teal-600)" /> Pay with Account Wallet
                        </span>
                        <span style={{
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'var(--teal-600)',
                          color: 'white',
                          textTransform: 'uppercase'
                        }}>
                          Linked
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.2rem' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{linkedAccount.name}</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--teal-700)' }}>
                          ₦{linkedAccount.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}

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
                        onChange={e => setDiscount(e.target.value as any, discountValue)}
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
                          onChange={e => setDiscount(discountType, e.target.value)}
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
                        onChange={e => {
                          setPaymentMethod(e.target.value);
                          if (e.target.value === 'wallet' && !checkoutBillingAccountId && billingAccounts.length > 0) {
                            // select first wallet by default if not set
                            setCheckoutBillingAccountId(billingAccounts[0].id);
                          }
                        }}
                      >
                        <option value="cash">Cash</option>
                        <option value="pos">POS</option>
                        <option value="transfer">Bank Transfer</option>
                        <option value="split">Split Payment</option>
                        <option value="wallet">Account Wallet</option>
                      </select>

                      {paymentMethod === 'wallet' && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '0.15rem' }}>Select Wallet Account</label>
                          <select
                            style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                            value={checkoutBillingAccountId}
                            onChange={e => setCheckoutBillingAccountId(e.target.value)}
                          >
                            <option value="">-- Choose Wallet --</option>
                            {billingAccounts.map(acc => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} (Bal: ₦{acc.balance.toLocaleString('en-NG')})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {paymentMethod === 'wallet' && checkoutBillingAccountId && (() => {
                        const acc = billingAccounts.find(a => a.id === checkoutBillingAccountId);
                        if (!acc) return null;
                        const isSufficient = (acc.balance + acc.credit_limit) >= netBill;
                        return (
                          <div style={{
                            fontSize: '0.7rem',
                            color: !isSufficient ? 'var(--red)' : '#27ae60',
                            fontWeight: 600,
                            marginTop: '0.25rem'
                          }}>
                            {!isSufficient ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <RiErrorWarningLine size={14} color="var(--red)" /> Insufficient Wallet Balance! Max credit allowed: ₦{(acc.balance + acc.credit_limit).toLocaleString('en-NG')}
                              </span>
                            ) : (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <RiCheckLine size={14} color="#27ae60" /> Wallet Balance covers invoice amount.
                              </span>
                            )}
                          </div>
                        );
                      })()}
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
  );
}
