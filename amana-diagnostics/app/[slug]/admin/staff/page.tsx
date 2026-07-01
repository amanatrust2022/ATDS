'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { 
  RiUserAddLine, 
  RiShieldUserLine, 
  RiLinkM, 
  RiDeleteBinLine, 
  RiTimeLine, 
  RiTeamLine,
  RiCloseLine,
  RiMailLine,
  RiFingerprintLine,
  RiCalendarEventLine,
  RiCheckDoubleLine,
  RiAlertLine
} from '@remixicon/react';
import { useParams } from 'next/navigation';

export default function StaffManagement() {
  const { profile, organization } = useAuth();
  const params = useParams();
  const slug = params?.slug as string;
  const [staff, setStaff] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'reception' });
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const supabase = createClient();

  const isLocalMode = typeof window !== 'undefined'
    ? (localStorage.getItem('amana_local_mode') === null
        ? (window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' || 
           window.location.hostname.startsWith('192.168.') || 
           window.location.hostname.startsWith('10.') || 
           window.location.hostname.startsWith('172.'))
        : localStorage.getItem('amana_local_mode') === 'true')
    : (process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async (isBackground = false) => {
    if (!organization) return;
    if (!isBackground) {
      setLoading(true);
    } else {
      setLoadingRefresh(true);
    }
    
    let staffData: any[] = [];
    let inviteData: any[] = [];

    if (isLocalMode) {
      try {
        const res = await fetch(`/api/profiles?organizationId=${organization.id}`);
        if (res.ok) {
          staffData = await res.json();
        }
      } catch (err) {
        console.error('Failed to fetch local profiles:', err);
      }

      try {
        const { data, error } = await supabase
          .from('invitations')
          .select('*')
          .eq('organization_id', organization.id)
          .is('accepted_at', null)
          .order('created_at', { ascending: false });
        if (!error && data) {
          inviteData = data;
        }
      } catch (err) {
        console.warn('Failed to fetch invitations from Supabase (offline fallback):', err);
      }
    } else {
      try {
        const [{ data: sData }, { data: iData }] = await Promise.all([
          supabase.from('profiles').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }),
          supabase.from('invitations').select('*').eq('organization_id', organization.id).is('accepted_at', null).order('created_at', { ascending: false }),
        ]);
        staffData = sData || [];
        inviteData = iData || [];
      } catch (err) {
        console.error('Failed to fetch staff/invites from Supabase:', err);
      }
    }

    setStaff(staffData || []);
    setInvites(inviteData || []);
    
    // Save to cache
    try {
      localStorage.setItem(`amana_cached_staff_${organization.id}`, JSON.stringify(staffData || []));
      localStorage.setItem(`amana_cached_invites_${organization.id}`, JSON.stringify(inviteData || []));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }

    setLoading(false);
    setLoadingRefresh(false);
  };

  // Load from cache first for SWR instant response
  useEffect(() => {
    if (!organization) return;
    
    const cachedStaff = localStorage.getItem(`amana_cached_staff_${organization.id}`);
    const cachedInvites = localStorage.getItem(`amana_cached_invites_${organization.id}`);
    
    if (cachedStaff) {
      setStaff(JSON.parse(cachedStaff));
      setLoading(false);
    }
    if (cachedInvites) {
      setInvites(JSON.parse(cachedInvites));
    }

    fetchData(true);
  }, [organization]);

  const [sendingEmail, setSendingEmail] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    setSubmitting(true); setInviteLink(''); setSendingEmail(true);

    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // 1. Insert into DB with explicit expires_at
    const { error: dbError } = await supabase.from('invitations').insert([{
      organization_id: organization.id,
      email: form.email.trim().toLowerCase(),
      role: form.role,
      token,
      invited_by: (await supabase.auth.getUser()).data.user?.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }]);

    if (dbError) { 
      showToast(dbError.message, 'error');
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
          email: form.email.trim().toLowerCase(),
          role: form.role,
          organizationName: organization.name,
          inviteLink: link,
        }),
      });

      if (!emailRes.ok) throw new Error('Failed to send email');
      
      setInviteLink(link);
      setForm({ email: '', role: 'reception' });
      fetchData(true);
      showToast('Invitation email sent successfully!');
    } catch (err: any) {
      console.error('Email send error:', err);
      setInviteLink(link); // Still show link as fallback
      showToast('Invitation created, but email failed. Copy the link manually.', 'error');
    } finally {
      setSubmitting(false);
      setSendingEmail(false);
    }
  };

  const updateRole = async (id: string, role: string) => {
    try {
      await supabase.from('profiles').update({ role }).eq('id', id);
      showToast('Staff role updated successfully!');
    } catch (err) {
      console.warn('Failed to update role in Supabase:', err);
      showToast('Failed to update role in cloud.', 'error');
    }

    if (isLocalMode) {
      try {
        const staffMember = staff.find(s => s.id === id);
        if (staffMember) {
          await fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...staffMember, role })
          });
        }
      } catch (err) {
        console.error('Failed to update role locally:', err);
      }
    }

    fetchData(true);
  };

  const revokeInvite = async (id: string) => {
    if (!confirm('Revoke this pending invitation?')) return;
    try {
      await supabase.from('invitations').delete().eq('id', id);
      showToast('Invitation revoked successfully!');
    } catch (err) {
      console.warn('Failed to revoke invite in Supabase:', err);
      showToast('Failed to revoke invitation.', 'error');
    }
    fetchData(true);
  };

  const removeStaff = async (s: any) => {
    if (!confirm(`Remove ${s.full_name || 'this staff member'} from the workspace?`)) return;

    try {
      await supabase.from('profiles').update({ organization_id: null, role: 'reception' }).eq('id', s.id);
      showToast('Staff removed from workspace.');
    } catch (err) {
      console.warn('Failed to remove staff from Supabase:', err);
      showToast('Failed to remove staff from cloud.', 'error');
    }

    if (isLocalMode) {
      try {
        await fetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...s, organization_id: null, role: 'reception' })
        });
      } catch (err) {
        console.error('Failed to remove staff locally:', err);
      }
    }

    fetchData(true);
  };

  const getInitials = (name: string) => {
    if (!name) return 'ST';
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 55%, 42%)`;
  };

  const parseNameDetails = (s: any) => {
    if (!s) return { title: '—', firstName: '—', surname: '—', lastName: '—' };
    const title = s.title || '';
    const firstName = s.first_name || '';
    const surname = s.surname || '';
    const lastName = s.last_name || '';

    // If we have at least first_name or surname in DB, return what we have
    if (firstName || surname) {
      return {
        title: title || '—',
        firstName: firstName || '—',
        surname: surname || '—',
        lastName: lastName || '—'
      };
    }

    // Otherwise, parse from full_name dynamically
    const fullName = s.full_name || '';
    const parts = fullName.trim().split(/\s+/);
    
    let parsedTitle = '';
    let parsedFirstName = '';
    let parsedSurname = '';
    let parsedLastName = '';

    const titles = ['dr.', 'dr', 'prof.', 'prof', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms', 'pharm.', 'pharm'];
    let currentIndex = 0;

    if (parts.length > 0 && titles.includes(parts[0].toLowerCase())) {
      parsedTitle = parts[0];
      currentIndex = 1;
    }

    const remainingParts = parts.slice(currentIndex);
    if (remainingParts.length === 1) {
      parsedFirstName = remainingParts[0];
    } else if (remainingParts.length === 2) {
      parsedFirstName = remainingParts[0];
      parsedSurname = remainingParts[1];
    } else if (remainingParts.length >= 3) {
      parsedFirstName = remainingParts[0];
      parsedLastName = remainingParts.slice(1, -1).join(' ');
      parsedSurname = remainingParts[remainingParts.length - 1];
    }

    return {
      title: parsedTitle || '—',
      firstName: parsedFirstName || '—',
      surname: parsedSurname || '—',
      lastName: parsedLastName || '—'
    };
  };

  const roleColors: Record<string, { bg: string; color: string; label: string; desc: string }> = {
    admin: { bg: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', label: 'Administrator', desc: 'Full administrative access to all settings, billing, records, and personnel controls.' },
    reception: { bg: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', label: 'Receptionist', desc: 'Manage patient registrations, check-ins, slip generation, and basic queue management.' },
    lab: { bg: 'rgba(16, 185, 129, 0.08)', color: '#10b981', label: 'Lab Scientist', desc: 'Process lab test specimens, enter parameters values, and sign off lab diagnostic reports.' },
    radiology: { bg: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', label: 'Radiologist', desc: 'Manage radiological imaging, document findings, impressions, and sign off scan results.' },
  };

  const inp: React.CSSProperties = { width: '100%', padding: '0.65rem 0.85rem', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: '0.85rem', outline: 'none', background: 'white', transition: 'border-color 0.2s' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.35rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .staff-row {
          transition: background-color 0.15s ease;
        }
        .staff-row:hover {
          background-color: var(--gray-50) !important;
          cursor: pointer;
        }
        .close-btn:hover {
          background-color: var(--gray-100) !important;
          transform: rotate(90deg);
        }
        .close-btn {
          transition: all 0.25s ease;
        }
        .toast-notify {
          animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .loading-pulse {
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        @media (max-width: 768px) {
          .modal-grid {
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
          }
          .modal-right-col {
            border-left: none !important;
            padding-left: 0 !important;
          }
        }
      `}</style>

      {/* Floating custom toasts */}
      {toast && (
        <div className="toast-notify" style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: toast.type === 'success' ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '0.85rem 1.5rem',
          borderRadius: '10px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
          zIndex: 2000,
          fontWeight: 600,
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          {toast.type === 'success' ? <RiCheckDoubleLine size={18} /> : <RiAlertLine size={18} />}
          {toast.message}
        </div>
      )}

      {/* Inline Header for Admin Page */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 2rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gray-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', letterSpacing: '-0.02em' }}>
            <RiTeamLine size={24} color="var(--teal-700)" /> Staff Management
          </h1>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            Invite users and manage roles for your workspace.
          </p>
        </div>
        {loadingRefresh && (
          <div className="loading-pulse" style={{ fontSize: '0.75rem', background: 'var(--teal-50)', color: 'var(--teal-800)', padding: '0.3rem 0.6rem', borderRadius: '100px', fontWeight: 600, border: '1px solid var(--teal-100)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal-700)', display: 'inline-block' }}></span>
            Updating...
          </div>
        )}
      </div>

      <div style={{ padding: '0 2rem 3rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '2rem', alignItems: 'start' }}>

          {/* Left: Invite form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--gray-200)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)' }}>
              <div style={{ background: 'var(--teal-800)', padding: '1.25rem 1.5rem' }}>
                <h3 style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <RiUserAddLine size={18} /> Invite Staff Member
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginTop: '0.3rem', margin: 0 }}>
                  Send an email invitation link to setup their credentials securely.
                </p>
              </div>
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={lbl}>Staff Email *</label>
                    <input style={inp} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="staff@example.com" />
                  </div>
                  <div>
                    <label style={lbl}>Access Role *</label>
                    <select style={inp} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                      <option value="reception">Receptionist</option>
                      <option value="lab">Lab Scientist</option>
                      <option value="radiology">Radiologist</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <button type="submit" disabled={submitting} style={{ background: 'var(--teal-700)', color: 'white', border: 'none', borderRadius: 'var(--radius)', padding: '0.75rem', fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.7 : 1, transition: 'all 0.15s', fontSize: '0.85rem' }}>
                    {submitting ? 'Generating link...' : 'Generate Invite Link'}
                  </button>
                </form>

                {inviteLink && (
                  <div style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-200)', borderRadius: '10px', padding: '1rem', marginTop: '0.25rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--teal-800)', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: 0 }}>
                      <RiLinkM size={14} /> Invite link generated successfully:
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                      <input readOnly value={inviteLink} style={{ ...inp, fontSize: '0.75rem', flex: 1, background: 'white', border: '1px solid var(--teal-200)', padding: '0.5rem' }} onClick={e => (e.target as HTMLInputElement).select()} />
                      <button onClick={() => { navigator.clipboard.writeText(inviteLink); showToast('Link copied!'); }} style={{ background: 'var(--teal-700)', color: 'white', border: 'none', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        Copy
                      </button>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--teal-600)', marginTop: '0.5rem', marginBottom: 0 }}>Link valid for 7 days.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Pending invites */}
            {invites.length > 0 && (
              <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--gray-200)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)' }}>
                <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--gray-50)' }}>
                  <RiTimeLine size={16} color="var(--amber-700)" />
                  <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--gray-700)' }}>Pending Invites ({invites.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {invites.map(inv => (
                    <div key={inv.id} style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--gray-50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--gray-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.email}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                            background: roleColors[inv.role]?.bg, color: roleColors[inv.role]?.color
                          }}>{inv.role}</span>
                          <span>·</span>
                          <span>Expires {new Date(inv.expires_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button onClick={() => revokeInvite(inv.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%' }}>
                        <RiDeleteBinLine size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Staff table */}
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--gray-200)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.03)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--gray-800)', margin: 0 }}>Team Members ({staff.length})</h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 500 }}>Click row to view profile</span>
            </div>
            {loading ? (
              <p style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-500)', fontSize: '0.9rem' }}>Loading team members...</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                      {['Staff Member', 'Access Role', 'Signature Status'].map(h => (
                        <th key={h} style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map(s => (
                      <tr 
                        key={s.id} 
                        className="staff-row"
                        onClick={() => setSelectedStaff(s)}
                        style={{ borderBottom: '1px solid var(--gray-100)' }}
                      >
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: '50%', background: getAvatarColor(s.full_name || 'Staff'),
                              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.85rem'
                            }}>
                              {getInitials(s.full_name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--gray-900)' }}>{s.full_name || '(pending setup)'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.1rem' }}>{s.email || 'No email linked'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem' }} onClick={e => e.stopPropagation()}>
                          <select
                            value={s.role}
                            onChange={e => updateRole(s.id, e.target.value)}
                            disabled={s.id === profile?.id}
                            style={{
                              padding: '0.3rem 0.75rem', border: '1px solid transparent', borderRadius: 100, fontSize: '0.75rem', fontWeight: 700, 
                              cursor: s.id === profile?.id ? 'default' : 'pointer',
                              background: roleColors[s.role]?.bg || 'var(--gray-100)',
                              color: roleColors[s.role]?.color || 'var(--gray-700)',
                              outline: 'none'
                            }}
                          >
                            <option value="reception">Receptionist</option>
                            <option value="lab">Lab Scientist</option>
                            <option value="radiology">Radiologist</option>
                            <option value="admin">Administrator</option>
                          </select>
                          {s.id === profile?.id && <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)', marginLeft: '0.4rem', fontWeight: 600 }}>You</span>}
                        </td>
                        <td style={{ padding: '0.9rem 1.25rem' }}>
                          {s.signature_url ? (
                            <span style={{ fontSize: '0.72rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <RiCheckDoubleLine size={12} /> Configured
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', background: 'var(--gray-100)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                              Not Uploaded
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Staff Profile Modal */}
      {selectedStaff && (
        <div 
          onClick={() => setSelectedStaff(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, animation: 'fadeIn 0.2s ease-out',
            padding: '24px',
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '24px', padding: '2.5rem',
              width: '95%', maxWidth: '880px',
              maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2), 0 0 40px rgba(0,0,0,0.02)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              position: 'relative', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Close button */}
            <button 
              onClick={() => setSelectedStaff(null)}
              className="close-btn"
              style={{
                position: 'absolute', top: '1.25rem', right: '1.25rem',
                border: 'none', background: 'none', borderRadius: '50%',
                padding: '0.5rem', cursor: 'pointer', color: 'var(--gray-400)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <RiCloseLine size={20} />
            </button>

            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--gray-100)', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%', background: getAvatarColor(selectedStaff.full_name || 'Staff'),
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.2rem'
              }}>
                {getInitials(selectedStaff.full_name)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--gray-900)', margin: 0, letterSpacing: '-0.02em' }}>
                  {selectedStaff.full_name || '(pending setup)'}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <span style={{
                    padding: '0.15rem 0.6rem', borderRadius: '100px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                    background: roleColors[selectedStaff.role]?.bg, color: roleColors[selectedStaff.role]?.color
                  }}>
                    {roleColors[selectedStaff.role]?.label || selectedStaff.role}
                  </span>
                  {selectedStaff.id === profile?.id && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)', fontWeight: 600 }}>(You)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Profile Landscape Details (Two columns grid on desktop, one column on mobile) */}
            <div className="modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', alignItems: 'start' }}>
              
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Detailed Name Breakdown */}
                <div>
                  <span style={{ ...lbl, marginBottom: '0.5rem' }}>Name Details</span>
                  {(() => {
                    const nameDetails = parseNameDetails(selectedStaff);
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--gray-50)', padding: '1rem', borderRadius: '12px' }}>
                        <div>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', display: 'block' }}>Title</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)', textTransform: 'capitalize' }}>{nameDetails.title}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', display: 'block' }}>First Name</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)', textTransform: 'capitalize' }}>{nameDetails.firstName}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', display: 'block' }}>Surname</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)', textTransform: 'capitalize' }}>{nameDetails.surname}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', display: 'block' }}>Last Name</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)', textTransform: 'capitalize' }}>{nameDetails.lastName}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Signature Preview */}
                <div>
                  <span style={lbl}>Digital Signature</span>
                  {selectedStaff.signature_url ? (
                    <div style={{ border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '1rem', background: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <img 
                        src={selectedStaff.signature_url} 
                        alt={`${selectedStaff.full_name || 'Staff'} signature`} 
                        style={{ maxHeight: '65px', maxWidth: '100%', objectFit: 'contain' }}
                      />
                      <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <RiCheckDoubleLine size={12} /> Verified Signature Image
                      </span>
                    </div>
                  ) : (
                    <div style={{ border: '1px dashed var(--gray-300)', borderRadius: '12px', padding: '1rem', background: 'var(--gray-50)', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.78rem', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                      <RiAlertLine size={16} color="var(--gray-400)" />
                      <span>No signature image uploaded yet.</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)' }}>Required for Lab and Radiology practitioners to sign reports.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="modal-right-col" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: '1px solid var(--gray-100)', paddingLeft: '2.5rem' }}>
                {/* Contact and Metadata */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                    <RiMailLine size={16} color="var(--gray-400)" />
                    <div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>Email Address</span>
                      <span style={{ fontWeight: 500, color: 'var(--gray-800)', marginTop: '0.15rem', display: 'block' }}>{selectedStaff.email || 'No email linked'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                    <RiFingerprintLine size={16} color="var(--gray-400)" />
                    <div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>Personnel ID</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--gray-600)', marginTop: '0.15rem', display: 'block' }}>{selectedStaff.id}</span>
                    </div>
                  </div>

                  {selectedStaff.created_at && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                      <RiCalendarEventLine size={16} color="var(--gray-400)" />
                      <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>Join Date</span>
                        <span style={{ fontWeight: 500, color: 'var(--gray-800)', marginTop: '0.15rem', display: 'block' }}>{new Date(selectedStaff.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Role Permissions Description */}
                <div style={{ background: 'var(--teal-50)', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--teal-100)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--teal-800)', fontWeight: 700, fontSize: '0.8rem' }}>
                    <RiShieldUserLine size={16} />
                    <span>Role Permissions: {roleColors[selectedStaff.role]?.label}</span>
                  </div>
                  <p style={{ color: 'var(--teal-700)', fontSize: '0.78rem', margin: '0.35rem 0 0 0', lineHeight: 1.45 }}>
                    {roleColors[selectedStaff.role]?.desc}
                  </p>
                </div>

                {/* Manage Access Section */}
                <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={lbl}>Change Access Role</label>
                    <select
                      value={selectedStaff.role}
                      onChange={e => {
                        updateRole(selectedStaff.id, e.target.value);
                        setSelectedStaff({ ...selectedStaff, role: e.target.value });
                      }}
                      disabled={selectedStaff.id === profile?.id}
                      style={{ ...inp, marginTop: '0.4rem' }}
                    >
                      <option value="reception">Receptionist</option>
                      <option value="lab">Lab Scientist</option>
                      <option value="radiology">Radiologist</option>
                      <option value="admin">Administrator</option>
                    </select>
                    {selectedStaff.id === profile?.id && (
                      <span style={{ fontSize: '0.68rem', color: 'var(--gray-400)', marginTop: '0.25rem', display: 'block', fontWeight: 600 }}>
                        You cannot change your own role.
                      </span>
                    )}
                  </div>

                  {selectedStaff.id !== profile?.id && (
                    <button
                      onClick={() => {
                        removeStaff(selectedStaff);
                        setSelectedStaff(null);
                      }}
                      style={{
                        background: 'none', border: '1px solid #ef4444', color: '#ef4444',
                        borderRadius: 'var(--radius)', padding: '0.65rem', fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.15s', fontSize: '0.82rem', marginTop: '0.25rem'
                      }}
                      onMouseOver={e => { (e.target as HTMLButtonElement).style.backgroundColor = 'rgba(239, 68, 68, 0.05)'; }}
                      onMouseOut={e => { (e.target as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                    >
                      Remove Staff Member
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
