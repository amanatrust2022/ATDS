import { create } from 'zustand';
import { Test, TestPrice } from '@/lib/store';
import { calculateDiscountAmount } from './registrationBilling';

interface RegistrationForm {
  firstName: string;
  surname: string;
  middleName: string;
  age: string;
  sex: 'Male' | 'Female';
  phone: string;
  email: string;
  address: string;
  referredBy: string;
  referringFacility: string;
}

interface RegistrationState {
  // Form State
  form: RegistrationForm;
  setForm: (form: Partial<RegistrationForm>) => void;
  resetForm: () => void;

  // Test Selection
  selectedTests: string[];
  addTest: (testId: string) => void;
  removeTest: (testId: string) => void;
  clearTests: () => void;

  // Billing & Discounts
  discountType: 'none' | 'flat' | 'percentage';
  discountValue: string;
  setDiscount: (type: 'none' | 'flat' | 'percentage', value: string) => void;
  
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  
  paidAmount: string;
  setPaidAmount: (amount: string) => void;

  // Derived calculations
  calculateTotal: (testPrices: TestPrice[]) => number;
  calculateDiscountAmount: (total: number) => number;

  // Actions
  submitRegistration: (params: {
    organizationId: string;
    testPrices: TestPrice[];
    doctors: import('@/lib/store').ReferringDoctor[];
    facilities: import('@/lib/store').ReferringFacility[];
    billingAccounts: import('@/lib/store').BillingAccount[];
    catalogue: import('@/lib/store').Test[];
    selectedDoctorId: string;
    selectedFacilityId: string;
    selectedPatientProfileId: number | null;
    checkoutBillingAccountId: string;
    selectedPatientBillingAccountId: string | null;
    generateSlipNumber: (orgId: string) => Promise<string>;
    addPatientWithReferral: (patientData: any, tests: any[], orgId: string) => Promise<void>;
  }) => Promise<{ patient: import('@/lib/store').Patient; errors: Record<string, string> }>;
}

const initialForm: RegistrationForm = {
  firstName: '', surname: '', middleName: '', age: '', sex: 'Male',
  phone: '', email: '', address: '', referredBy: '', referringFacility: '',
};

