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
});
