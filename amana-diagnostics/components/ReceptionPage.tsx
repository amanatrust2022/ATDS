'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RiHospitalLine, RiAddLine, RiClipboardLine, RiCheckLine, RiErrorWarningLine,
  RiTestTubeLine, RiRadarLine, RiMailOpenLine, RiFolderOpenLine, RiPrinterLine,
  RiFileTextLine, RiMoreLine, RiCloseLine, RiArrowUpSLine, RiArrowDownSLine, RiMailLine,
  RiUserHeartLine, RiSearchLine, RiMoneyDollarCircleLine, RiWalletLine, RiFolderUserLine,
} from '@remixicon/react';
import Header from '@/components/Header';
import RegistrationTab from './features/registration/RegistrationTab';
import WalletTab from './features/wallet/WalletTab';
import { QueueTab } from './features/queue/QueueTab';
import { ResultsTab } from './features/queue/ResultsTab';
import {
  Patient, PatientTest, TEST_CATALOGUE, getTestById, fetchPatients, addPatient, generateSlipNumber, subscribeToPatients,
  ReferringDoctor, ReferringFacility, TestPrice,
  fetchReferringDoctors, fetchReferringFacilities, fetchTestPrices,
  addPatientWithReferral, addReferringDoctor, addReferringFacility,
  fetchCustomTests, setCustomCatalogueCache, Test,
  BillingAccount, BillingLedgerTransaction, ExternalDepartmentCharge,
  fetchBillingAccounts, fetchPatientWallet, createBillingAccount, depositToBillingAccount, logExternalCharge, fetchAccountLedger, fetchExternalCharges,
  updatePatientBillingAccount, registerPatientAndGetId,
  PatientProfile, fetchPatientProfiles
} from '@/lib/store';
import { getResultTemplate, getSlipTemplate, getInvoiceTemplate, getLedgerStatementTemplate, printHtml } from '@/lib/templates';
import { useAuth } from '@/components/AuthProvider';
import { RiLogoutCircleLine } from '@remixicon/react';

type Tab = 'register' | 'queue' | 'results' | 'wallet';

