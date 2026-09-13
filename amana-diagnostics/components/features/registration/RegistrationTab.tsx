import { useNotices } from '@/components/Notices';
import React, { useRef, useState, useEffect } from 'react';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { Patient, PatientProfile, ReferringDoctor, ReferringFacility, TestPrice, Test, BillingAccount } from '@/lib/store';
import { generateSlipNumber, addPatientWithReferral, addReferringDoctor, addReferringFacility, fetchReferringDoctors, fetchReferringFacilities, fetchPatients } from '@/lib/store';
import type { Organization } from '@/components/AuthProvider';
import PatientLookup from './PatientLookup';
import RegistrationForm from './RegistrationForm';
import ReferralSelection from './ReferralSelection';
import TestSearchPicker from './TestSearchPicker';
import TestSelection from './TestSelection';
import BillingSummary from './BillingSummary';
import QuickDoctorModal, { QuickDoctorForm } from './QuickDoctorModal';
import QuickFacilityModal, { QuickFacilityForm } from './QuickFacilityModal';
import { Card, CardBody, CardHeader } from '@/components/ui';

import styles from './registrationTab.module.css';
import {
  buildSelectedTestDetails, calculateSubtotal, calculateDiscountAmount,
  calculateTotalCommission, commissionForTest, paymentStatusFor, isReferralVisit,
} from '@/lib/store/registrationBilling';

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
  /** Opens the receipt-and-slip preview for the patient just registered. */
  setShowSlipModal: (patient: Patient) => void;
  /**
   * Called with the patient that was just saved, so the queue can show them at
   * once. Registration must not wait on a refetch to feel finished.
   */
  onRegistered: (patient: Patient) => void;
}

