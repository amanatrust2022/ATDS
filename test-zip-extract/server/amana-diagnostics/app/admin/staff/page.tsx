'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import Header from '@/components/Header';
import { RiUserAddLine, RiShieldUserLine, RiDeleteBinLine, RiSettings4Line } from '@remixicon/react';

export default function StaffManagement() {
  const { profile } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'reception' });
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  const fetchStaff = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setStaff(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Note: In a real app, you'd use a Supabase Edge Function or the Admin Auth API 
    // to create users without logging them in. 
    // For this prototype, we'll use a signUp with metadata which our trigger handles.
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.fullName,
          role: form.role
        }
      }
    });

    if (error) {
      alert(error.message);
    } else {
      alert('Staff registered successfully! They can now log in.');
      setForm({ email: '', password: '', fullName: '', role: 'reception' });
      fetchStaff();
    }
    setSubmitting(false);
  };

  const updateRole = async (id: string, role: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id);
    if (error) alert(error.message);
    else fetchStaff();
  };

  if (profile?.role !== 'admin' && profile?.role !== 'reception') {
     // For now, let's allow reception to see it for testing, or redirect
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <Header 
        title="Staff Management" 
        subtitle="Manage hospital personnel and access roles"
        icon={<RiShieldUserLine size={24} color="white" />}
        accentColor="var(--teal-800)"
      />

      <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
          
          {/* Add Staff Form */}
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)', height: 'fit-content' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
              <RiUserAddLine size={20} color="var(--teal-700)" /> Register New Staff
            </h3>
            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input 
                  style={inputStyle} 
                  value={form.fullName} 
                  onChange={e => setForm({...form, fullName: e.target.value})} 
                  required 
                  placeholder="e.g. Dr. John Doe"
                />
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input 
                  style={inputStyle} 
                  type="email"
                  value={form.email} 
                  onChange={e => setForm({...form, email: e.target.value})} 
                  required 
                  placeholder="staff@amana.com"
                />
              </div>
              <div>
                <label style={labelStyle}>Temporary Password</label>
                <input 
                  style={inputStyle} 
                  type="password"
                  value={form.password} 
                  onChange={e => setForm({...form, password: e.target.value})} 
                  required 
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label style={labelStyle}>Access Role</label>
                <select 
                  style={inputStyle} 
                  value={form.role} 
                  onChange={e => setForm({...form, role: e.target.value})}
                >
                  <option value="reception">Receptionist</option>
                  <option value="lab">Lab Scientist</option>
                  <option value="radiology">Radiologist</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                style={{ 
                  marginTop: '0.5rem', background: 'var(--teal-700)', color: 'white', border: 'none', 
                  padding: '0.75rem', borderRadius: 'var(--radius)', fontWeight: 700, cursor: 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? 'Registering...' : 'Create Staff Account'}
              </button>
            </form>
          </div>

          {/* Staff List */}
          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Existing Staff ({staff.length})</h3>
              <RiSettings4Line size={18} color="var(--gray-400)" />
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {loading ? (
                <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>Loading staff list...</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: 'white', borderBottom: '1px solid var(--gray-200)' }}>
                      <th style={thStyle}>Staff Member</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 600 }}>{s.full_name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{s.id.slice(0, 8)}...</div>
                        </td>
                        <td style={tdStyle}>
                          <select 
                            value={s.role} 
                            onChange={e => updateRole(s.id, e.target.value)}
                            style={{ 
                              padding: '0.2rem 0.4rem', border: '1px solid var(--gray-300)', borderRadius: '4px', fontSize: '0.75rem',
                              background: s.role === 'admin' ? 'var(--red-light)' : s.role === 'reception' ? 'var(--teal-50)' : 'var(--gray-100)',
                              color: s.role === 'admin' ? 'var(--red)' : s.role === 'reception' ? 'var(--teal-800)' : 'var(--gray-700)',
                              fontWeight: 600
                            }}
                          >
                            <option value="reception">Reception</option>
                            <option value="lab">Lab</option>
                            <option value="radiology">Radiology</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td style={tdStyle}>
                          <button style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}>
                            <RiDeleteBinLine size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.4rem', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '0.85rem', outline: 'none' };
const thStyle = { padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' as const };
const tdStyle = { padding: '0.75rem 1rem', fontSize: '0.85rem' };
