import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import RegistrationForm from './RegistrationForm';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';

beforeEach(() => {
  useRegistrationStore.getState().resetForm();
});

describe('Feature: Entering patient biodata', () => {
  it('records each field the receptionist fills in', () => {
    render(<RegistrationForm errors={{}} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Musa'), { target: { value: 'Musa' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Bello'), { target: { value: 'Bello' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Ibrahim'), { target: { value: 'Ibrahim' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 35yrs'), { target: { value: '35yrs' } });
    fireEvent.change(screen.getByPlaceholderText('+234 803 000 0000'), { target: { value: '08031112222' } });
    fireEvent.change(screen.getByPlaceholderText('patient@example.com'), { target: { value: 'musa@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Patient address'), { target: { value: '12 Zoo Road, Kano' } });

    expect(useRegistrationStore.getState().form).toMatchObject({
      firstName: 'Musa',
      surname: 'Bello',
      middleName: 'Ibrahim',
      age: '35yrs',
      phone: '08031112222',
      email: 'musa@example.com',
      address: '12 Zoo Road, Kano',
    });
  });

  it('does not disturb the other fields when one is edited', () => {
    useRegistrationStore.getState().setForm({ surname: 'Bello', phone: '08031112222' });
    render(<RegistrationForm errors={{}} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Musa'), { target: { value: 'Musa' } });

    const { form } = useRegistrationStore.getState();
    expect(form.surname).toBe('Bello');
    expect(form.phone).toBe('08031112222');
  });

  it('defaults sex to Male and records a change to Female', () => {
    render(<RegistrationForm errors={{}} />);

    expect(useRegistrationStore.getState().form.sex).toBe('Male');

    fireEvent.change(screen.getByDisplayValue('Male'), { target: { value: 'Female' } });

    expect(useRegistrationStore.getState().form.sex).toBe('Female');
  });

  it('shows the validation message against the field it belongs to', () => {
    render(<RegistrationForm errors={{ firstName: 'First name is required', age: 'Age is required' }} />);

    expect(screen.getByText('First name is required')).toBeInTheDocument();
    expect(screen.getByText('Age is required')).toBeInTheDocument();
  });

  it('shows no validation messages on a clean form', () => {
    render(<RegistrationForm errors={{}} />);

    expect(screen.queryByText(/is required/)).not.toBeInTheDocument();
  });
  /**
   * Every field on the biodata form went through registration/Field.tsx, which
   * draws a <label> wired to nothing over a control with no id. Seven boxes,
   * and a screen reader could name none of them — on the one form where
   * getting a name or a phone number wrong follows the patient through the
   * whole visit.
   */
  it('names every field', () => {
    render(<RegistrationForm errors={{}} />);

    expect(screen.getByRole('textbox', { name: /first name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /surname/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /middle name/i })).toBeInTheDocument();
    // Anchored at a word boundary rather than end-of-string: a required
    // field's name carries " (required)", and a loose /age/ matches "Address".
    expect(screen.getByRole('textbox', { name: /^age\b/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /sex/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /phone number/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^address$/i })).toBeInTheDocument();
  });

  /**
   * A field's validation message sat in a plain span beside it: not announced,
   * and not tied to the control it was about. A receptionist working by
   * keyboard reached a box that was silently wrong.
   */
  it('ties a validation message to the field it is about', () => {
    render(<RegistrationForm errors={{ phone: 'Enter a phone number we can reach.' }} />);

    const phone = screen.getByRole('textbox', { name: /phone number/i });
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(phone).toHaveAccessibleDescription(/phone number we can reach/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/phone number we can reach/i);
  });

  /**
   * The required fields were marked with a bare asterisk in the label text,
   * which a screen reader reads as "star" or skips entirely.
   */
  it('marks the required fields as required', () => {
    render(<RegistrationForm errors={{}} />);

    expect(screen.getByRole('textbox', { name: /first name/i })).toBeRequired();
    expect(screen.getByRole('textbox', { name: /surname/i })).toBeRequired();
    expect(screen.getByRole('textbox', { name: /^age\b/i })).toBeRequired();
    expect(screen.getByRole('textbox', { name: /phone number/i })).toBeRequired();
    expect(screen.getByRole('textbox', { name: /middle name/i })).not.toBeRequired();
  });
});
