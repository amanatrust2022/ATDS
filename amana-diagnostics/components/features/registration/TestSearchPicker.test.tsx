import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TestSearchPicker from './TestSearchPicker';
import { Test } from '@/lib/store';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';

const catalogue: Test[] = [
  { id: 'fbc', name: 'Full Blood Count', department: 'lab', category: 'Haematology', specimen: 'Blood', parameters: [] },
  { id: 'usg', name: 'Abdominal Ultrasound', department: 'radiology', category: 'Ultrasound', specimen: 'N/A', parameters: [] },
  { id: 'ua', name: 'Full Urinalysis', department: 'lab', category: 'Urinalysis', specimen: 'Urine', parameters: [] },
];

const setup = (over: Partial<React.ComponentProps<typeof TestSearchPicker>> = {}) => {
  const props: React.ComponentProps<typeof TestSearchPicker> = {
    catalogue, search: '', setSearch: vi.fn(), ...over,
  };
  render(<TestSearchPicker {...props} />);
  return props;
};

beforeEach(() => {
  useRegistrationStore.getState().resetForm();
});

describe('Feature: Adding tests to a registration', () => {
  it('lists the whole catalogue before any search', () => {
    setup();

    expect(screen.getByText('Full Blood Count')).toBeInTheDocument();
    expect(screen.getByText('Abdominal Ultrasound')).toBeInTheDocument();
    expect(screen.getByText('Full Urinalysis')).toBeInTheDocument();
  });

  it('narrows the catalogue to the search term', () => {
    setup({ search: 'ultra' });

    expect(screen.getByText('Abdominal Ultrasound')).toBeInTheDocument();
    expect(screen.queryByText('Full Blood Count')).not.toBeInTheDocument();
  });

  it('also matches on specimen', () => {
    setup({ search: 'urine' });

    expect(screen.getByText('Full Urinalysis')).toBeInTheDocument();
    expect(screen.queryByText('Full Blood Count')).not.toBeInTheDocument();
  });

  it('says so when no test matches', () => {
    setup({ search: 'zzz' });

    expect(screen.getByText('No tests match your search.')).toBeInTheDocument();
  });

  it('adds the test the receptionist clicks', () => {
    setup();

    fireEvent.click(screen.getByText('Full Blood Count'));

    expect(useRegistrationStore.getState().selectedTests).toContain('fbc');
  });

  it('marks a chosen test as selected instead of offering it again', () => {
    useRegistrationStore.getState().addTest('fbc');
    setup();

    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.getAllByText('Add')).toHaveLength(2);
  });

  it('removes the test when it is clicked a second time', () => {
    useRegistrationStore.getState().addTest('fbc');
    setup();

    fireEvent.click(screen.getByText('Full Blood Count'));

    expect(useRegistrationStore.getState().selectedTests).not.toContain('fbc');
  });

  it('records what the receptionist types into the search box', () => {
    const setSearch = vi.fn();
    setup({ setSearch });

    fireEvent.change(screen.getByPlaceholderText('Search by test name, specimen, or department...'), {
      target: { value: 'fbc' },
    });

    expect(setSearch).toHaveBeenCalledWith('fbc');
  });

  it('surfaces the validation message when no test has been chosen', () => {
    setup({ error: 'Select at least one test' });

    expect(screen.getByText('Select at least one test')).toBeInTheDocument();
  });
});
