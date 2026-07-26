import { create } from 'zustand';
import { Test, TestPrice } from '@/lib/store';

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
    const val = parseFloat(discountValue) || 0;
    if (discountType === 'flat') {
      return val;
    } else if (discountType === 'percentage') {
      return (total * val) / 100;
    }
    return 0;
  }
}));
