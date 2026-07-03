'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { fetchPatients, Patient, PatientTest, updatePatient } from '@/lib/store';
import Header from '@/components/Header';
import {
  RiUserLine, RiSearchLine, RiFilterLine, RiTestTubeLine, RiRadarLine,
  RiCheckLine, RiTimeLine, RiArrowRightLine, RiCloseLine, RiDownloadLine,
  RiUserHeartLine,
} from '@remixicon/react';

export default function PatientDatabasePage() {
  const { organization } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<'all' | 'lab' | 'radiology'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Patient | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const loadPatients = () => {
    if (!organization?.id) return;
    setLoading(true);
    fetchPatients(organization.id).then(data => {
      setPatients(data);
      if (selected) {
        const updatedSelected = data.find(p => p.id === selected.id);
        setSelected(updatedSelected || null);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!organization?.id) return;
    loadPatients();
  }, [organization?.id]);

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    const nameMatch = !q || p.name.toLowerCase().includes(q) || p.slipNumber.toLowerCase().includes(q) || (p.phone || '').includes(q);
    const deptMatch = deptFilter === 'all' || p.tests.some(t => t.department === deptFilter);
    const fromMatch = !dateFrom || new Date(p.registeredAt) >= new Date(dateFrom);
    const toMatch = !dateTo || new Date(p.registeredAt) <= new Date(dateTo + 'T23:59:59');
    return nameMatch && deptMatch && fromMatch && toMatch;
  });

  const exportCsv = () => {
    const rows = [
      ['Slip No', 'Name', 'Age', 'Sex', 'Phone', 'Referred By', 'Facility', 'Tests', 'Registered'],
      ...filtered.map(p => [
        p.slipNumber, p.name, p.age, p.sex, p.phone,
        p.referredBy || '', p.referringFacility || '',
        p.tests.map(t => t.testName).join('; '),
        new Date(p.registeredAt).toLocaleDateString('en-NG'),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'patients.csv'; a.click();
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <RiUserHeartLine size={22} color="var(--teal-600)" />
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>Patient Database</h1>
            </div>
            <p style={{ color: 'var(--gray-500)', fontSize: '0.82rem', margin: 0 }}>
              {patients.length} total patients · {filtered.length} shown
            </p>
          </div>
          <button
            onClick={exportCsv}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: 'var(--teal-700)', color: 'white', border: 'none', borderRadius: 0, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <RiDownloadLine size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div style={{ padding: '1.5rem 2rem', maxWidth: 1400, margin: '0 auto' }}>
        {/* Filters */}
        <div style={{ background: 'white', border: '1px solid var(--gray-200)', padding: '1rem 1.25rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <RiSearchLine size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, slip number, phone…"
              style={{ width: '100%', paddingLeft: 30, paddingRight: '0.75rem', paddingTop: '0.5rem', paddingBottom: '0.5rem', border: '1px solid var(--gray-300)', borderRadius: 0, fontSize: '0.82rem', fontFamily: 'var(--font-body)', color: 'var(--gray-900)', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {(['all', 'lab', 'radiology'] as const).map(d => (
              <button key={d} onClick={() => setDeptFilter(d)} style={{ padding: '0.45rem 0.8rem', border: '1px solid var(--gray-300)', background: deptFilter === d ? 'var(--teal-700)' : 'white', color: deptFilter === d ? 'white' : 'var(--gray-600)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', borderRadius: 0 }}>
                {d === 'all' ? 'All' : d === 'lab' ? 'Lab' : 'Radiology'}
              </button>
            ))}
          </div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateStyle} title="From date" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateStyle} title="To date" />
          {(dateFrom || dateTo || search || deptFilter !== 'all') && (
            <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setDeptFilter('all'); }} style={{ padding: '0.45rem 0.75rem', border: '1px solid var(--gray-300)', background: 'white', color: 'var(--gray-600)', fontSize: '0.75rem', cursor: 'pointer', borderRadius: 0 }}>
              Clear
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: '1rem', alignItems: 'start' }}>
          {/* Table */}
          <div style={{ background: 'white', border: '1px solid var(--gray-200)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>Loading patients…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)' }}>No patients match your filters.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)' }}>
                    {['Slip No', 'Patient', 'Age/Sex', 'Contact', 'Tests', 'Status', 'Registered', ''].map(h => (
                      <th key={h} style={{ padding: '0.75rem 0.9rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', color: 'var(--gray-500)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const completed = p.tests.filter(t => t.status === 'completed').length;
                    const isActive = selected?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelected(isActive ? null : p)}
                        style={{ borderBottom: '1px solid var(--gray-100)', cursor: 'pointer', background: isActive ? 'var(--teal-50)' : 'white', transition: 'background 0.1s' }}
                      >
                        <td style={{ padding: '0.7rem 0.9rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--teal-700)', fontWeight: 600 }}>{p.slipNumber}</td>
                        <td style={{ padding: '0.7rem 0.9rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--gray-900)' }}>{p.name}</div>
                          {p.referredBy && <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>Ref: {p.referredBy}</div>}
                        </td>
                        <td style={{ padding: '0.7rem 0.9rem', color: 'var(--gray-700)' }}>{p.age} / {p.sex}</td>
                        <td style={{ padding: '0.7rem 0.9rem', color: 'var(--gray-600)' }}>{p.phone}</td>
                        <td style={{ padding: '0.7rem 0.9rem' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {p.tests.slice(0, 3).map(t => (
                              <span key={t.testId} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: t.department === 'lab' ? 'var(--teal-50)' : '#f5f3ff', color: t.department === 'lab' ? 'var(--teal-700)' : '#7c3aed', border: `1px solid ${t.department === 'lab' ? 'var(--teal-200)' : '#c4b5fd'}` }}>
                                {t.testName}
                              </span>
                            ))}
                            {p.tests.length > 3 && <span style={{ fontSize: '0.65rem', color: 'var(--gray-500)' }}>+{p.tests.length - 3}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '0.7rem 0.9rem' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: completed === p.tests.length ? 'var(--green)' : completed > 0 ? 'var(--amber)' : 'var(--gray-500)' }}>
                            {completed}/{p.tests.length} done
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem 0.9rem', color: 'var(--gray-500)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                          {new Date(p.registeredAt).toLocaleDateString('en-NG')}
                        </td>
                        <td style={{ padding: '0.7rem 0.9rem' }}>
                          <RiArrowRightLine size={16} color={isActive ? 'var(--teal-600)' : 'var(--gray-300)'} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ background: 'white', border: '1px solid var(--gray-200)', overflow: 'hidden', position: 'sticky', top: '1.5rem' }}>
              <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>{selected.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>{selected.slipNumber}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RiCloseLine size={16} />
                </button>
              </div>
              <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.82rem' }}>
                {[
                  ['Age / Sex', `${selected.age} / ${selected.sex}`],
                  ['Phone', selected.phone],
                  ['Email', selected.email || '—'],
                  ['Address', selected.address || '—'],
                  ['Referred By', selected.referredBy || '—'],
                  ['Facility', selected.referringFacility || '—'],
                  ['Registered', new Date(selected.registeredAt).toLocaleString('en-NG')],
                ].map(([l, v]) => (
                  <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', borderBottom: '1px solid var(--gray-100)', paddingBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--gray-500)', fontWeight: 600, whiteSpace: 'nowrap' }}>{l}</span>
                    <span style={{ color: 'var(--gray-800)', textAlign: 'right' }}>{v as string}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0 1.25rem 1rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: '0.5rem' }}>
                  Tests ({selected.tests.length})
                </div>
                {selected.tests.map(t => (
                  <div key={t.testId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {t.department === 'lab' ? <RiTestTubeLine size={13} color="var(--teal-600)" /> : <RiRadarLine size={13} color="#7c3aed" />}
                      <span style={{ fontSize: '0.78rem', color: 'var(--gray-800)' }}>{t.testName}</span>
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.4rem', background: t.status === 'completed' ? 'var(--green-light)' : t.status === 'in_progress' ? 'var(--amber-light)' : 'var(--gray-100)', color: t.status === 'completed' ? 'var(--green)' : t.status === 'in_progress' ? 'var(--amber)' : 'var(--gray-500)' }}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '0 1.25rem 1.25rem' }}>
                <button
                  onClick={() => setEditingPatient(selected)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'white',
                    border: '1px solid var(--teal-700)',
                    color: 'var(--teal-700)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    borderRadius: 0,
                    textAlign: 'center',
                    transition: 'all 0.15s'
                  }}
                >
                  Edit Patient Biodata
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingPatient && (
        <EditPatientModal
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          onSaved={() => {
            setEditingPatient(null);
            loadPatients();
          }}
        />
      )}
    </div>
  );
}

interface EditModalProps {
  patient: Patient;
  onClose: () => void;
  onSaved: () => void;
}

function EditPatientModal({ patient, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState({
    firstName: patient.firstName || '',
    surname: patient.surname || '',
    middleName: patient.middleName || '',
    age: patient.age || '',
    sex: patient.sex || 'Male',
    phone: patient.phone || '',
    email: patient.email || '',
    address: patient.address || '',
    referredBy: patient.referredBy || '',
    referringFacility: patient.referringFacility || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.surname.trim() || !form.age.trim() || !form.phone.trim()) {
      setError('Please fill in all required fields (First Name, Surname, Age, Phone)');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updatedName = [form.firstName, form.middleName, form.surname].filter(Boolean).join(' ');
      await updatePatient(patient.id, {
        ...form,
        name: updatedName,
        sex: form.sex as 'Male' | 'Female',
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to update patient');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalBox, maxWidth: 500 }}>
        <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ color: 'white', fontSize: '1rem', fontWeight: 700, margin: 0 }}>Edit Patient Record</h2>
          <button onClick={onClose} style={closeBtn}><RiCloseLine size={16} /></button>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '75vh', overflowY: 'auto' }}>
          {error && (
            <div style={{ color: 'var(--red)', background: 'var(--red-light)', border: '1px solid #f5c6cb', padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
              {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input style={inputStyle} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Surname *</label>
              <input style={inputStyle} value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Middle Name</label>
            <input style={inputStyle} value={form.middleName} onChange={e => setForm({ ...form, middleName: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Age *</label>
              <input style={inputStyle} value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Sex</label>
              <select style={inputStyle} value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value as 'Male' | 'Female' })}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Phone *</label>
            <input style={inputStyle} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Address</label>
            <input style={inputStyle} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Referred By</label>
              <input style={inputStyle} value={form.referredBy} onChange={e => setForm({ ...form, referredBy: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Referring Facility</label>
              <input style={inputStyle} value={form.referringFacility} onChange={e => setForm({ ...form, referringFacility: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={handleSave} disabled={saving} style={btnPrimary}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={onClose} style={btnOutline}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: '0.2rem'
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.45rem 0.6rem', border: '1px solid var(--gray-300)', fontSize: '0.8rem', outline: 'none', color: 'var(--gray-900)'
};
const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '0.55rem', background: 'var(--teal-700)', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer', textAlign: 'center', fontSize: '0.8rem'
};
const btnOutline: React.CSSProperties = {
  flex: 1, padding: '0.55rem', background: 'white', border: '1px solid var(--gray-300)', color: 'var(--gray-700)', fontWeight: 600, cursor: 'pointer', textAlign: 'center', fontSize: '0.8rem'
};
const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
};
const modalBox: React.CSSProperties = {
  background: 'white', width: '100%', boxShadow: 'var(--shadow-lg)', overflow: 'hidden'
};
const closeBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const dateStyle: React.CSSProperties = {
  padding: '0.45rem 0.6rem', border: '1px solid var(--gray-300)', borderRadius: 0,
  fontSize: '0.78rem', fontFamily: 'var(--font-body)', color: 'var(--gray-700)',
  outline: 'none', background: 'white',
};
