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
});