export const useRegistrationStore = create<RegistrationState>((set, get) => ({
  form: initialForm,
  setForm: (updates) => set((state) => ({ form: { ...state.form, ...updates } })),
  resetForm: () => set({ 
    form: initialForm, 
    selectedTests: [], 
    discountType: 'none', 
    discountValue: '', 
    paidAmount: '', 
    paymentMethod: 'cash' 
  }),

  selectedTests: [],
  addTest: (testId) => set((state) => ({ selectedTests: [...state.selectedTests, testId] })),
  removeTest: (testId) => set((state) => ({ selectedTests: state.selectedTests.filter(id => id !== testId) })),
  clearTests: () => set({ selectedTests: [] }),

  discountType: 'none',
  discountValue: '',
  setDiscount: (type, value) => set({ discountType: type, discountValue: value }),

  paymentMethod: 'cash',
  setPaymentMethod: (method) => set({ paymentMethod: method }),

  paidAmount: '',
  setPaidAmount: (amount) => set({ paidAmount: amount }),

  calculateTotal: (testPrices) => {
    const { selectedTests } = get();
    return selectedTests.reduce((sum, testId) => {
      const priceRecord = testPrices.find(tp => tp.test_id === testId);
      return sum + (priceRecord ? priceRecord.price : 0);
    }, 0);
  },

  calculateDiscountAmount: (total) => {
    const { discountType, discountValue } = get();
    return calculateDiscountAmount(total, discountType, discountValue);
  },

  submitRegistration: async (params) => {
    const state = get();
    const e: Record<string, string> = {};
    if (!state.form.firstName.trim()) e.firstName = 'First name is required';
    if (!state.form.surname.trim()) e.surname = 'Surname is required';
    if (!state.form.age.trim()) e.age = 'Age is required';
    if (!state.form.phone.trim()) e.phone = 'Phone number is required';
    const hasDoctor = !!params.selectedDoctorId || !!state.form.referredBy.trim();
    const hasFacility = !!params.selectedFacilityId || !!state.form.referringFacility.trim();
    if (!hasDoctor && !hasFacility) {
      e.referredBy = 'Either Referring doctor or facility is required';
      e.referringFacility = 'Either Referring doctor or facility is required';
    }
    if (state.selectedTests.length === 0) e.tests = 'Select at least one test';

    if (Object.keys(e).length > 0) return { patient: null as any, errors: e };

    const selectedTestDetails = state.selectedTests.map(tid => {
      const test = params.catalogue.find((t: any) => t.id === tid)!;
      const catalog = params.testPrices.find(p => p.test_id === tid);
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
    const discVal = parseFloat(state.discountValue) || 0;
    const discountAmount = state.calculateDiscountAmount(subtotal);
    const netBill = Math.max(0, subtotal - discountAmount);
    const amountPaidVal = state.paidAmount === '' ? netBill : (parseFloat(state.paidAmount) || 0);
    
    if (state.paymentMethod === 'wallet') {
      if (!params.checkoutBillingAccountId) throw new Error('Please select a wallet account for payment.');
      const acc = params.billingAccounts.find(a => a.id === params.checkoutBillingAccountId);
      if (!acc) throw new Error('Selected wallet account not found.');
      if ((acc.balance + acc.credit_limit) < netBill) {
        throw new Error(`Insufficient wallet balance on "${acc.name}". Available: ₦${(acc.balance + acc.credit_limit).toLocaleString('en-NG')}`);
      }
    }

    const slipNumber = await params.generateSlipNumber(params.organizationId);
    const isReferral = !!(params.selectedDoctorId && params.selectedDoctorId !== 'none') || !!(params.selectedFacilityId && params.selectedFacilityId !== 'none');

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
    const selDoctor = params.doctors.find(d => d.id === params.selectedDoctorId);
    const selFacility = params.facilities.find(f => f.id === params.selectedFacilityId);
    const paymentStatus = amountPaidVal >= netBill ? 'paid' : amountPaidVal > 0 ? 'partial' : 'unpaid';

    const patientData = {
      slipNumber,
      registeredAt: new Date().toISOString(),
      name: [state.form.firstName, state.form.middleName, state.form.surname].filter(Boolean).join(' '),
      ...state.form,
      referredBy: selDoctor ? `Dr. ${selDoctor.name}` : state.form.referredBy,
      referringFacility: selFacility ? selFacility.name : state.form.referringFacility,
      referringDoctorId: (params.selectedDoctorId && params.selectedDoctorId !== 'none') ? params.selectedDoctorId : undefined,
      referringFacilityId: (params.selectedFacilityId && params.selectedFacilityId !== 'none') ? params.selectedFacilityId : undefined,
      commissionAssigned: isReferral && totalCommission > 0,
      commissionType: isReferral && totalCommission > 0 ? 'varies' : undefined,
      commissionValue: 0,
      commissionAmount: totalCommission,
      totalAmount: subtotal,
      discountType: state.discountType,
      discountValue: discVal,
      discountAmount,
      netAmount: netBill,
      paidAmount: amountPaidVal,
      paymentStatus,
      paymentMethod: state.paymentMethod,
      billingAccountId: state.paymentMethod === 'wallet' ? params.checkoutBillingAccountId : (params.selectedPatientBillingAccountId || undefined),
      patientProfileId: params.selectedPatientProfileId || undefined,
    };

    await params.addPatientWithReferral(patientData, tests, params.organizationId);

    return {
      patient: { id: 0, tests: tests as any, ...patientData } as import('@/lib/store').Patient,
      errors: {}
    };
  }
}));
