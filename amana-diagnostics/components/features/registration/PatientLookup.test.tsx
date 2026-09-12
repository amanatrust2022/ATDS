import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PatientLookup from './PatientLookup';
import { PatientProfile } from '@/lib/store';

const profile = (over: Partial<PatientProfile> = {}): PatientProfile => ({
  id: 1, organizationId: 'org-1', firstName: 'Musa', surname: 'Bello', middleName: 'Ibrahim',
  phone: '08031112222', address: 'Kano', sex: 'Male',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});

const musa = profile();
const amina = profile({ id: 2, firstName: 'Amina', surname: 'Sani', middleName: '', phone: '08039998888', sex: 'Female' });

const setup = (over: Partial<React.ComponentProps<typeof PatientLookup>> = {}) => {
  const props: React.ComponentProps<typeof PatientLookup> = {
    patientProfiles: [musa, amina],
    query: '', setQuery: vi.fn(),
    showDrop: false, setShowDrop: vi.fn(),
    loadedPatientName: '',
    selectedPatientProfileId: null,
    onSelectProfile: vi.fn(),
    onClear: vi.fn(),
    containerRef: React.createRef<HTMLDivElement>(),
    ...over,
  };
  render(<PatientLookup {...props} />);
  return props;
};

describe('Feature: Returning patient lookup', () => {
  it('keeps the dropdown closed until the receptionist types', () => {
    setup({ showDrop: true, query: '' });

    expect(screen.queryByText(/Musa/)).not.toBeInTheDocument();
  });

  it('suggests patients matching the typed name', () => {
    setup({ showDrop: true, query: 'Musa' });

    expect(screen.getByText(/Musa Ibrahim Bello/)).toBeInTheDocument();
    expect(screen.queryByText(/Amina Sani/)).not.toBeInTheDocument();
  });

  it('finds a patient by phone number as well as by name', () => {
    setup({ showDrop: true, query: '08039998888' });

    expect(screen.getByText(/Amina/)).toBeInTheDocument();
    expect(screen.queryByText(/Musa/)).not.toBeInTheDocument();
  });

  it('says so when nothing matches, rather than showing an empty box', () => {
    setup({ showDrop: true, query: 'Nobody' });

    expect(screen.getByText('No matching patient profiles found.')).toBeInTheDocument();
  });

  it('hands the chosen profile back to be loaded into the form', () => {
    const onSelectProfile = vi.fn();
    setup({ showDrop: true, query: 'Musa', onSelectProfile });

    fireEvent.click(screen.getByText(/Musa Ibrahim Bello/));

    expect(onSelectProfile).toHaveBeenCalledWith(musa);
  });

  it('records what the receptionist types', () => {
    const setQuery = vi.fn();
    setup({ setQuery });

    fireEvent.change(screen.getByPlaceholderText('Search by name, phone, or slip number...'), {
      target: { value: 'Am' },
    });

    expect(setQuery).toHaveBeenCalledWith('Am');
  });

  it('shows which returning patient is currently loaded', () => {
    setup({ loadedPatientName: 'Musa Bello', selectedPatientProfileId: 1 });

    expect(screen.getByText(/Musa Bello/)).toBeInTheDocument();
    expect(screen.getByText(/Patient ID: 1/)).toBeInTheDocument();
  });

  it('lets the receptionist drop the loaded patient and start fresh', () => {
    const onClear = vi.fn();
    setup({ loadedPatientName: 'Musa Bello', selectedPatientProfileId: 1, onClear });

    fireEvent.click(screen.getByRole('button', { name: 'Clear / Register New' }));

    expect(onClear).toHaveBeenCalled();
  });

  it('shows no loaded-patient banner before one is picked', () => {
    setup();

    expect(screen.queryByRole('button', { name: 'Clear / Register New' })).not.toBeInTheDocument();
  });
  /**
   * The lookup's label was a bare <label> with no htmlFor, over an input with
   * no id and no aria-label. A screen reader reached the box and had only the
   * placeholder to go on — and a placeholder is not a name.
   */
  it('names the search box for a screen reader', () => {
    setup();

    expect(screen.getByRole('combobox', { name: /returning patient lookup/i })).toBeInTheDocument();
  });

  /**
   * Every suggestion was a <div onClick>. A receptionist working the desk with
   * the keyboard — which is most of them, most of the time — could not reach a
   * single one, and nothing announced that a list of matches had appeared.
   */
  it('offers each suggestion as an option a keyboard can reach', () => {
    setup({ showDrop: true, query: 'Musa' });

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Musa Ibrahim Bello/ })).toBeInTheDocument();
  });

  it('walks the suggestions with the arrow keys and picks one with Enter', () => {
    const onSelectProfile = vi.fn();
    setup({ showDrop: true, query: '0803', onSelectProfile });

    const box = screen.getByRole('combobox', { name: /returning patient lookup/i });
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(onSelectProfile).toHaveBeenCalledWith(amina);
  });

  /**
   * The button that empties the search box held a close icon and nothing else,
   * so its accessible name was the empty string.
   */
  it('names the button that empties the search box', () => {
    const setQuery = vi.fn();
    setup({ query: 'Musa', setQuery });

    fireEvent.click(screen.getByRole('button', { name: /clear search/i }));

    expect(setQuery).toHaveBeenCalledWith('');
  });
});
