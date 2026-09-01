import React from 'react';
import { RiCloseLine } from '@remixicon/react';
import Field from './Field';
import { inputStyle, btnStyle, modalOverlay, modalBox, closeBtn } from './styles';

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
  return (
    <div style={modalOverlay}>
      <form onSubmit={onSubmit} style={{ ...modalBox, maxWidth: 450 }}>
        <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Quick Register Referring Facility</h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', marginTop: '0.15rem' }}>Add a new referring facility to the system database</p>
          </div>
          <button type="button" onClick={onClose} style={closeBtn}><RiCloseLine size={16} /></button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', background: 'white' }}>
          {error && (
            <div style={{ color: 'var(--red)', fontSize: '0.75rem', background: 'var(--red-light)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid #f5c6cb' }}>
              {error}
            </div>
          )}

          <Field label="Facility Name *">
            <input
              required
              style={inputStyle(false)}
              placeholder="e.g. City General Hospital"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </Field>

          <Field label="Address">
            <input
              style={inputStyle(false)}
              placeholder="e.g. 12 Clinic Road, Kano"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Phone Number">
              <input
                style={inputStyle(false)}
                placeholder="e.g. +234 80..."
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email Address">
              <input
                type="email"
                style={inputStyle(false)}
                placeholder="e.g. contact@facility.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: '0.75rem', background: '#f8fafc', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={btnStyle('outline')}>Cancel</button>
          <button
            type="submit"
            disabled={saving}
            style={{
              ...btnStyle('primary'),
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? 'Saving...' : 'Register Facility'}
          </button>
        </div>
      </form>
    </div>
  );
}
