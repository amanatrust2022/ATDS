import React from 'react';
import { useRegistrationStore } from '@/lib/store/useRegistrationStore';
import { Field, Input, Select } from '@/components/ui';

import styles from './registrationForm.module.css';

interface RegistrationFormProps {
  errors: Record<string, string>;
}

/** Patient biodata fields. Domain state lives in the registration store. */
export default function RegistrationForm({ errors }: RegistrationFormProps) {
  const form = useRegistrationStore(state => state.form);
  const setForm = useRegistrationStore(state => state.setForm);

  return (
    <>
      <div className={styles.three}>
        <Field label="First name" required error={errors.firstName}>
          <Input value={form.firstName} onChange={e => setForm({ firstName: e.target.value })} placeholder="e.g. Musa" />
        </Field>
        <Field label="Surname" required error={errors.surname}>
          <Input value={form.surname} onChange={e => setForm({ surname: e.target.value })} placeholder="e.g. Bello" />
        </Field>
        <Field label="Middle name" error={errors.middleName}>
          <Input value={form.middleName} onChange={e => setForm({ middleName: e.target.value })} placeholder="e.g. Ibrahim" />
        </Field>
      </div>
      <div className={styles.two}>
        <Field label="Age" required error={errors.age}>
          <Input value={form.age} onChange={e => setForm({ age: e.target.value })} placeholder="e.g. 35yrs" />
        </Field>
        <Field label="Sex">
          <Select value={form.sex} onChange={e => setForm({ sex: e.target.value as 'Male' | 'Female' })}>
            <option>Male</option>
            <option>Female</option>
          </Select>
        </Field>
      </div>
      <div className={styles.two}>
        <Field label="Phone number" required error={errors.phone}>
          <Input value={form.phone} onChange={e => setForm({ phone: e.target.value })} placeholder="+234 803 000 0000" />
        </Field>
        <Field label="Patient email" hint="Where the result is sent, if they want it by email.">
          <Input type="email" value={form.email} onChange={e => setForm({ email: e.target.value })} placeholder="patient@example.com" />
        </Field>
      </div>
      <Field label="Address">
        <Input value={form.address} onChange={e => setForm({ address: e.target.value })} placeholder="Patient address" />
      </Field>
    </>
  );
}
