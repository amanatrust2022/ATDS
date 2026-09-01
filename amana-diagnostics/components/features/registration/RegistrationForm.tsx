import React from 'react';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import Field from './Field';
import { inputStyle } from './styles';

interface RegistrationFormProps {
  errors: Record<string, string>;
}

/** Patient biodata fields. Domain state lives in the registration store. */
export default function RegistrationForm({ errors }: RegistrationFormProps) {
  const form = useRegistrationStore(state => state.form);
  const setForm = useRegistrationStore(state => state.setForm);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <Field label="First Name *" error={errors.firstName}>
          <input style={inputStyle(!!errors.firstName)} value={form.firstName} onChange={e => setForm({ firstName: e.target.value })} placeholder="e.g. Musa" />
        </Field>
        <Field label="Surname *" error={errors.surname}>
          <input style={inputStyle(!!errors.surname)} value={form.surname} onChange={e => setForm({ surname: e.target.value })} placeholder="e.g. Bello" />
        </Field>
        <Field label="Middle Name" error={errors.middleName}>
          <input style={inputStyle(!!errors.middleName)} value={form.middleName} onChange={e => setForm({ middleName: e.target.value })} placeholder="e.g. Ibrahim" />
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Age *" error={errors.age}>
          <input style={inputStyle(!!errors.age)} value={form.age} onChange={e => setForm({ age: e.target.value })} placeholder="e.g. 35yrs" />
        </Field>
        <Field label="Sex">
          <select style={inputStyle(false)} value={form.sex} onChange={e => setForm({ sex: e.target.value as 'Male' | 'Female' })}>
            <option>Male</option>
            <option>Female</option>
          </select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <Field label="Phone Number *" error={errors.phone}>
          <input style={inputStyle(!!errors.phone)} value={form.phone} onChange={e => setForm({ phone: e.target.value })} placeholder="+234 803 000 0000" />
        </Field>
        <Field label="Patient Email (for results)">
          <input style={inputStyle(false)} type="email" value={form.email} onChange={e => setForm({ email: e.target.value })} placeholder="patient@example.com" />
        </Field>
      </div>
      <Field label="Address">
        <input style={inputStyle(false)} value={form.address} onChange={e => setForm({ address: e.target.value })} placeholder="Patient address" />
      </Field>
    </>
  );
}
