'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  ReferringFacility, fetchReferringFacilities,
  addReferringFacility, updateReferringFacility, deleteReferringFacility,
} from '@/lib/store';
import {
  RiHospitalLine, RiAddLine, RiEditLine, RiDeleteBinLine, RiCloseLine,
  RiCheckLine, RiErrorWarningLine, RiPhoneLine, RiMailLine, RiMapPinLine,
} from '@remixicon/react';

const EMPTY_FORM = {
  name: '', address: '', phone: '', email: '',
  commission_type: 'percentage' as 'percentage' | 'flat',
  commission_value: 0, is_active: true, organization_id: '',
};

export default function ReferringFacilitiesPage() {
  const { organization } = useAuth();
  const [facilities, setFacilities] = useState<ReferringFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ReferringFacility | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!organization?.id) return;
    const data = await fetchReferringFacilities(organization.id);
    setFacilities(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [organization?.id]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, organization_id: organization?.id || '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (f: ReferringFacility) => {
    setEditing(f);
    setForm({ name: f.name, address: f.address || '', phone: f.phone || '', email: f.email || '', commission_type: f.commission_type, commission_value: f.commission_value, is_active: f.is_active, organization_id: f.organization_id });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Facility name is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateReferringFacility(editing.id, form);
      } else {
        await addReferringFacility(form, organization!.id);
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteReferringFacility(id);
      await load();
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  const filtered = facilities.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      {/* Page Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <RiHospitalLine size={22} color="var(--teal-600)" />
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Referring Facilities</h1>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', margin: 0 }}>Manage hospitals, clinics and health centres that refer patients to you</p>
        </div>
        <button
          onClick={openNew}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', background: 'var(--teal-700)', color: 'white', border: 'none', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', borderRadius: 0 }}
        >
          <RiAddLine size={16} /> Add Facility
        </button>
      </div>

      <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        {/* Search */}
        <div style={{ marginBottom: '1rem' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search facilities…"
            style={{ padding: '0.55rem 0.9rem', border: '1px solid var(--gray-300)', borderRadius: 0, fontSize: '0.82rem', width: '100%', maxWidth: 320, fontFamily: 'var(--font-body)', outline: 'none' }}
          />
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Facilities', value: facilities.length, color: 'var(--teal-600)' },
            { label: 'Active', value: facilities.filter(f => f.is_active).length, color: 'var(--green)' },
            { label: 'With Commission', value: facilities.filter(f => f.commission_value > 0).length, color: 'var(--gold)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', border: '1px solid var(--gray-200)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--gray-500)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>
              {search ? 'No facilities match your search.' : 'No facilities yet. Click "Add Facility" to get started.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                  {['Facility', 'Contact', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{f.name}</div>
                      {f.address && <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiMapPinLine size={11} />{f.address}</div>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {f.phone && <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiPhoneLine size={12} />{f.phone}</div>}
                      {f.email && <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}><RiMailLine size={12} />{f.email}</div>}
                      {!f.phone && !f.email && <span style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', background: f.is_active ? 'var(--green-light)' : 'var(--gray-100)', color: f.is_active ? 'var(--green)' : 'var(--gray-500)' }}>
                        {f.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => openEdit(f)} style={iconBtnStyle} title="Edit"><RiEditLine size={15} /></button>
                        <button onClick={() => handleDelete(f.id, f.name)} style={{ ...iconBtnStyle, color: 'var(--red)' }} title="Delete"><RiDeleteBinLine size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ color: 'white', fontWeight: 700, fontSize: '1rem', margin: 0 }}>
                {editing ? 'Edit Facility' : 'Add Referring Facility'}
              </h2>
              <button onClick={() => setShowModal(false)} style={closeBtnStyle}><RiCloseLine size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {error && (
                <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '0.6rem 0.9rem', fontSize: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <RiErrorWarningLine size={15} /> {error}
                </div>
              )}
              <Field label="Facility Name *">
                <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. City General Hospital" />
              </Field>
              <Field label="Address">
                <input style={inputStyle} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Physical address" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Phone">
                  <input style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+234 …" />
                </Field>
                <Field label="Email">
                  <input style={inputStyle} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="facility@email.com" />
                </Field>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="fac-active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="fac-active" style={{ fontSize: '0.82rem', color: 'var(--gray-700)', cursor: 'pointer', userSelect: 'none' }}>Active (visible in reception dropdown)</label>
              </div>
            </div>
            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: '0.75rem', background: 'white' }}>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.65rem', fontWeight: 700, fontSize: '0.85rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <RiCheckLine size={15} /> {saving ? 'Saving…' : 'Save Facility'}
              </button>
              <button onClick={() => setShowModal(false)} style={{ padding: '0.65rem 1.2rem', border: '1px solid var(--gray-300)', background: 'white', color: 'var(--gray-700)', fontSize: '0.82rem', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: 0, fontSize: '0.82rem', fontFamily: 'var(--font-body)', color: 'var(--gray-900)', outline: 'none', background: 'white' };
const iconBtnStyle: React.CSSProperties = { background: 'var(--gray-100)', border: '1px solid var(--gray-200)', color: 'var(--gray-600)', cursor: 'pointer', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 0 };
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' };
const modalStyle: React.CSSProperties = { background: 'white', width: '100%', maxWidth: 540, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease' };
const closeBtnStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' };
