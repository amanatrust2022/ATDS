import React from 'react';
import { ReferringFacility } from '@/lib/store';
import { Alert, Button, Dialog, Field, Input, Select } from '@/components/ui';

import styles from './quickAdd.module.css';

export interface QuickDoctorForm {
  name: string;
  phone: string;
  email: string;
  facility_id: string;
}

interface QuickDoctorModalProps {
  form: QuickDoctorForm;
  setForm: (form: QuickDoctorForm) => void;
  facilities: ReferringFacility[];
  error: string;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function QuickDoctorModal({ form, setForm, facilities, error, saving, onSubmit, onClose }: QuickDoctorModalProps) {
  // The parent mounts this only while it is wanted, so open is always true and
  // every way out — Escape, the close button, the backdrop — is one onClose.
  return (
    <Dialog
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      title="Quick Register Referring Doctor"
      description="Add a new referring doctor to the system database"
      size="sm"
    >
      <form onSubmit={onSubmit} className={styles.body}>
        {error && <Alert tone="critical" live>{error}</Alert>}

        <Field label="Doctor's name" required>
          <Input
            required
            placeholder="e.g. John Doe"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        </Field>

        <div className={styles.pair}>
          <Field label="Phone number">
            <Input
              placeholder="e.g. +234 80..."
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="Email address">
            <Input
              type="email"
              placeholder="e.g. doc@hospital.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Affiliated facility">
          <Select
            value={form.facility_id}
            onChange={e => setForm({ ...form, facility_id: e.target.value })}
          >
            <option value="">Independent / None</option>
            {facilities.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </Select>
        </Field>

        <div className={styles.actions}>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" intent="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Register Doctor'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
