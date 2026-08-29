import { describe, it, expect, beforeEach } from 'vitest';
import { useRegistrationStore } from './useRegistrationStore';

describe('Registration Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useRegistrationStore.getState().resetForm();
  });

  it('should update form fields', () => {
    const store = useRegistrationStore.getState();
    store.setForm({ firstName: 'John', surname: 'Doe' });
    
    expect(useRegistrationStore.getState().form.firstName).toBe('John');
    expect(useRegistrationStore.getState().form.surname).toBe('Doe');
  });

  it('should add and remove tests', () => {
    const store = useRegistrationStore.getState();
    store.addTest('test-1');
    store.addTest('test-2');
    
    expect(useRegistrationStore.getState().selectedTests).toEqual(['test-1', 'test-2']);
    
    useRegistrationStore.getState().removeTest('test-1');
    expect(useRegistrationStore.getState().selectedTests).toEqual(['test-2']);
  });

  it('should calculate total based on test prices', () => {
    const store = useRegistrationStore.getState();
    store.addTest('test-1');
    store.addTest('test-2');
    
    const mockPrices = [
      { test_id: 'test-1', price: 100 },
      { test_id: 'test-2', price: 150 },
      { test_id: 'test-3', price: 200 }
    ] as any;

    const total = useRegistrationStore.getState().calculateTotal(mockPrices);
    expect(total).toBe(250);
  });

  it('should calculate flat discount correctly', () => {
    const store = useRegistrationStore.getState();
    store.setDiscount('flat', '50');
    
    const discount = store.calculateDiscountAmount(250);
    expect(discount).toBe(50);
  });

  it('should calculate percentage discount correctly', () => {
    const store = useRegistrationStore.getState();
    store.setDiscount('percentage', '10'); // 10%
    
    const discount = store.calculateDiscountAmount(250);
    expect(discount).toBe(25);
  });

  it('should fail validation if fields are missing on submitRegistration', async () => {
    const store = useRegistrationStore.getState();
    const result = await store.submitRegistration({
      organizationId: 'org1',
      testPrices: [],
      doctors: [],
      facilities: [],
      billingAccounts: [],
      catalogue: [],
      selectedDoctorId: '',
      selectedFacilityId: '',
      selectedPatientProfileId: null,
      checkoutBillingAccountId: '',
      selectedPatientBillingAccountId: null,
      generateSlipNumber: async () => '123',
      addPatientWithReferral: async () => {}
    });

    expect(result.patient).toBeNull();
    expect(result.errors.firstName).toBe('First name is required');
    expect(result.errors.tests).toBe('Select at least one test');
  });
});
