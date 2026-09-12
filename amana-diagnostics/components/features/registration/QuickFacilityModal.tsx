import React from 'react';
import { Alert, Button, Dialog, Field, Input } from '@/components/ui';

import styles from './quickAdd.module.css';

export interface QuickFacilityForm {
  name: string;
  address: string;
  phone: string;
  email: string;
}

interface QuickFacilityModalProps {
  form: QuickFacilityForm;
  setForm: (form: QuickFacilityForm) => void;
  error: string;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function QuickFacilityModal({ form, setForm, error, saving, onSubmit, onClose }: QuickFacilityModalProps) {
  // The parent mounts this only while it is wanted, so open is always true and
  // every way out — Escape, the close button, the backdrop — is one onClose.
  return (
    <Dialog
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      title="Quick Register Referring Facility"
      description="Add a new referring facility to the system database"
      size="sm"
    >
      <form onSubmit={onSubmit} className={styles.body}>
        {error && <Alert tone="critical" live>{error}</Alert>}

        <Field label="Facility name" required>
          <Input
            required
            placeholder="e.g. City General Hospital"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
        </Field>

        <Field label="Address">
          <Input
            placeholder="e.g. 12 Clinic Road, Kano"
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
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
              placeholder="e.g. contact@facility.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </Field>
        </div>

        <div className={styles.actions}>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" intent="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Register Facility'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