export default function RegistrationTab({
  patients, patientProfiles, doctors, setDoctors, facilities, setFacilities,
  testPrices, catalogue, billingAccounts, organization,
  setShowSlipModal, onRegistered
}: RegistrationTabProps) {
  const { notify } = useNotices();
  // Ephemeral UI state — domain state lives in useRegistrationStore
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
  const [quickDoctorForm, setQuickDoctorForm] = useState<QuickDoctorForm>({ name: '', phone: '', email: '', facility_id: '' });
  const [quickFacilityForm, setQuickFacilityForm] = useState<QuickFacilityForm>({ name: '', address: '', phone: '', email: '' });
  const [quickError, setQuickError] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  const [selectedPatientBillingAccountId, setSelectedPatientBillingAccountId] = useState<string | null>(null);
  const [checkoutBillingAccountId, setCheckoutBillingAccountId] = useState<string>('');
  const [linkedAccount, setLinkedAccount] = useState<BillingAccount | null>(null);

  const patientSearchRef = useRef<HTMLDivElement>(null);
  const doctorRef = useRef<HTMLDivElement>(null);
  const facilityRef = useRef<HTMLDivElement>(null);

  const {
    form, setForm, selectedTests, clearTests,
    discountType, setDiscount, discountValue,
    paymentMethod, setPaymentMethod, paidAmount, setPaidAmount,
  } = useRegistrationStore();

  // Close the comboboxes when clicking outside them
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (doctorRef.current && !doctorRef.current.contains(e.target as Node)) setShowDoctorDrop(false);
      if (facilityRef.current && !facilityRef.current.contains(e.target as Node)) setShowFacilityDrop(false);
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) setShowPatientSearchDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
  const selectedTestDetails = buildSelectedTestDetails(selectedTests, catalogue, testPrices);
  const subtotal = calculateSubtotal(selectedTestDetails);
  const discVal = parseFloat(discountValue) || 0;
  const discountAmount = calculateDiscountAmount(subtotal, discountType, discountValue);
  const netBill = Math.max(0, subtotal - discountAmount);

  // Auto-set paid amount if wallet is used
  useEffect(() => {
    if (paymentMethod === 'wallet') {
      setPaidAmount(netBill.toString());
    }
  }, [paymentMethod, netBill]);

  const amountPaidVal = paidAmount === '' ? netBill : (parseFloat(paidAmount) || 0);
  const balance = netBill - amountPaidVal;
  const paymentStatus = paymentStatusFor(amountPaidVal, netBill);

  const isReferral = isReferralVisit(selectedDoctorId, selectedFacilityId);
  const totalCommission = calculateTotalCommission(selectedTestDetails, isReferral);

  const handleSelectProfile = async (p: PatientProfile) => {
    // This patient's own visit history, fetched rather than filtered out of the
    // queue. The queue only holds the date window on screen, and a returning
    // patient's last visit is usually older than that — their age and their
    // wallet would silently fail to carry forward.
    let priorVisits: Patient[] = [];
    try {
      priorVisits = await fetchPatients(organization!.id, { patientProfileId: p.id });
    } catch (e) {
      console.warn('Could not load previous visits for this patient:', e);
    }

    const byNewestFirst = [...priorVisits].sort(
      (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime(),
    );
    const latestVisitForAge = byNewestFirst[0];

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

    // Losing this silently would charge a family's visit to cash instead of
    // their wallet, so it must come from the same unbounded history.
    const latestVisitWithWallet = byNewestFirst.find(v => v.billingAccountId);
    setSelectedPatientBillingAccountId(latestVisitWithWallet?.billingAccountId || null);

    setSelectedPatientProfileId(p.id);
    setPatientSearchQuery('');
    setShowPatientSearchDrop(false);
  };

  const handleClearLoadedPatient = () => {
    setLoadedPatientName('');
    setSelectedPatientBillingAccountId(null);
    setSelectedPatientProfileId(null);
    setForm({
      firstName: '', surname: '', middleName: '', age: '', sex: 'Male',
      phone: '', email: '', address: '', referredBy: '', referringFacility: ''
    });
  };

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
        notify('Please select a wallet account for payment.', 'error');
        return;
      }
      const acc = billingAccounts.find(a => a.id === checkoutBillingAccountId);
      if (!acc) {
        notify('Selected wallet account not found.', 'error');
        return;
      }
      if ((acc.balance + acc.credit_limit) < netBill) {
        notify(`Insufficient wallet balance on "${acc.name}". Available: ₦${(acc.balance + acc.credit_limit).toLocaleString('en-NG')}`, 'error');
        return;
      }
    }

    setSaving(true);

    try {
      const slipNumber = await generateSlipNumber(organization?.id || '');

      const tests = selectedTestDetails.map(t => ({
        testId: t.testId,
        testName: t.testName,
        department: t.department,
        status: 'pending' as const,
        specimen: t.specimen,
        price: t.price,
        commissionType: t.commissionType as any || 'none',
        commissionValue: t.commissionValue || 0,
        commissionAmount: commissionForTest(t, isReferral),
      }));

      const commissionTotal = tests.reduce((sum, t) => sum + (t.commissionAmount || 0), 0);

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
        commissionAssigned: isReferral && commissionTotal > 0,
        commissionType: isReferral && commissionTotal > 0 ? 'varies' : undefined,
        commissionValue: 0,
        commissionAmount: commissionTotal,
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

      const newId = await addPatientWithReferral(patientData, tests, organization?.id || '');

      const registered: Patient = {
        ...patientData,
        id: newId as number,
        tests: tests as any,
      };

      // Straight onto the queue, from what we already have in hand. Waiting for
      // a round trip here is what made a new patient appear only after a reload.
      onRegistered(registered);
      setShowSlipModal(registered);
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
      notify('Registration failed: ' + err.message, 'error');
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
    const acc = billingAccounts.find(a => a.id === selectedPatientBillingAccountId);
    setLinkedAccount(acc || null);
    if (acc) {
      setCheckoutBillingAccountId(acc.id);
      setPaymentMethod('wallet');
    }
  }, [selectedPatientBillingAccountId, billingAccounts, paymentMethod, setPaymentMethod]);

  return (
    <div className={styles.desk}>

      {/* Patient Form */}
      <Card raised aria-labelledby="registration-patient-panel">
        <CardHeader
          id="registration-patient-panel"
          title="Patient Information"
          subtitle="Enter patient biodata"
        />
        <CardBody>
          <div className={styles.fields}>
          <PatientLookup
            patientProfiles={patientProfiles}
            query={patientSearchQuery}
            setQuery={setPatientSearchQuery}
            showDrop={showPatientSearchDrop}
            setShowDrop={setShowPatientSearchDrop}
            loadedPatientName={loadedPatientName}
            selectedPatientProfileId={selectedPatientProfileId}
            onSelectProfile={handleSelectProfile}
            onClear={handleClearLoadedPatient}
            containerRef={patientSearchRef}
          />

          <RegistrationForm errors={errors} />

          <ReferralSelection
            doctors={doctors}
            facilities={facilities}
            errors={errors}
            selectedDoctorId={selectedDoctorId}
            setSelectedDoctorId={setSelectedDoctorId}
            doctorSearch={doctorSearch}
            setDoctorSearch={setDoctorSearch}
            showDoctorDrop={showDoctorDrop}
            setShowDoctorDrop={setShowDoctorDrop}
            doctorRef={doctorRef}
            onQuickAddDoctor={() => {
              setQuickDoctorForm({ name: '', phone: '', email: '', facility_id: selectedFacilityId && selectedFacilityId !== 'none' ? selectedFacilityId : '' });
              setQuickError('');
              setShowQuickDoctor(true);
            }}
            selectedFacilityId={selectedFacilityId}
            setSelectedFacilityId={setSelectedFacilityId}
            facilitySearch={facilitySearch}
            setFacilitySearch={setFacilitySearch}
            showFacilityDrop={showFacilityDrop}
            setShowFacilityDrop={setShowFacilityDrop}
            facilityRef={facilityRef}
            onQuickAddFacility={() => {
              setQuickFacilityForm({ name: '', address: '', phone: '', email: '' });
              setQuickError('');
              setShowQuickFacility(true);
            }}
          />

          <TestSearchPicker
            catalogue={catalogue}
            search={testSearch}
            setSearch={setTestSearch}
            error={errors.tests}
          />
          </div>
        </CardBody>
      </Card>

      {/* Selected Tests */}
      <Card raised className={styles.basket} aria-label="Selected tests">
        <TestSelection catalogue={catalogue} selectedTestDetails={selectedTestDetails} />

        {/* Checkout & Billing Panel */}
        {selectedTests.length > 0 && (
          <BillingSummary
            billingAccounts={billingAccounts}
            linkedAccount={linkedAccount}
            checkoutBillingAccountId={checkoutBillingAccountId}
            setCheckoutBillingAccountId={setCheckoutBillingAccountId}
            subtotal={subtotal}
            discountAmount={discountAmount}
            netBill={netBill}
            balance={balance}
            totalCommission={totalCommission}
            isReferral={isReferral}
            saving={saving}
            onRegister={handleRegister}
          />
        )}
      </Card>

      {showQuickDoctor && (
        <QuickDoctorModal
          form={quickDoctorForm}
          setForm={setQuickDoctorForm}
          facilities={facilities}
          error={quickError}
          saving={quickSaving}
          onSubmit={handleQuickDoctorSubmit}
          onClose={() => setShowQuickDoctor(false)}
        />
      )}

      {showQuickFacility && (
        <QuickFacilityModal
          form={quickFacilityForm}
          setForm={setQuickFacilityForm}
          error={quickError}
          saving={quickSaving}
          onSubmit={handleQuickFacilitySubmit}
          onClose={() => setShowQuickFacility(false)}
        />
      )}
    </div>
  );
}
