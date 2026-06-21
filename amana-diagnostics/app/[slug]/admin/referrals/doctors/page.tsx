'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  ReferringDoctor, ReferringFacility,
  fetchReferringDoctors, fetchReferringFacilities,
  addReferringDoctor, updateReferringDoctor, deleteReferringDoctor,
} from '@/lib/store';
import {
  RiUserHeartLine, RiAddLine, RiEditLine, RiDeleteBinLine, RiCloseLine,
  RiCheckLine, RiErrorWarningLine, RiPhoneLine, RiMailLine, RiHospitalLine,
} from '@remixicon/react';

const EMPTY_FORM = {
  name: '', phone: '', email: '', facility_id: '',
  commission_type: 'percentage' as 'percentage' | 'flat',
  commission_value: 0, is_active: true, organization_id: '',
};

export default function ReferringDoctorsPage() {
  const { organization } = useAuth();
  const [doctors, setDoctors] = useState<ReferringDoctor[]>([]);
  const [facilities, setFacilities] = useState<ReferringFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ReferringDoctor | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!organization?.id) return;
    const [docs, facs] = await Promise.all([
      fetchReferringDoctors(organization.id),
      fetchReferringFacilities(organization.id),
    ]);
    setDoctors(docs);
    setFacilities(facs);
    setLoading(false);
  };

  useEffect(() => { load(); }, [organization?.id]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, organization_id: organization?.id || '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (d: ReferringDoctor) => {
    setEditing(d);
    setForm({ name: d.name, phone: d.phone || '', email: d.email || '', facility_id: d.facility_id || '', commission_type: d.commission_type, commission_value: d.commission_value, is_active: d.is_active, organization_id: d.organization_id });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Doctor name is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, facility_id: form.facility_id || undefined };
      if (editing) {
        await updateReferringDoctor(editing.id, payload);
      } else {
        await addReferringDoctor(payload, organization!.id);
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
    if (!confirm(`Delete Dr. ${name}? This cannot be undone.`)) return;
    try {
      await deleteReferringDoctor(id);
      await load();
    } catch (e: any) {
      alert('Delete failed: ' + e.message);
    }
  };

  const filtered = doctors.filter(d => {
    const q = search.toLowerCase();
    const nameMatch = !q || d.name.toLowerCase().includes(q) || (d.facility_name || '').toLowerCase().includes(q);
    const facMatch = !facilityFilter || d.facility_id === facilityFilter;
    return nameMatch && facMatch;
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <RiUserHeartLine size={22} color="var(--teal-600)" />
            <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Referring Doctors</h1>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', margin: 0 }}>Manage individual doctors who refer patients — commission is tracked per referral</p>
        </div>
        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.2rem', background: 'var(--teal-700)', color: 'white', border: 'none', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', borderRadius: 0 }}>
          <RiAddLine size={16} /> Add Doctor
        </button>
      </div>

      <div style={{ padding: '1.5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search doctors…" style={{ padding: '0.5rem 0.9rem', border: '1px solid var(--gray-300)', borderRadius: 0, fontSize: '0.82rem', flex: '1 1 200px', fontFamily: 'var(--font-body)', outline: 'none' }} />
          <select value={facilityFilter} onChange={e => setFacilityFilter(e.target.value)} style={{ padding: '0.5rem 0.9rem', border: '1px solid var(--gray-300)', borderRadius: 0, fontSize: '0.82rem', fontFamily: 'var(--font-body)', outline: 'none', background: 'white', color: 'var(--gray-700)' }}>
            <option value="">All Facilities</option>
            {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Doctors', value: doctors.length, color: 'var(--teal-600)' },
            { label: 'Active', value: doctors.filter(d => d.is_active).length, color: 'var(--green)' },
            { label: 'With Commission', value: doctors.filter(d => d.commission_value > 0).length, color: 'var(--gold)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', border: '1px solid var(--gray-200)', padding: '1rem 1.25rem' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--gray-500)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>
              {search || facilityFilter ? 'No doctors match your filters.' : 'No doctors yet. Click "Add Doctor" to get started.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                  {['Doctor', 'Facility', 'Contact', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: 'var(--gray-500)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--gray-900)' }}>Dr. {d.name}</td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {d.facility_name ? (
                        <span style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--teal-700)' }}>
                          <RiHospitalLine size={13} />{d.facility_name}
                        </span>
                      ) : <span style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>Independent</span>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      {d.phone && <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><RiPhoneLine size={12} />{d.phone}</div>}
                      {d.email && <div style={{ fontSize: '0.75rem', color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}><RiMailLine size={12} />{d.email}</div>}
                      {!d.phone && !d.email && <span style={{ color: 'var(--gray-400)', fontSize: '0.75rem' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', background: d.is_active ? 'var(--green-light)' : 'var(--gray-100)', color: d.is_active ? 'var(--green)' : 'var(--gray-500)' }}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button onClick={() => openEdit(d)} style={iconBtnStyle}><RiEditLine size={15} /></button>
                        <button onClick={() => handleDelete(d.id, d.name)} style={{ ...iconBtnStyle, color: 'var(--red)' }}><RiDeleteBinLine size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ color: 'white', fontWeight: 700, fontSize: '1rem', margin: 0 }}>{editing ? 'Edit Doctor' : 'Add Referring Doctor'}</h2>
              <button onClick={() => setShowModal(false)} style={closeBtnStyle}><RiCloseLine size={16} /></button>
            </div>
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '0.6rem 0.9rem', fontSize: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}><RiErrorWarningLine size={15} />{error}</div>}
              <Field label="Doctor Name *">
                <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amina Bello" />
              </Field>
              <Field label="Linked Facility (optional)">
                <select style={inputStyle} value={form.facility_id} onChange={e => setForm({ ...form, facility_id: e.target.value })}>
                  <option value="">— Independent / no facility —</option>
                  {facilities.filter(f => f.is_active).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Field label="Phone">
                  <input style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+234 …" />
                </Field>
                <Field label="Email">
                  <input style={inputStyle} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="dr@email.com" />
                </Field>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="doc-active" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} style={{ width: 16, height: 16 }} />
                <label htmlFor="doc-active" style={{ fontSize: '0.82rem', color: 'var(--gray-700)', userSelect: 'none', cursor: 'pointer' }}>Active (visible in reception dropdown)</label>
              </div>
            </div>
            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--gray-200)', display: 'flex', gap: '0.75rem' }}>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.65rem', fontWeight: 700, fontSize: '0.85rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <RiCheckLine size={15} /> {saving ? 'Saving…' : 'Save Doctor'}
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
