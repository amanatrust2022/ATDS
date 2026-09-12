import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the registration desk's two-column shell.
 *
 * The panels around the form, not the form itself — each of the pieces inside
 * has its own tests beside it. Written before the rebuild (decision #28).
 */

vi.mock('@/components/Notices', () => ({ useNotices: () => ({ notify: vi.fn(), ask: vi.fn() }) }));

vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/store');
  return {
    ...actual,
    generateSlipNumber: vi.fn(async () => 'ATD-0001'),
    addPatientWithReferral: vi.fn(async () => ({})),
    addReferringDoctor: vi.fn(async () => ({})),
    addReferringFacility: vi.fn(async () => ({})),
    fetchReferringDoctors: vi.fn(async () => []),
    fetchReferringFacilities: vi.fn(async () => []),
    fetchPatients: vi.fn(async () => []),
  };
});

import RegistrationTab from './RegistrationTab';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';

const catalogue = [
  { id: 'fbc', name: 'Full Blood Count', department: 'lab', category: 'Haematology', specimen: 'Blood', parameters: [] },
];

const show = () =>
  render(
    <RegistrationTab
      patients={[]}
      patientProfiles={[]}
      doctors={[]}
      setDoctors={vi.fn()}
      facilities={[]}
      setFacilities={vi.fn()}
      testPrices={[]}
      catalogue={catalogue as never}
      billingAccounts={[]}
      organization={{ id: 'org-1', name: 'Kano Diagnostics', slug: 'kano' } as never}
      setShowSlipModal={vi.fn()}
      onRegistered={vi.fn()}
    />,
  );

beforeEach(() => {
  useRegistrationStore.getState().resetForm();
});

describe('Registration desk', () => {
  /**
   * The desk is two tall columns — the patient's details on the left, the
   * tests chosen on the right — and neither was a landmark. A keyboard or
   * screen-reader user working down the left column had no way to jump to the
   * basket on the right except by tabbing through every field between them.
   */
  it('makes each column a named region', () => {
    show();

    expect(screen.getByRole('region', { name: /patient information/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /selected tests/i })).toBeInTheDocument();
  });

  // Behaviour guards: the pieces the desk is assembled from are all present.
  // These held before.
  it('assembles the lookup, the biodata, the referral and the test picker', () => {
    show();

    expect(screen.getByRole('combobox', { name: /returning patient lookup/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /first name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /search tests/i })).toBeInTheDocument();
  });

  it('shows the empty basket until a test is chosen', () => {
    show();

    expect(screen.getByText(/no tests selected yet/i)).toBeInTheDocument();
  });
});
