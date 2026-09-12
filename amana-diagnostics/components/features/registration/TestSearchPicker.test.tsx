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
  /**
   * The search box had a placeholder and nothing else. The "Search Tests"
   * heading above it was a bare <h3>, wired to nothing, so a screen reader
   * reached the box with no name for it.
   */
  it('names the search box', () => {
    setup();

    expect(screen.getByRole('textbox', { name: /search tests/i })).toBeInTheDocument();
  });

  /**
   * Each row is a toggle, but nothing said so. The only sign a test was already
   * chosen was the word "Selected" where "Add" had been, and a change of fill —
   * teal for lab, violet for radiology — that a colour-blind receptionist could
   * not read and a screen reader never heard as a pressed state.
   */
  it('reports a chosen test as a pressed toggle', () => {
    useRegistrationStore.getState().addTest('fbc');
    setup();

    expect(screen.getByRole('button', { name: /full blood count/i, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abdominal ultrasound/i, pressed: false })).toBeInTheDocument();
  });

  /**
   * Which department a test belongs to was carried by the row's colour alone —
   * teal for lab, violet for radiology. Nothing said the word.
   */
  it('names the department of each test', () => {
    setup();

    expect(screen.getAllByText(/^lab$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^radiology$/i)).toBeInTheDocument();
  });

  /**
   * The validation message appears after a failed submit, at the far end of a
   * long form. Nothing announced it, so a receptionist working by keyboard was
   * told nothing at all about why the registration would not go through.
   */
  it('announces the validation message', () => {
    setup({ error: 'Select at least one test' });

    expect(screen.getByRole('alert')).toHaveTextContent('Select at least one test');
  });
});