export default function ReceptionPage() {
  const [tab, setTab] = useState<Tab>('register');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientProfiles, setPatientProfiles] = useState<PatientProfile[]>([]);
  const [selectedPatientProfileId, setSelectedPatientProfileId] = useState<number | null>(null);

  // Searchable dropdown states for open billing account modal
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerSearchPage, setOwnerSearchPage] = useState(0);
  const [showOwnerSearchDrop, setShowOwnerSearchDrop] = useState(false);
  const ownerSearchRef = useRef<HTMLDivElement>(null);

  const [depSearchQuery, setDepSearchQuery] = useState('');
  const [depSearchPage, setDepSearchPage] = useState(0);
  const [showDepSearchDrop, setShowDepSearchDrop] = useState(false);
  const depSearchRef = useRef<HTMLDivElement>(null);
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

  // Billing and wallet states
  const [billingAccounts, setBillingAccounts] = useState<BillingAccount[]>([]);
  const [externalCharges, setExternalCharges] = useState<ExternalDepartmentCharge[]>([]);
  const [selectedPatientBillingAccountId, setSelectedPatientBillingAccountId] = useState<string | null>(null);
  const [linkedAccount, setLinkedAccount] = useState<BillingAccount | null>(null);
  const [checkoutBillingAccountId, setCheckoutBillingAccountId] = useState<string>('');

  // Modals & search
  const [showBillingAccountModal, setShowBillingAccountModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState<BillingAccount | null>(null);
  const [showLogExpenseModal, setShowLogExpenseModal] = useState(false);
  const [billingSearchQuery, setBillingSearchQuery] = useState('');
  const [billingTransactions, setBillingTransactions] = useState<BillingLedgerTransaction[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [editCreditLimit, setEditCreditLimit] = useState<string | null>(null);

  // Forms
  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'individual' as 'individual' | 'family' | 'corporate',
    creditLimit: '0',
    initialDeposit: '0',
    paymentMethod: 'cash',
    ownerId: '',
    linkedIds: [] as (number | string)[]
  });

  const [expenseForm, setExpenseForm] = useState({
    patientId: '',
    department: 'pharmacy',
    receiptNumber: '',
    amount: '',
    paymentMethod: 'cash',
    description: '',
    billingAccountId: ''
  });

  const [isOwnerNew, setIsOwnerNew] = useState(false);
  const [newOwnerForm, setNewOwnerForm] = useState({
    firstName: '',
    surname: '',
    middleName: '',
    age: '',
    sex: 'Male' as 'Male' | 'Female',
    phone: '',
    address: ''
  });

  const [newDependentsToRegister, setNewDependentsToRegister] = useState<Array<{
    firstName: string;
    surname: string;
    middleName: string;
    age: string;
    sex: 'Male' | 'Female';
    phone: string;
    address: string;
  }>>([]);

  // Workspace specific states
  const [workspaceTab, setWorkspaceTab] = useState<'members' | 'ledger' | 'charges'>('members');
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showQuickRegisterDep, setShowQuickRegisterDep] = useState(false);
  const [existingPatientToLink, setExistingPatientToLink] = useState('');

  const [workspaceDepForm, setWorkspaceDepForm] = useState({
    firstName: '',
    surname: '',
    middleName: '',
    age: '',
    sex: 'Male' as 'Male' | 'Female',
    phone: '',
    address: ''
  });

  // Log expense form in workspace
  const [showWorkspaceLogExpense, setShowWorkspaceLogExpense] = useState(false);
  const [workspaceExpenseForm, setWorkspaceExpenseForm] = useState({
    patientId: '',
    department: 'pharmacy',
    receiptNumber: '',
    amount: '',
    paymentMethod: 'wallet',
    description: ''
  });

  const { profile, organization, signOut } = useAuth();
  const refresh = useCallback(async () => {
    if (!organization?.id) return;
    try {
      const [data, profiles, accs, charges] = await Promise.all([
        fetchPatients(organization.id),
        fetchPatientProfiles(organization.id),
        fetchBillingAccounts(organization.id),
        fetchExternalCharges(organization.id)
      ]);
      setPatients(data);
      setPatientProfiles(profiles);
      setBillingAccounts(accs);
      setExternalCharges(charges as any[]);
    } catch (e) {
      console.warn('Failed to load data:', e);
    }
  }, [organization?.id]);

  // ─── BILLING WORKFLOWS ───────────────────────────────────────────────────────

  const handleCreateBillingAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.name.trim() && !isOwnerNew) return alert('Please enter account name');

    setSaving(true);
    try {
      let finalOwnerId: number | string = accountForm.ownerId;
      let finalAccountName = accountForm.name.trim();

      // 1. If owner is brand new, register them first!
      if (isOwnerNew) {
        if (!newOwnerForm.firstName.trim() || !newOwnerForm.surname.trim()) {
          throw new Error('Please fill in new owner first name and surname');
        }
        const slipNumber = await generateSlipNumber(organization?.id || '');
        const patientData = {
          slipNumber,
          registeredAt: new Date().toISOString(),
          name: [newOwnerForm.firstName, newOwnerForm.middleName, newOwnerForm.surname].filter(Boolean).join(' '),
          firstName: newOwnerForm.firstName.trim(),
          surname: newOwnerForm.surname.trim(),
          middleName: newOwnerForm.middleName.trim(),
          age: newOwnerForm.age.trim(),
          sex: newOwnerForm.sex,
          phone: newOwnerForm.phone.trim(),
          address: newOwnerForm.address.trim()
        };
        finalOwnerId = await registerPatientAndGetId(patientData as any, organization?.id || '');
        finalAccountName = finalAccountName || `${newOwnerForm.firstName} ${newOwnerForm.surname} Wallet`;
      }

      if (!finalOwnerId) {
        throw new Error('Owner is required');
      }

      // 2. Register any brand new dependents!
      const newlyRegisteredDependentIds: (number | string)[] = [];
      for (const nd of newDependentsToRegister) {
        if (!nd.firstName.trim() || !nd.surname.trim()) {
          throw new Error('Please fill in all dependents first name and surname');
        }
        const slipNumber = await generateSlipNumber(organization?.id || '');
        const dependentData = {
          slipNumber,
          registeredAt: new Date().toISOString(),
          name: [nd.firstName, nd.middleName, nd.surname].filter(Boolean).join(' '),
          firstName: nd.firstName.trim(),
          surname: nd.surname.trim(),
          middleName: nd.middleName.trim(),
          age: nd.age.trim(),
          sex: nd.sex,
          phone: nd.phone.trim(),
          address: nd.address.trim()
        };
        const newDepId = await registerPatientAndGetId(dependentData as any, organization?.id || '');
        newlyRegisteredDependentIds.push(newDepId);
      }

      // 3. Combine linked dependents (existing + new)
      const combinedLinkedIds = Array.from(new Set([
        ...accountForm.linkedIds,
        ...newlyRegisteredDependentIds
      ]));

      const payload = {
        organization_id: organization?.id || '',
        name: finalAccountName,
        owner_patient_id: finalOwnerId,
        credit_limit: parseFloat(accountForm.creditLimit) || 0.0,
        type: accountForm.type
      };

      const depositVal = parseFloat(accountForm.initialDeposit) || 0.0;

      await createBillingAccount(
        payload,
        depositVal,
        accountForm.paymentMethod,
        combinedLinkedIds,
        profile?.full_name || 'Staff'
      );

      alert('Billing account created successfully');
      setShowBillingAccountModal(false);
      setIsOwnerNew(false);
      setNewDependentsToRegister([]);
      setNewOwnerForm({ firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', address: '' });
      refresh();
    } catch (err: any) {
      alert('Failed to create account: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('cash');
  const [depositNotes, setDepositNotes] = useState('');
  const [depositing, setDepositing] = useState(false);

  const handleDepositSubmit = async (accountId: string) => {
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return alert('Please enter a valid deposit amount');

    setDepositing(true);
    try {
      await depositToBillingAccount(
        accountId,
        amt,
        depositNotes.trim() || 'Top-up deposit',
        depositMethod,
        profile?.full_name || 'Staff',
        organization?.id || '',
        undefined
      );

      alert('Deposit processed successfully');
      setDepositAmount('');
      setDepositNotes('');

      // Reload ledger and refresh accounts
      const txs = await fetchAccountLedger(accountId);
      setBillingTransactions(txs);

      const accs = await fetchBillingAccounts(organization?.id || '');
      setBillingAccounts(accs);
      // update selected ledger account if open
      const updatedAcc = accs.find(a => a.id === accountId);
      if (updatedAcc) {
        setShowLedgerModal(updatedAcc);
      }
    } catch (err: any) {
      alert('Deposit failed: ' + err.message);
    } finally {
      setDepositing(false);
    }
  };

  const handleLogExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.patientId) return alert('Please select a patient');
    if (!expenseForm.receiptNumber.trim()) return alert('Please enter a receipt number');
    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) return alert('Please enter a valid amount');

    setSaving(true);
    try {
      const selectedPatient = patients.find(p => p.id === Number(expenseForm.patientId));
      const bAccountId = selectedPatient?.billingAccountId || null;

      const chargePayload = {
        organizationId: organization?.id || '',
        patientId: expenseForm.patientId,
        billingAccountId: expenseForm.paymentMethod === 'wallet' ? bAccountId || undefined : undefined,
        department: expenseForm.department,
        receiptNumber: expenseForm.receiptNumber.trim(),
        amount: amt,
        paymentMethod: expenseForm.paymentMethod,
        status: 'paid' as const,
        description: expenseForm.description.trim() || undefined,
        createdBy: profile?.full_name || 'Staff'
      };

      await logExternalCharge(chargePayload);
      alert('Department charge logged successfully');
      setShowLogExpenseModal(false);
      refresh();
    } catch (err: any) {
      alert('Logging failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Load ledger transactions and reset workspace states when modal opens
  useEffect(() => {
    if (showLedgerModal) {
      setLoadingLedger(true);
      fetchAccountLedger(showLedgerModal.id)
        .then(txs => setBillingTransactions(txs))
        .catch(err => console.error(err))
        .finally(() => setLoadingLedger(false));

      setWorkspaceTab('members');
      setShowAddExisting(false);
      setShowQuickRegisterDep(false);
      setShowWorkspaceLogExpense(false);
      setExistingPatientToLink('');
    } else {
      setBillingTransactions([]);
    }
  }, [showLedgerModal]);

  // Sync wallet details for current checkout patient & set default payment method
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
      setPaymentMethod('wallet'); // Set wallet as default payment method!
    }
  }, [selectedPatientBillingAccountId, billingAccounts]);

  const handleLinkExistingDependent = async (accountId: string) => {
    if (!existingPatientToLink) return;
    try {
      await updatePatientBillingAccount(existingPatientToLink, accountId);
      alert('Patient linked successfully');
      setExistingPatientToLink('');
      setShowAddExisting(false);
      refresh();
    } catch (err: any) {
      alert('Failed to link patient: ' + err.message);
    }
  };

  const handleUnlinkDependent = async (patientId: number | string) => {
    if (!confirm('Are you sure you want to unlink this dependent from this wallet account?')) return;
    try {
      await updatePatientBillingAccount(patientId, null);
      alert('Patient unlinked successfully');
      refresh();
    } catch (err: any) {
      alert('Failed to unlink patient: ' + err.message);
    }
  };

  const handleQuickRegisterDependentSubmit = async (e: React.FormEvent, accountId: string) => {
    e.preventDefault();
    if (!workspaceDepForm.firstName.trim() || !workspaceDepForm.surname.trim()) {
      return alert('First Name and Surname are required');
    }

    setSaving(true);
    try {
      const slipNumber = await generateSlipNumber(organization?.id || '');
      const patientData = {
        slipNumber,
        registeredAt: new Date().toISOString(),
        name: [workspaceDepForm.firstName, workspaceDepForm.middleName, workspaceDepForm.surname].filter(Boolean).join(' '),
        firstName: workspaceDepForm.firstName.trim(),
        surname: workspaceDepForm.surname.trim(),
        middleName: workspaceDepForm.middleName.trim(),
        age: workspaceDepForm.age.trim(),
        sex: workspaceDepForm.sex,
        phone: workspaceDepForm.phone.trim(),
        address: workspaceDepForm.address.trim(),
        billingAccountId: accountId
      };

      await registerPatientAndGetId(patientData as any, organization?.id || '');
      alert('Dependent registered and linked successfully');

      setWorkspaceDepForm({
        firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', address: ''
      });
      setShowQuickRegisterDep(false);
      refresh();
    } catch (err: any) {
      alert('Failed to register dependent: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleWorkspaceExpenseSubmit = async (e: React.FormEvent, accountId: string) => {
    e.preventDefault();
    if (!workspaceExpenseForm.patientId) return alert('Please select a member');
    if (!workspaceExpenseForm.receiptNumber.trim()) return alert('Please enter a receipt number');
    const amt = parseFloat(workspaceExpenseForm.amount);
    if (isNaN(amt) || amt <= 0) return alert('Please enter a valid amount');

    setSaving(true);
    try {
      const chargePayload = {
        organizationId: organization?.id || '',
        patientId: workspaceExpenseForm.patientId,
        billingAccountId: workspaceExpenseForm.paymentMethod === 'wallet' ? accountId : undefined,
        department: workspaceExpenseForm.department,
        receiptNumber: workspaceExpenseForm.receiptNumber.trim(),
        amount: amt,
        paymentMethod: workspaceExpenseForm.paymentMethod,
        status: 'paid' as const,
        description: workspaceExpenseForm.description.trim() || undefined,
        createdBy: profile?.full_name || 'Staff'
      };

      await logExternalCharge(chargePayload);
      alert('Department charge logged successfully');

      setWorkspaceExpenseForm({
        patientId: '', department: 'pharmacy', receiptNumber: '', amount: '', paymentMethod: 'wallet', description: ''
      });
      setShowWorkspaceLogExpense(false);

      // Refresh charges & ledger list
      const txs = await fetchAccountLedger(accountId);
      setBillingTransactions(txs);
      refresh();
    } catch (err: any) {
      alert('Logging failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };


  const handlePrintStatement = (account: BillingAccount) => {
    const members = patients.filter(p => p.billingAccountId === account.id);
    const html = getLedgerStatementTemplate(account, billingTransactions, members, organization as any);
    printHtml(html);
  };

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
          // If a custom test with the same ID is inactive, we keep the existing default test
          if (ct.is_active !== false) {
            merged[idx] = ct; // Replace with active custom test
          }
        } else if (ct.is_active !== false) {
          // Add new custom test only if it is active
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
      if (ownerSearchRef.current && !ownerSearchRef.current.contains(e.target as Node)) setShowOwnerSearchDrop(false);
      if (depSearchRef.current && !depSearchRef.current.contains(e.target as Node)) setShowDepSearchDrop(false);
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
      setSelectedTests([]);
      setSelectedDoctorId('');
      setSelectedFacilityId('');
      setDoctorSearch('');
      setFacilitySearch('');
      setLoadedPatientName('');
      setSelectedPatientBillingAccountId(null);
      setSelectedPatientProfileId(null);
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
          { id: 'wallet', label: 'Patient Wallet', icon: < RiWalletLine size={18} /> },
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
          <RegistrationTab 
            patients={patients}
            patientProfiles={patientProfiles}
            doctors={doctors}
            setDoctors={setDoctors}
            facilities={facilities}
            setFacilities={setFacilities}
            testPrices={testPrices}
            catalogue={catalogue}
            billingAccounts={billingAccounts}
            organization={organization}
            setShowSlipModal={setShowSlipModal}
          />
        )}

        {/* ===== QUEUE TAB ===== */}
        {tab === 'queue' && (
          <QueueTab
            patients={patients}
            onViewSlip={(p: any) => setShowSlipModal(p)}
            onViewResult={(p: any) => setShowResultModal(p)}
          />
        )}
        
        {/* ===== RESULTS TAB ===== */}
        {tab === 'results' && (
          <ResultsTab
            patients={patients}
            onViewSlip={(p: any) => setShowSlipModal(p)}
            onViewResult={(p: any) => setShowResultModal(p)}
          />
        )}

        {tab === 'wallet' && (
          <div>
            {/* Main Action Hub Card */}
            <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <RiFolderUserLine size={20} color="var(--teal-600)" /> Client Accounts
                  </h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.15rem' }}>Manage individual and family group deposit wallets, link dependents, and log department bills.</p>
                </div>
                <div>
                  <button
                    onClick={() => {
                      setAccountForm({
                        name: '',
                        type: 'individual',
                        creditLimit: '0',
                        initialDeposit: '0',
                        paymentMethod: 'cash',
                        ownerId: '',
                        linkedIds: []
                      });
                      setIsOwnerNew(false);
                      setNewDependentsToRegister([]);
                      setNewOwnerForm({ firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', address: '' });
                      setOwnerSearchQuery('');
                      setOwnerSearchPage(0);
                      setShowOwnerSearchDrop(false);
                      setDepSearchQuery('');
                      setDepSearchPage(0);
                      setShowDepSearchDrop(false);
                      setShowBillingAccountModal(true);
                    }}
                    style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.5rem 1rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s' }}
                  >
                    <RiAddLine size={16} /> Open Billing Account
                  </button>
                </div>
              </div>

              {/* Accounts Directory */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', maxWidth: 400 }}>
                <input
                  value={billingSearchQuery}
                  onChange={e => setBillingSearchQuery(e.target.value)}
                  placeholder="Search billing accounts..."
                  style={inputStyle(false)}
                />
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', background: 'white' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Name</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Owner</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Wallet Balance</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credit Limit</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--gray-600)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingAccounts
                      .filter(acc => acc.name.toLowerCase().includes(billingSearchQuery.toLowerCase()))
                      .map(acc => {
                        const owner = patients.find(p => p.id === Number(acc.owner_patient_id));
                        const ownerName = owner ? `${owner.firstName} ${owner.surname}` : 'Unknown';
                        return (
                          <tr key={acc.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--gray-900)' }}>{acc.name}</td>
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--gray-600)' }}>{ownerName}</td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span style={{
                                textTransform: 'capitalize', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                background: acc.type === 'family' ? '#eff6ff' : acc.type === 'corporate' ? '#faf5ff' : '#f0fdf4',
                                color: acc.type === 'family' ? '#1d4ed8' : acc.type === 'corporate' ? '#6b21a8' : '#166534'
                              }}>
                                {acc.type}
                              </span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: acc.balance >= 0 ? '#166534' : '#991b1b' }}>
                              ₦{acc.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--gray-600)' }}>
                              ₦{(acc.credit_limit || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                              <button
                                onClick={() => setShowLedgerModal(acc)}
                                style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '0.35rem 0.65rem', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.15s' }}
                              >
                                Manage Account
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    {billingAccounts.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--gray-400)' }}>No billing wallets registered. Click "Open Billing Account" to register family/individual accounts.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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

      {/* Billing Wallets & Accounts Modals */}
      {showBillingAccountModal && (
        <div style={modalOverlay}>
          <form 
            onSubmit={handleCreateBillingAccountSubmit} 
            style={{ 
              ...modalBox, 
              maxWidth: 550, 
              maxHeight: '90vh', 
              display: 'flex', 
              flexDirection: 'column',
              margin: 'auto'
            }}
          >
            <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Open Billing Account</h2>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', marginTop: '0.15rem' }}>Create individual or family deposit wallet</p>
              </div>
              <button type="button" onClick={() => setShowBillingAccountModal(false)} style={closeBtn}>
                <RiCloseLine size={16} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', background: 'white', overflowY: 'auto', flex: 1 }}>
              <Field label="Account Name *">
                <input
                  required
                  style={inputStyle(false)}
                  placeholder="e.g. Bello Family Wallet"
                  value={accountForm.name}
                  onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Account Type">
                  <select
                    style={inputStyle(false)}
                    value={accountForm.type}
                    onChange={e => setAccountForm({ ...accountForm, type: e.target.value as any })}
                  >
                    <option value="individual">Individual</option>
                    <option value="family">Family Group</option>
                    <option value="corporate">Corporate Retainer</option>
                  </select>
                </Field>
                <Field label="Credit Limit (₦)">
                  <input
                    type="number"
                    min="0"
                    style={inputStyle(false)}
                    value={accountForm.creditLimit}
                    onChange={e => setAccountForm({ ...accountForm, creditLimit: e.target.value })}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Initial Deposit (₦)">
                  <input
                    type="number"
                    min="0"
                    style={inputStyle(false)}
                    value={accountForm.initialDeposit}
                    onChange={e => setAccountForm({ ...accountForm, initialDeposit: e.target.value })}
                  />
                </Field>
                <Field label="Deposit Method">
                  <select
                    style={inputStyle(false)}
                    value={accountForm.paymentMethod}
                    disabled={parseFloat(accountForm.initialDeposit) <= 0}
                    onChange={e => setAccountForm({ ...accountForm, paymentMethod: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="pos">POS</option>
                    <option value="transfer">Bank Transfer</option>
                  </select>
                </Field>
              </div>

              {/* Account Owner Selection Toggle */}
              <div 
                onClick={() => {
                  setIsOwnerNew(!isOwnerNew);
                  setAccountForm(prev => ({ ...prev, ownerId: '', name: '' }));
                  setOwnerSearchQuery('');
                }}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  padding: '0.75rem 1rem', 
                  background: isOwnerNew ? '#f0fdfa' : 'var(--gray-50)', 
                  border: isOwnerNew ? '1px solid var(--teal-300)' : '1px solid var(--gray-200)', 
                  borderRadius: '6px', 
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  userSelect: 'none',
                  marginTop: '0.25rem'
                }}
              >
                <input
                  type="checkbox"
                  checked={isOwnerNew}
                  readOnly
                  style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--teal-700)', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isOwnerNew ? 'var(--teal-900)' : 'var(--gray-800)' }}>
                    Register a New Patient as Account Owner
                  </div>
                  <div style={{ fontSize: '0.68rem', color: isOwnerNew ? 'var(--teal-700)' : 'var(--gray-500)', marginTop: '0.1rem' }}>
                    Toggle this on if the primary account owner is not registered yet.
                  </div>
                </div>
              </div>

              {!isOwnerNew ? (
                <Field label="Account Owner (Primary Patient) *">
                  <div ref={ownerSearchRef} style={{ position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                      <RiSearchLine size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                      <input
                        style={{ ...inputStyle(false), paddingLeft: 30 }}
                        placeholder="Search patient by name or phone..."
                        value={ownerSearchQuery}
                        onChange={e => {
                          setOwnerSearchQuery(e.target.value);
                          setOwnerSearchPage(0);
                          setShowOwnerSearchDrop(true);
                        }}
                        onFocus={() => setShowOwnerSearchDrop(true)}
                      />
                    </div>
                    {/* Selected Owner Tag */}
                    {accountForm.ownerId && (() => {
                      const owner = patients.find(x => x.id === Number(accountForm.ownerId));
                      if (!owner) return null;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', marginTop: '0.35rem', background: '#f0fdfa', border: '1px solid var(--teal-200)', borderRadius: 4, fontSize: '0.75rem' }}>
                          <span style={{ color: 'var(--teal-800)' }}>Selected Owner: <b>{owner.firstName} {owner.surname}</b> ({owner.phone})</span>
                          <button
                            type="button"
                            onClick={() => setAccountForm({ ...accountForm, ownerId: '', name: '' })}
                            style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem' }}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })()}
                    
                    {showOwnerSearchDrop && ownerSearchQuery.trim().length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--gray-300)', zIndex: 70, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: 4, marginTop: '0.25rem', overflow: 'hidden' }}>
                        <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                          {(() => {
                            const filtered = patients.filter(p => {
                              const q = ownerSearchQuery.toLowerCase();
                              return `${p.firstName} ${p.middleName || ''} ${p.surname}`.toLowerCase().includes(q) || (p.phone || '').includes(q);
                            });
                            const PAGE_SIZE = 5;
                            const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                            const paginated = filtered.slice(ownerSearchPage * PAGE_SIZE, (ownerSearchPage + 1) * PAGE_SIZE);
                            
                            return (
                              <>
                                {paginated.map(p => (
                                  <div
                                    key={p.id}
                                    onClick={() => {
                                      setAccountForm({
                                        ...accountForm,
                                        ownerId: String(p.id),
                                        name: `${p.firstName} ${p.surname} Wallet`
                                      });
                                      setShowOwnerSearchDrop(false);
                                      setOwnerSearchQuery('');
                                    }}
                                    style={dropItemStyle}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-50)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-900)' }}>{p.firstName} {p.middleName} {p.surname}</div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>{p.phone} • Slip: {p.slipNumber}</div>
                                  </div>
                                ))}
                                {filtered.length === 0 && (
                                  <div style={{ padding: '0.75rem', color: 'var(--gray-400)', fontSize: '0.72rem', textAlign: 'center' }}>No patients found.</div>
                                )}
                                {totalPages > 1 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)', fontSize: '0.7rem' }}>
                                    <button
                                      type="button"
                                      disabled={ownerSearchPage === 0}
                                      onClick={() => setOwnerSearchPage(prev => Math.max(0, prev - 1))}
                                      style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      Prev
                                    </button>
                                    <span>Page {ownerSearchPage + 1} of {totalPages}</span>
                                    <button
                                      type="button"
                                      disabled={ownerSearchPage >= totalPages - 1}
                                      onClick={() => setOwnerSearchPage(prev => Math.min(totalPages - 1, prev + 1))}
                                      style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      Next
                                    </button>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </Field>
              ) : (
                <div style={{ border: '1px solid var(--teal-100)', padding: '0.75rem', borderRadius: 6, background: '#f0fdfa', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--teal-800)' }}>New Owner Registration</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <input required placeholder="First Name *" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.firstName} onChange={e => setNewOwnerForm({ ...newOwnerForm, firstName: e.target.value })} />
                    <input required placeholder="Surname *" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.surname} onChange={e => setNewOwnerForm({ ...newOwnerForm, surname: e.target.value })} />
                    <input placeholder="Middle Name" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.middleName} onChange={e => setNewOwnerForm({ ...newOwnerForm, middleName: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <input required placeholder="Age *" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.age} onChange={e => setNewOwnerForm({ ...newOwnerForm, age: e.target.value })} />
                    <select style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.sex} onChange={e => setNewOwnerForm({ ...newOwnerForm, sex: e.target.value as any })}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    <input placeholder="Phone" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.phone} onChange={e => setNewOwnerForm({ ...newOwnerForm, phone: e.target.value })} />
                  </div>
                  <input placeholder="Address" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={newOwnerForm.address} onChange={e => setNewOwnerForm({ ...newOwnerForm, address: e.target.value })} />
                </div>
              )}

              {accountForm.type !== 'individual' && (
                <div>
                  <Field label="Link Dependents (Select Existing Members)">
                    <div ref={depSearchRef} style={{ position: 'relative' }}>
                      <div style={{ position: 'relative' }}>
                        <RiSearchLine size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                        <input
                          style={{ ...inputStyle(false), paddingLeft: 30 }}
                          placeholder="Search existing members to link as dependents..."
                          value={depSearchQuery}
                          onChange={e => {
                            setDepSearchQuery(e.target.value);
                            setDepSearchPage(0);
                            setShowDepSearchDrop(true);
                          }}
                          onFocus={() => setShowDepSearchDrop(true)}
                        />
                      </div>
                      
                      {showDepSearchDrop && depSearchQuery.trim().length > 0 && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--gray-300)', zIndex: 70, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: 4, marginTop: '0.25rem', overflow: 'hidden' }}>
                          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                            {(() => {
                              const filtered = patients.filter(p => {
                                if (p.id === Number(accountForm.ownerId)) return false;
                                if (accountForm.linkedIds.includes(p.id)) return false;
                                const q = depSearchQuery.toLowerCase();
                                return `${p.firstName} ${p.middleName || ''} ${p.surname}`.toLowerCase().includes(q) || (p.phone || '').includes(q);
                              });
                              const PAGE_SIZE = 5;
                              const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
                              const paginated = filtered.slice(depSearchPage * PAGE_SIZE, (depSearchPage + 1) * PAGE_SIZE);
                              
                              return (
                                <>
                                  {paginated.map(p => (
                                    <div
                                      key={p.id}
                                      onClick={() => {
                                        setAccountForm({
                                          ...accountForm,
                                          linkedIds: [...accountForm.linkedIds, p.id]
                                        });
                                        setShowDepSearchDrop(false);
                                        setDepSearchQuery('');
                                      }}
                                      style={dropItemStyle}
                                      onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-50)'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-900)' }}>{p.firstName} {p.middleName} {p.surname}</div>
                                      <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>{p.phone} • Slip: {p.slipNumber}</div>
                                    </div>
                                  ))}
                                  {filtered.length === 0 && (
                                    <div style={{ padding: '0.75rem', color: 'var(--gray-400)', fontSize: '0.72rem', textAlign: 'center' }}>No patients found.</div>
                                  )}
                                  {totalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)', fontSize: '0.7rem' }}>
                                      <button
                                        type="button"
                                        disabled={depSearchPage === 0}
                                        onClick={() => setDepSearchPage(prev => Math.max(0, prev - 1))}
                                        style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Prev
                                      </button>
                                      <span>Page {depSearchPage + 1} of {totalPages}</span>
                                      <button
                                        type="button"
                                        disabled={depSearchPage >= totalPages - 1}
                                        onClick={() => setDepSearchPage(prev => Math.min(totalPages - 1, prev + 1))}
                                        style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}
                                      >
                                        Next
                                      </button>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Linked Dependents Tag List */}
                    {accountForm.linkedIds.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-600)' }}>Selected Dependents ({accountForm.linkedIds.length}):</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {accountForm.linkedIds.map(id => {
                            const dep = patients.find(x => x.id === Number(id));
                            if (!dep) return null;
                            return (
                              <div key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '3px 8px', background: 'var(--gray-100)', border: '1px solid var(--gray-300)', borderRadius: 12, fontSize: '0.72rem', color: 'var(--gray-700)' }}>
                                <span>{dep.firstName} {dep.surname}</span>
                                <button
                                  type="button"
                                  onClick={() => setAccountForm({ ...accountForm, linkedIds: accountForm.linkedIds.filter(x => x !== id) })}
                                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 0, fontWeight: 700, display: 'flex' }}
                                >
                                  <RiCloseLine size={12} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Field>

                  {/* Register New Dependents */}
                  <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--gray-100)', paddingTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-800)' }}>Register New Dependents</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--gray-500)' }}>Create new patient records and link them to this wallet</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewDependentsToRegister([...newDependentsToRegister, { firstName: '', surname: '', middleName: '', age: '', sex: 'Male', phone: '', address: '' }])}
                        style={{ 
                          background: 'var(--teal-50)', 
                          color: 'var(--teal-700)', 
                          border: '1px solid var(--teal-200)', 
                          padding: '0.4rem 0.8rem', 
                          fontSize: '0.72rem', 
                          fontWeight: 700, 
                          cursor: 'pointer', 
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--teal-100)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--teal-50)'; }}
                      >
                        <RiAddLine size={14} /> Add Dependent
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 120, overflowY: 'auto' }}>
                      {newDependentsToRegister.map((nd, idx) => (
                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem', border: '1px solid var(--gray-200)', borderRadius: 4, background: '#fafafa', position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => setNewDependentsToRegister(newDependentsToRegister.filter((_, i) => i !== idx))}
                            style={{ position: 'absolute', right: 4, top: 4, background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}
                          >
                            Remove
                          </button>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem', paddingRight: '3rem' }}>
                            <input required placeholder="First Name *" style={{ ...inputStyle(false), padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} value={nd.firstName} onChange={e => {
                              const list = [...newDependentsToRegister];
                              list[idx].firstName = e.target.value;
                              setNewDependentsToRegister(list);
                            }} />
                            <input required placeholder="Surname *" style={{ ...inputStyle(false), padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} value={nd.surname} onChange={e => {
                              const list = [...newDependentsToRegister];
                              list[idx].surname = e.target.value;
                              setNewDependentsToRegister(list);
                            }} />
                            <input placeholder="Age *" style={{ ...inputStyle(false), padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} value={nd.age} onChange={e => {
                              const list = [...newDependentsToRegister];
                              list[idx].age = e.target.value;
                              setNewDependentsToRegister(list);
                            }} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
                            <select style={{ ...inputStyle(false), padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} value={nd.sex} onChange={e => {
                              const list = [...newDependentsToRegister];
                              list[idx].sex = e.target.value as any;
                              setNewDependentsToRegister(list);
                            }}>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                            <input placeholder="Phone" style={{ ...inputStyle(false), padding: '0.2rem 0.4rem', fontSize: '0.7rem' }} value={nd.phone} onChange={e => {
                              const list = [...newDependentsToRegister];
                              list[idx].phone = e.target.value;
                              setNewDependentsToRegister(list);
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.25rem', background: 'var(--gray-50)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--gray-200)' }}>
              <button type="button" onClick={() => setShowBillingAccountModal(false)} style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '0.5rem 1rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius)' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.5rem 1.25rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius)' }}>
                {saving ? 'Creating...' : 'Open Wallet'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showLedgerModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, maxWidth: 1250 }}>
            {/* Modal Header */}
            <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Account Workspace</h2>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', marginTop: '0.15rem' }}>{showLedgerModal.name} • Wallet Administration & Billing</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handlePrintStatement(showLedgerModal)}
                  style={{ background: 'white', color: 'var(--teal-800)', border: 'none', padding: '0.35rem 0.65rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <RiPrinterLine size={14} /> Print Statement
                </button>
                <button type="button" onClick={() => setShowLedgerModal(null)} style={closeBtn}><RiCloseLine size={16} /></button>
              </div>
            </div>

            {/* Modal Workspace Body (Dual Column Grid) */}
            <div style={{ display: 'grid', gridTemplateColumns: '4fr 6fr', maxHeight: '90vh', minHeight: '650px' }}>
              {/* Left Column: Account Details, Deposits & Dept Charges Forms */}
              <div style={{ padding: '1.25rem', paddingBottom: '2.5rem', background: '#f8fafc', overflowY: 'auto', borderRight: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Balance Card */}
                <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '1rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Current Balance</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: showLedgerModal.balance >= 0 ? '#166534' : '#991b1b', marginTop: '0.2rem' }}>
                    ₦{showLedgerModal.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Credit Limit:</span>
                    {editCreditLimit !== null ? (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <input 
                          type="number" 
                          value={editCreditLimit} 
                          onChange={(e) => setEditCreditLimit(e.target.value)} 
                          style={{ width: '80px', padding: '0.1rem 0.2rem', fontSize: '0.7rem' }}
                        />
                        <button type="button" onClick={async () => {
                          try {
                            const newLimit = parseFloat(editCreditLimit);
                            if(isNaN(newLimit)) return alert('Invalid number');
                            const res = await fetch(`/api/billing?action=update_limit`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ accountId: showLedgerModal.id, creditLimit: newLimit })
                            });
                            if(!res.ok) throw new Error('Update failed');
                            setShowLedgerModal({...showLedgerModal, credit_limit: newLimit});
                            setEditCreditLimit(null);
                            refresh();
                          } catch (e) {
                            alert('Error updating limit');
                          }
                        }} style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.1rem 0.3rem', borderRadius: 2, cursor: 'pointer', fontSize: '0.65rem' }}>Save</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>₦{showLedgerModal.credit_limit.toLocaleString('en-NG')}</span>
                        <button type="button" onClick={() => setEditCreditLimit(showLedgerModal.credit_limit.toString())} style={{ background: 'none', border: 'none', color: 'var(--blue-600)', cursor: 'pointer', fontSize: '0.65rem' }}>Edit</button>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Account Type:</span>
                    <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{showLedgerModal.type}</span>
                  </div>
                </div>

                {/* Form Switcher */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowWorkspaceLogExpense(false)}
                    style={{
                      flex: 1, padding: '0.4rem', border: 'none', background: !showWorkspaceLogExpense ? 'white' : 'transparent',
                      color: !showWorkspaceLogExpense ? 'var(--teal-700)' : 'var(--gray-500)',
                      fontWeight: 600, fontSize: '0.72rem', borderBottom: !showWorkspaceLogExpense ? '2px solid var(--teal-600)' : '2px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                    Load Funds (Deposit)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allVisits = patients.filter(p => p.billingAccountId === showLedgerModal.id);
                  const uniqueMembersMap = new Map();
                  allVisits.forEach(v => {
                    const key = `${v.firstName?.toLowerCase()}-${v.surname?.toLowerCase()}`;
                    if (!uniqueMembersMap.has(key)) {
                      uniqueMembersMap.set(key, v);
                    }
                  });
                  const members = Array.from(uniqueMembersMap.values());
                      setWorkspaceExpenseForm(prev => ({
                        ...prev,
                        patientId: members[0]?.id ? String(members[0].id) : ''
                      }));
                      setShowWorkspaceLogExpense(true);
                    }}
                    style={{
                      flex: 1, padding: '0.4rem', border: 'none', background: showWorkspaceLogExpense ? 'white' : 'transparent',
                      color: showWorkspaceLogExpense ? 'var(--teal-700)' : 'var(--gray-500)',
                      fontWeight: 600, fontSize: '0.72rem', borderBottom: showWorkspaceLogExpense ? '2px solid var(--teal-600)' : '2px solid transparent',
                      cursor: 'pointer'
                    }}
                  >
                    Log Dept Charge
                  </button>
                </div>

                {/* Load Funds Form */}
                {!showWorkspaceLogExpense && (
                  <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <RiWalletLine size={16} /> Load Funds (Deposit)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <Field label="Deposit Amount (₦)">
                        <input
                          type="number"
                          min="1"
                          placeholder="Amount to add"
                          style={inputStyle(false)}
                          value={depositAmount}
                          onChange={e => setDepositAmount(e.target.value)}
                        />
                      </Field>
                      <Field label="Payment Method">
                        <select style={inputStyle(false)} value={depositMethod} onChange={e => setDepositMethod(e.target.value)}>
                          <option value="cash">Cash</option>
                          <option value="pos">POS</option>
                          <option value="transfer">Bank Transfer</option>
                        </select>
                      </Field>
                      <Field label="Notes / Description">
                        <input
                          placeholder="e.g. Monthly top-up"
                          style={inputStyle(false)}
                          value={depositNotes}
                          onChange={e => setDepositNotes(e.target.value)}
                        />
                      </Field>
                      <button
                        type="button"
                        disabled={depositing}
                        onClick={() => handleDepositSubmit(showLedgerModal.id)}
                        style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.5rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius)', fontSize: '0.78rem', marginTop: '0.25rem' }}
                      >
                        {depositing ? 'Processing...' : 'Load Funds'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Log Department Charge Form */}
                {showWorkspaceLogExpense && (
                  <form onSubmit={(e) => handleWorkspaceExpenseSubmit(e, showLedgerModal.id)} style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-900)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <RiFileTextLine size={16} /> Log Clinical Dept Charge
                    </h4>

                    <Field label="Select Patient Member *">
                      <select
                        required
                        style={inputStyle(false)}
                        value={workspaceExpenseForm.patientId}
                        onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, patientId: e.target.value })}
                      >
                        <option value="">-- Select Member --</option>
                        {patients.filter(p => p.billingAccountId === showLedgerModal.id).map(p => (
                          <option key={p.id} value={p.id}>{p.firstName} {p.surname} ({p.slipNumber})</option>
                        ))}
                      </select>
                    </Field>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <Field label="Department">
                        <select
                          style={inputStyle(false)}
                          value={workspaceExpenseForm.department}
                          onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, department: e.target.value })}
                        >
                          <option value="pharmacy">Pharmacy</option>
                          <option value="consultation">Consultation</option>
                          <option value="ward">Ward / Admission</option>
                          <option value="nursing">Nursing / Dressing</option>
                          <option value="consumables">Consumables</option>
                          <option value="other">Other</option>
                        </select>
                      </Field>
                      <Field label="Receipt/Bill Number *">
                        <input
                          required
                          style={inputStyle(false)}
                          placeholder="e.g. RX-2026-98"
                          value={workspaceExpenseForm.receiptNumber}
                          onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, receiptNumber: e.target.value })}
                        />
                      </Field>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <Field label="Amount (₦) *">
                        <input
                          type="number"
                          min="1"
                          required
                          style={inputStyle(false)}
                          placeholder="Amount"
                          value={workspaceExpenseForm.amount}
                          onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, amount: e.target.value })}
                        />
                      </Field>
                      <Field label="Payment Method">
                        <select
                          style={inputStyle(false)}
                          value={workspaceExpenseForm.paymentMethod}
                          onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, paymentMethod: e.target.value })}
                        >
                          <option value="wallet">Account Wallet</option>
                          <option value="cash">Cash</option>
                          <option value="pos">POS</option>
                          <option value="transfer">Bank Transfer</option>
                        </select>
                      </Field>
                    </div>

                    <Field label="Description / Items">
                      <input
                        placeholder="e.g. Pharmacy Drugs"
                        style={inputStyle(false)}
                        value={workspaceExpenseForm.description}
                        onChange={e => setWorkspaceExpenseForm({ ...workspaceExpenseForm, description: e.target.value })}
                      />
                    </Field>

                    <button
                      type="submit"
                      disabled={saving}
                      style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.5rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius)', fontSize: '0.78rem', marginTop: '0.25rem' }}
                    >
                      {saving ? 'Saving Charge...' : 'Log & Process Charge'}
                    </button>
                  </form>
                )}
              </div>

              {/* Right Column: Tabbed Lists */}
              <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Tabs Selector */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', gap: '1rem' }}>
                  {[
                    { id: 'members', label: `Linked Members` },
                    { id: 'ledger', label: 'Transaction Statement' },
                    { id: 'charges', label: 'Department Spend Logs' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setWorkspaceTab(tab.id as any)}
                      style={{
                        padding: '0.5rem 0.25rem', border: 'none', background: 'none',
                        color: workspaceTab === tab.id ? 'var(--teal-700)' : 'var(--gray-500)',
                        fontWeight: 600, fontSize: '0.8rem', borderBottom: workspaceTab === tab.id ? '2px solid var(--teal-600)' : '2px solid transparent',
                        cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Inner Tab contents */}
                {workspaceTab === 'members' && (() => {
                  const members = patients.filter(p => p.billingAccountId === showLedgerModal.id);
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-900)' }}>Account Members ({members.length})</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {showLedgerModal.type === 'individual' ? (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/billing?action=upgrade_family`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ accountId: showLedgerModal.id })
                                  });
                                  if(!res.ok) throw new Error('Update failed');
                                  setShowLedgerModal({...showLedgerModal, type: 'family'});
                                  refresh();
                                  alert('Successfully upgraded to family account!');
                                } catch (e) {
                                  alert('Error upgrading account');
                                }
                              }}
                              style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                            >
                              Upgrade to Family Account
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowAddExisting(prev => !prev)}
                                style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                              >
                                {showAddExisting ? 'Close Link Form' : 'Link Existing Patient'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowQuickRegisterDep(prev => !prev)}
                                style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                              >
                                {showQuickRegisterDep ? 'Close Register Form' : 'Register New Dependent'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {showAddExisting && (
                        <div style={{ background: '#f8fafc', padding: '#f8fafc', paddingBottom: '0.75rem', borderRadius: 6, border: '1px solid var(--gray-200)', marginBottom: '1rem' }}>
                          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.5rem', padding: '0.5rem' }}>Link Existing Patient</h4>
                          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem' }}>
                            <select
                              value={existingPatientToLink}
                              onChange={e => setExistingPatientToLink(e.target.value)}
                              style={{ ...inputStyle(false), flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              <option value="">-- Select Patient --</option>
                              {patients
                                .filter(p => !p.billingAccountId)
                                .map(p => (
                                  <option key={p.id} value={p.id}>{p.firstName} {p.surname} ({p.slipNumber})</option>
                                ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleLinkExistingDependent(showLedgerModal.id)}
                              disabled={!existingPatientToLink}
                              style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}
                            >
                              Link Patient
                            </button>
                          </div>
                        </div>
                      )}

                      {showQuickRegisterDep && (
                        <form
                          onSubmit={(e) => handleQuickRegisterDependentSubmit(e, showLedgerModal.id)}
                          style={{ background: '#f8fafc', padding: '1rem', borderRadius: 6, border: '1px solid var(--gray-200)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                        >
                          <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-700)' }}>Register & Link New Dependent</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                            <Field label="First Name *">
                              <input required style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.firstName} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, firstName: e.target.value })} />
                            </Field>
                            <Field label="Surname *">
                              <input required style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.surname} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, surname: e.target.value })} />
                            </Field>
                            <Field label="Middle Name">
                              <input style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.middleName} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, middleName: e.target.value })} />
                            </Field>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                            <Field label="Age *">
                              <input required placeholder="e.g. 30" style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.age} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, age: e.target.value })} />
                            </Field>
                            <Field label="Sex">
                              <select style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.sex} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, sex: e.target.value as any })}>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                              </select>
                            </Field>
                            <Field label="Phone">
                              <input style={{ ...inputStyle(false), padding: '0.35rem 0.5rem', fontSize: '0.75rem' }} value={workspaceDepForm.phone} onChange={e => setWorkspaceDepForm({ ...workspaceDepForm, phone: e.target.value })} />
                            </Field>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                            <button type="button" onClick={() => setShowQuickRegisterDep(false)} style={{ background: 'white', border: '1px solid var(--gray-300)', padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}>Cancel</button>
                            <button type="submit" style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.35rem 0.75rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', borderRadius: 4 }}>Register Member</button>
                          </div>
                        </form>
                      )}

                      <div style={{ overflowX: 'auto', border: '1px solid var(--gray-200)', borderRadius: 4, background: 'white' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Name</th>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Slip No.</th>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, width: '120px', minWidth: '120px' }}>Age / Sex</th>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Phone</th>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Role</th>
                              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.map(m => (
                              <tr key={m.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{m.firstName} {m.surname}</td>
                                <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'var(--font-mono)' }}>{m.slipNumber}</td>
                                <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>{m.age} / {m.sex}</td>
                                <td style={{ padding: '0.6rem 0.75rem' }}>{m.phone || '—'}</td>
                                <td style={{ padding: '0.6rem 0.75rem' }}>
                                  <span style={{
                                    fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                    background: m.id === Number(showLedgerModal.owner_patient_id) ? '#eff6ff' : '#f1f5f9',
                                    color: m.id === Number(showLedgerModal.owner_patient_id) ? '#1d4ed8' : '#475569'
                                  }}>
                                    {m.id === Number(showLedgerModal.owner_patient_id) ? 'Owner' : 'Dependent'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>
                                  {m.id !== Number(showLedgerModal.owner_patient_id) && (
                                    <button
                                      type="button"
                                      onClick={() => handleUnlinkDependent(m.id)}
                                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600 }}
                                    >
                                      Unlink
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {workspaceTab === 'ledger' && (
                  <div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '0.75rem' }}>Account Ledger History</h3>
                    {loadingLedger ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)' }}>Loading statement...</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {billingTransactions.map(tx => {
                          const dt = new Date(tx.created_at).toLocaleDateString('en-NG', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          });
                          const isDeposit = tx.type === 'deposit' || tx.amount >= 0;
                          return (
                            <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', border: '1px solid var(--gray-100)', background: 'var(--gray-50)', borderRadius: 4 }}>
                              <div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--gray-800)' }}>{tx.description}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--gray-500)', marginTop: '0.15rem' }}>
                                  {dt} • Ref: {tx.reference_id || '—'} • Staff: {tx.created_by || '—'}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.82rem', color: isDeposit ? '#166534' : '#991b1b' }}>
                                {isDeposit ? '+' : ''}₦{tx.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                              </div>
                            </div>
                          );
                        })}
                        {billingTransactions.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-400)', fontSize: '0.78rem' }}>No transactions logged.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {workspaceTab === 'charges' && (
                  <div>
                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '0.75rem' }}>Department Charge History</h3>
                    <div style={{ overflowX: 'auto', border: '1px solid var(--gray-200)', borderRadius: 4, background: 'white' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Date</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Patient</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Department</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Receipt No.</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Amount</th>
                            <th style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Payment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {externalCharges
                            .filter(ec => ec.billingAccountId === showLedgerModal.id)
                            .map(ec => {
                              const dateStr = new Date(ec.createdAt).toLocaleDateString('en-NG', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              });
                              return (
                                <tr key={ec.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                  <td style={{ padding: '0.6rem 0.75rem', color: 'var(--gray-600)' }}>{dateStr}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{ec.patientName}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textTransform: 'capitalize' }}>{ec.department}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'var(--font-mono)' }}>{ec.receiptNumber}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700 }}>₦{ec.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td>
                                  <td style={{ padding: '0.6rem 0.75rem', textTransform: 'uppercase', fontSize: '0.7rem' }}>{ec.paymentMethod}</td>
                                </tr>
                              );
                            })}
                          {externalCharges.filter(ec => ec.billingAccountId === showLedgerModal.id).length === 0 && (
                            <tr>
                              <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>No department charges logged for this account.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
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
    const html = modalTab === 'slip'
      ? getSlipTemplate(patient, org)
      : getInvoiceTemplate(patient, org);
    printHtml(html);
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
    const html = getResultTemplate(patient, testsToPrint, org);
    printHtml(html);
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
