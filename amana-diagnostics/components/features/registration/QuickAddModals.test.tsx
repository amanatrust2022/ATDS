import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import QuickFacilityModal from './QuickFacilityModal';
import QuickDoctorModal from './QuickDoctorModal';
import type { ReferringFacility } from '@/lib/store';

/**
 * Characterisation tests for the two quick-register overlays on the
 * registration desk — a referring facility and a referring doctor, both added
 * without leaving the patient in front of you. Written before the rebuild
 * (decision #28).
 */

const facilities = [
  { id: 'f1', organizationId: 'org-1', name: 'City General Hospital', address: '', phone: '', email: '' },
] as unknown as ReferringFacility[];

const facilityForm = { name: '', address: '', phone: '', email: '' };
const doctorForm = { name: '', phone: '', email: '', facility_id: '' };

const openFacility = (over: Partial<React.ComponentProps<typeof QuickFacilityModal>> = {}) => {
  const props = {
    form: facilityForm, setForm: vi.fn(), error: '', saving: false,
    onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()), onClose: vi.fn(), ...over,
  };
  render(<QuickFacilityModal {...props} />);
  return props;
};

const openDoctor = (over: Partial<React.ComponentProps<typeof QuickDoctorModal>> = {}) => {
  const props = {
    form: doctorForm, setForm: vi.fn(), facilities, error: '', saving: false,
    onSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()), onClose: vi.fn(), ...over,
  };
  render(<QuickDoctorModal {...props} />);
  return props;
};

describe('Quick register: referring facility', () => {
  /**
   * Both overlays were hand-rolled from a fixed div in registration/styles.ts:
   * no role, no aria-modal, no name. Nothing announced that a dialog had
   * opened, focus was never trapped, and Escape did nothing. AGENTS rule 6.
   */
  it('opens as a named dialog', () => {
    openFacility();

    expect(
      screen.getByRole('dialog', { name: /quick register referring facility/i }),
    ).toBeInTheDocument();
  });

  it('closes when the receptionist presses Escape', async () => {
    const { onClose } = openFacility();

    fireEvent.keyDown(document.activeElement || document.body, { key: 'Escape' });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  /**
   * Every field in here went through registration/Field.tsx, which drew a
   * <label> with no htmlFor over a control with no id. Four boxes on this
   * overlay, and a screen reader could name none of them.
   */
  it('names every field', () => {
    openFacility();

    expect(screen.getByRole('textbox', { name: /facility name/i })).toBeInTheDocument();
    // Anchored: "Email address" matches a bare /address/ too.
    expect(screen.getByRole('textbox', { name: /^address$/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /phone number/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email address/i })).toBeInTheDocument();
  });

  /**
   * The failure message — a duplicate name, a rejected save — was a plain
   * coloured div. Nothing announced it, so a receptionist pressing Register
   * a second time had no idea why the first had not worked.
   */
  it('announces a failed save', () => {
    openFacility({ error: 'A facility with that name already exists.' });

    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i);
  });

  // Behaviour guards: the overlay still submits and still closes on Cancel.
  it('submits the facility', () => {
    // Filled in, or the browser's own required-field check blocks the submit.
    const { onSubmit } = openFacility({
      form: { ...facilityForm, name: 'City General Hospital' },
    });

    fireEvent.click(screen.getByRole('button', { name: /register facility/i }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('backs out on Cancel', () => {
    const { onClose } = openFacility();

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(onClose).toHaveBeenCalled();
  });
});

describe('Quick register: referring doctor', () => {
  it('opens as a named dialog', () => {
    openDoctor();

    expect(
      screen.getByRole('dialog', { name: /quick register referring doctor/i }),
    ).toBeInTheDocument();
  });

  it('names every field, including the facility list', () => {
    openDoctor();

    expect(screen.getByRole('textbox', { name: /doctor's name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /phone number/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email address/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /affiliated facility/i })).toBeInTheDocument();
  });

  it('announces a failed save', () => {
    openDoctor({ error: 'That doctor is already on file.' });

    expect(screen.getByRole('alert')).toHaveTextContent(/already on file/i);
  });

  // Behaviour guard: the facilities it was handed are offered, plus the
  // independent option. This held before.
  it('offers the known facilities and an independent option', () => {
    openDoctor();

    expect(screen.getByRole('option', { name: /independent/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /city general hospital/i })).toBeInTheDocument();
  });
});
