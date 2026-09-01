import React from 'react';
import { RiCloseLine } from '@remixicon/react';
import { ReferringFacility } from '@/lib/store';
import Field from './Field';
import { inputStyle, btnStyle, modalOverlay, modalBox, closeBtn } from './styles';

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
  return (
    <div style={modalOverlay}>
      <form onSubmit={onSubmit} style={{ ...modalBox, maxWidth: 450 }}>
        <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>Quick Register Referring Doctor</h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.7rem', marginTop: '0.15rem' }}>Add a new referring doctor to the system database</p>
          </div>
          <button type="button" onClick={onClose} style={closeBtn}><RiCloseLine size={16} /></button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', background: 'white' }}>
          {error && (
            <div style={{ color: 'var(--red)', fontSize: '0.75rem', background: 'var(--red-light)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid #f5c6cb' }}>
              {error}
            </div>
          )}

          <Field label="Doctor's Name *">
            <input
              required
              style={inputStyle(false)}
              placeholder="e.g. John Doe"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
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
                placeholder="e.g. doc@hospital.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Affiliated Facility">
            <select
              style={inputStyle(false)}
              value={form.facility_id}
              onChange={e => setForm({ ...form, facility_id: e.target.value })}
            >
              <option value="">Independent / None</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </Field>
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
            {saving ? 'Saving...' : 'Register Doctor'}
          </button>
        </div>
      </form>
    </div>
  );
}
