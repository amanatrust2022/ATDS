'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import Header from '@/components/Header';
import { RiUserAddLine, RiShieldUserLine, RiLinkM, RiDeleteBinLine, RiTimeLine, RiTeamLine } from '@remixicon/react';
import { useParams } from 'next/navigation';

export default function StaffManagement() {
  const { profile, organization } = useAuth();
  const params = useParams();
  const slug = params?.slug as string;
  const [staff, setStaff] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: '', role: 'reception' });
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    const [{ data: staffData }, { data: inviteData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('organization_id', organization?.id).order('created_at', { ascending: false }),
      supabase.from('invitations').select('*').eq('organization_id', organization?.id).is('accepted_at', null).order('created_at', { ascending: false }),
    ]);
    setStaff(staffData || []);
    setInvites(inviteData || []);
    setLoading(false);
  };

  useEffect(() => { if (organization) fetchData(); }, [organization]);

  const [sendingEmail, setSendingEmail] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    setSubmitting(true); setInviteLink(''); setSendingEmail(true);

    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // 1. Insert into DB
    const { error: dbError } = await supabase.from('invitations').insert([{
      organization_id: organization.id,
      email: form.email,
      role: form.role,
      token,
      invited_by: (await supabase.auth.getUser()).data.user?.id,
    }]);

    if (dbError) { 
      alert(dbError.message);
      setSubmitting(false);
      setSendingEmail(false);
      return;
    }

    // 2. Send Email via Brevo
    const link = `${window.location.origin}/invite/${token}`;
    try {
      const emailRes = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          role: form.role,
          organizationName: organization.name,
          inviteLink: link,
        }),
      });

      if (!emailRes.ok) throw new Error('Failed to send email');
      
      setInviteLink(link);
      setForm({ email: '', role: 'reception' });
      fetchData();
      alert('Invitation email sent successfully!');
    } catch (err: any) {
      console.error('Email send error:', err);
      setInviteLink(link); // Still show link as fallback
      alert('Invitation created, but email failed to send. You can copy the link manually.');
    } finally {
      setSubmitting(false);
      setSendingEmail(false);
    }
  };

  const updateRole = async (id: string, role: string) => {
    await supabase.from('profiles').update({ role }).eq('id', id);
    fetchData();
  };

  const revokeInvite = async (id: string) => {
    await supabase.from('invitations').delete().eq('id', id);
    fetchData();
  };

  const roleColors: Record<string, { bg: string; color: string }> = {
    admin: { bg: 'rgba(248,113,113,0.1)', color: '#f87171' },
    reception: { bg: 'rgba(68,114,196,0.1)', color: '#7fa3e0' },
    lab: { bg: 'rgba(16,185,129,0.1)', color: '#34d399' },
    radiology: { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa' },
  };

  const inp: React.CSSProperties = { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '0.85rem', outline: 'none', background: 'white' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.3rem', textTransform: 'uppercase' as const };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      {/* Inline Header for Admin Page */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 2rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RiTeamLine size={24} color="var(--teal-600)" /> Staff Management
        </h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Invite users and manage roles for your workspace.
        </p>
      </div>

      <div style={{ padding: '0 2rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Left: Invite form */}
          <div>
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)', overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{ background: 'var(--teal-800)', padding: '1rem 1.25rem' }}>
                <h3 style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RiUserAddLine size={18} /> Invite Staff Member
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', marginTop: '0.2rem' }}>
                  A link will be generated for them to set up their account.
                </p>
              </div>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div><label style={lbl}>Staff Email *</label><input style={inp} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="staff@example.com" /></div>
                  <div>
                    <label style={lbl}>Access Role *</label>
                    <select style={inp} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                      <option value="reception">Receptionist</option>
                      <option value="lab">Lab Scientist</option>
                      <option value="radiology">Radiologist</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <button type="submit" disabled={submitting} style={{ background: 'var(--teal-700)', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '0.7rem', fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? 'Generating link...' : 'Generate Invite Link'}
                  </button>
                </form>

                {inviteLink && (
                  <div style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-200)', borderRadius: 'var(--radius)', padding: '0.75rem' }}>
                    <p style={{ fontSize: '0.72rem', color: 'var(--teal-700)', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <RiLinkM size={14} /> Invite link generated — share with staff:
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input readOnly value={inviteLink} style={{ ...inp, fontSize: '0.7rem', flex: 1, background: 'white', border: '1px solid var(--teal-200)' }} onClick={e => (e.target as HTMLInputElement).select()} />
                      <button onClick={() => navigator.clipboard.writeText(inviteLink)} style={{ background: 'var(--teal-600)', color: 'white', border: 'none', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        Copy
                      </button>
                    </div>
                    <p style={{ fontSize: '0.68rem', color: 'var(--teal-600)', marginTop: '0.4rem' }}>Link expires in 7 days.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pending invites */}
            {invites.length > 0 && (
              <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)', overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RiTimeLine size={16} color="var(--amber)" />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Pending Invites ({invites.length})</span>
                </div>
                {invites.map(inv => (
                  <div key={inv.id} style={{ padding: '0.6rem 1.25rem', borderBottom: '1px solid var(--gray-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{inv.email}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>{inv.role} · Expires {new Date(inv.expires_at).toLocaleDateString()}</div>
                    </div>
                    <button onClick={() => revokeInvite(inv.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '0.25rem' }}>
                      <RiDeleteBinLine size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Staff table */}
          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gray-300)', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Team Members ({staff.length})</h3>
            </div>
            {loading ? <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>Loading...</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                    {['Name', 'Role', 'Actions'].map(h => <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.full_name || '(pending setup)'}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)' }}>{s.id.slice(0, 12)}...</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <select
                          value={s.role}
                          onChange={e => updateRole(s.id, e.target.value)}
                          disabled={s.id === profile?.id}
                          style={{
                            padding: '0.25rem 0.6rem', border: 'none', borderRadius: 100, fontSize: '0.75rem', fontWeight: 700, cursor: s.id === profile?.id ? 'default' : 'pointer',
                            background: roleColors[s.role]?.bg || 'var(--gray-100)',
                            color: roleColors[s.role]?.color || 'var(--gray-700)',
                          }}
                        >
                          <option value="reception">Reception</option>
                          <option value="lab">Lab</option>
                          <option value="radiology">Radiology</option>
                          <option value="admin">Admin</option>
                        </select>
                        {s.id === profile?.id && <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)', marginLeft: '0.4rem' }}>You</span>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {s.id !== profile?.id && (
                          <button
                            onClick={async () => {
                              if (!confirm(`Remove ${s.full_name || 'this staff member'} from the workspace?`)) return;
                              await supabase.from('profiles').update({ organization_id: null, role: 'reception' }).eq('id', s.id);
                              fetchData();
                            }}
                            style={{ background: 'none', border: '1px solid var(--gray-200)', borderRadius: 4, color: 'var(--red)', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                            Remove
                          </button>
                        )}
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
  );
}
