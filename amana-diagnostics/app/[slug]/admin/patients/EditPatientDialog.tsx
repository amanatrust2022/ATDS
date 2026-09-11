'use client';

import { useState } from 'react';

import { Alert, Button, Dialog, Field, FieldRow, Input, Select } from '@/components/ui';
import { Patient, updatePatient, updatePatientProfile } from '@/lib/store';

import styles from './patients.module.css';

/**
 * Correcting what was typed at registration.
 *
 * Was a hand-rolled overlay with a teal header band, no focus trap and no
 * Escape. The saving rule below is the part worth keeping careful: an edit has
 * to reach both the visit and the profile behind it.
 */
export function EditPatientDialog({
  patient,
  organizationId,
  onClose,
  onSaved,
}: {
  patient: Patient | null;
  organizationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    firstName: patient?.firstName || '',
    surname: patient?.surname || '',
    middleName: patient?.middleName || '',
    age: patient?.age || '',
    sex: patient?.sex || 'Male',
    phone: patient?.phone || '',
    email: patient?.email || '',
    address: patient?.address || '',
    referredBy: patient?.referredBy || '',
    referringFacility: patient?.referringFacility || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!patient) return null;

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.firstName.trim() || !form.surname.trim() || !form.age.trim() || !form.phone.trim()) {
      setError('First name, surname, age and phone are all needed.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const edits = { ...form, sex: form.sex as 'Male' | 'Female' };

      // The visit, so this record reads correctly...
      await updatePatient(patient.id, edits);

      // ...and the permanent record behind it, so the correction survives.
      // Without this the profile keeps the old spelling and hands it straight
      // back at the patient's next visit.
      if (patient.patientProfileId && organizationId) {
        await updatePatientProfile(patient.patientProfileId, edits, organizationId);
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Could not save those changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="md"
      title="Edit this patient's details"
      description={`Slip ${patient.slipNumber}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button intent="primary" loading={saving} onClick={save}>
            Save changes
          </Button>
        </>
      }
      footerNote="Corrections apply to this visit and to the patient's permanent record."
    >
      <div className={styles['editForm']}>
        {error && (
          <Alert tone="critical" live>
            {error}
          </Alert>
        )}

        <FieldRow>
          <Field label="First name" required>
            <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
          </Field>
          <Field label="Surname" required>
            <Input value={form.surname} onChange={(e) => set('surname', e.target.value)} />
          </Field>
        </FieldRow>

        <Field label="Middle name" optional>
          <Input value={form.middleName} onChange={(e) => set('middleName', e.target.value)} />
        </Field>

        <FieldRow>
          <Field label="Age" required>
            <Input value={form.age} onChange={(e) => set('age', e.target.value)} />
          </Field>
          <Field label="Sex">
            <Select value={form.sex} onChange={(e) => set('sex', e.target.value)}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </Select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Phone" required>
            <Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Email" optional>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
        </FieldRow>

        <Field label="Address" optional>
          <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
        </Field>

        <FieldRow>
          <Field label="Referred by" optional>
            <Input value={form.referredBy} onChange={(e) => set('referredBy', e.target.value)} />
          </Field>
          <Field label="Referring facility" optional>
            <Input
              value={form.referringFacility}
              onChange={(e) => set('referringFacility', e.target.value)}
            />
          </Field>
        </FieldRow>
      </div>
    </Dialog>
  );
}
