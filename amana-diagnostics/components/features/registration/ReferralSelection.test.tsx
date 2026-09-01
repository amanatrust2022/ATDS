import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ReferralSelection from './ReferralSelection';
import { ReferringDoctor, ReferringFacility } from '@/lib/store';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';

const CREATED = '2026-01-01T00:00:00.000Z';

const doctors: ReferringDoctor[] = [
  { id: 'doc-1', organization_id: 'org-1', name: 'Bello', facility_name: 'City General', commission_type: 'percentage', commission_value: 10, is_active: true, created_at: CREATED },
  { id: 'doc-2', organization_id: 'org-1', name: 'Adamu', commission_type: 'flat', commission_value: 0, is_active: true, created_at: CREATED },
];

const facilities: ReferringFacility[] = [
  { id: 'fac-1', organization_id: 'org-1', name: 'City General', address: '12 Clinic Road', commission_type: 'flat', commission_value: 500, is_active: true, created_at: CREATED },
];

const noop = vi.fn();

/** Renders with controllable selection state so we can assert on what the pickers write. */
const setup = (over: Partial<React.ComponentProps<typeof ReferralSelection>> = {}) => {
  const props: React.ComponentProps<typeof ReferralSelection> = {
    doctors, facilities, errors: {},
    selectedDoctorId: '', setSelectedDoctorId: vi.fn(),
    doctorSearch: '', setDoctorSearch: vi.fn(),
    showDoctorDrop: false, setShowDoctorDrop: vi.fn(),
    doctorRef: React.createRef<HTMLDivElement>(),
    onQuickAddDoctor: noop,
    selectedFacilityId: '', setSelectedFacilityId: vi.fn(),
    facilitySearch: '', setFacilitySearch: vi.fn(),
    showFacilityDrop: false, setShowFacilityDrop: vi.fn(),
    facilityRef: React.createRef<HTMLDivElement>(),
    onQuickAddFacility: noop,
    ...over,
  };
  render(<ReferralSelection {...props} />);
  return props;
};

beforeEach(() => {
  useRegistrationStore.getState().resetForm();
});

describe('Feature: Choosing a referring doctor', () => {
  // Regression: the Field wrapper once dropped its actionNode prop, so both of
  // these buttons were passed in and rendered nowhere.
  it('offers a Quick Register button for each picker', () => {
    setup();

    expect(screen.getAllByRole('button', { name: /Quick Register/i })).toHaveLength(2);
  });

  it('opens the quick-register flow when that button is pressed', () => {
    const onQuickAddDoctor = vi.fn();
    setup({ onQuickAddDoctor });

    fireEvent.click(screen.getAllByRole('button', { name: /Quick Register/i })[0]);

    expect(onQuickAddDoctor).toHaveBeenCalled();
  });

  it('lists the doctors on file once the dropdown is open', () => {
    setup({ showDoctorDrop: true });

    expect(screen.getByText('Dr. Bello')).toBeInTheDocument();
    expect(screen.getByText('Dr. Adamu')).toBeInTheDocument();
  });

  // Regression: this wrote through setForm(prev => ...), which a Partial setter
  // stores as an object instead of applying, leaving the form untouched.
  it('writes the chosen doctor into the registration form', () => {
    const setSelectedDoctorId = vi.fn();
    setup({ showDoctorDrop: true, setSelectedDoctorId });

    fireEvent.click(screen.getByText('Dr. Bello'));

    expect(setSelectedDoctorId).toHaveBeenCalledWith('doc-1');
    expect(useRegistrationStore.getState().form.referredBy).toBe('Dr. Bello');
  });

  it('accepts a doctor typed free-hand who is not on file', () => {
    setup({ showDoctorDrop: true, doctorSearch: 'Ibrahim' });

    fireEvent.click(screen.getByText(/Use "Ibrahim" as typed/));

    expect(useRegistrationStore.getState().form.referredBy).toBe('Ibrahim');
  });

  it('records a walk-in as having no referrer and no facility', () => {
    const setSelectedDoctorId = vi.fn();
    const setSelectedFacilityId = vi.fn();
    setup({ showDoctorDrop: true, setSelectedDoctorId, setSelectedFacilityId });

    fireEvent.click(screen.getByText('Not referred by anyone'));

    expect(setSelectedDoctorId).toHaveBeenCalledWith('none');
    expect(setSelectedFacilityId).toHaveBeenCalledWith('none');
    const { form } = useRegistrationStore.getState();
    expect(form.referredBy).toBe('Not referred by anyone');
    expect(form.referringFacility).toBe('None / Walk-in');
  });

  it('clears the doctor back off the form', () => {
    useRegistrationStore.getState().setForm({ referredBy: 'Dr. Bello' });
    setup({ selectedDoctorId: 'doc-1' });

    // The clear button is the only one rendered inside the doctor combobox
    const [clear] = screen.getAllByRole('button', { name: '' });
    fireEvent.click(clear);

    expect(useRegistrationStore.getState().form.referredBy).toBe('');
  });

  it('surfaces the validation message when neither referrer is given', () => {
    setup({ errors: { referredBy: 'Either Referring doctor or facility is required' } });

    expect(screen.getAllByText('Either Referring doctor or facility is required').length).toBeGreaterThan(0);
  });
});

describe('Feature: Choosing a referring facility', () => {
  it('writes the chosen facility into the registration form', () => {
    const setSelectedFacilityId = vi.fn();
    setup({ showFacilityDrop: true, setSelectedFacilityId });

    fireEvent.click(screen.getByText('City General'));

    expect(setSelectedFacilityId).toHaveBeenCalledWith('fac-1');
    expect(useRegistrationStore.getState().form.referringFacility).toBe('City General');
  });

  it('records an explicit walk-in facility', () => {
    setup({ showFacilityDrop: true });

    fireEvent.click(screen.getByText('None / Walk-in'));

    expect(useRegistrationStore.getState().form.referringFacility).toBe('None / Walk-in');
  });
});
