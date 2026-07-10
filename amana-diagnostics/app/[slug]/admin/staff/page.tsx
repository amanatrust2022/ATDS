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
  RiAlertLine,
  RiLineChartLine,
  RiCoinsLine,
  RiFileList3Line,
  RiAwardLine,
  RiBarChart2Line,
  RiPrinterLine,
  RiDownload2Line
} from '@remixicon/react';
import { useParams } from 'next/navigation';
import { printHtml } from '@/lib/templates';

async function withTimeout(promise: any, ms: number, onWarning: () => void): Promise<any> {
  const timer = setTimeout(onWarning, ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

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
  const [activeTab, setActiveTab] = useState<'directory' | 'performance'>('directory');
  const [perfData, setPerfData] = useState<{ completedTests: any[]; ledgerTransactions: any[]; externalCharges: any[]; patientBilling: any[] } | null>(null);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('30days');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'revenue' | 'volume' | 'tat' | 'commission'>('revenue');
  const supabase = createClient();

  const fetchPerformanceData = async () => {
    if (!organization) return;
    setLoadingPerf(true);
    try {
      const res = await fetch(`/api/admin/performance?organizationId=${organization.id}&localMode=${isLocalMode}`);
      if (res.ok) {
        const data = await res.json();
        setPerfData(data);
      }
    } catch (e) {
      console.error('Failed to fetch performance data:', e);
      showToast('Failed to load performance metrics.', 'error');
    } finally {
      setLoadingPerf(false);
    }
  };

  const matchesStaff = (completedBy: string, staffMember: any) => {
    if (!completedBy) return false;
    const cb = completedBy.toLowerCase().trim();
    const fn = (staffMember.full_name || '').toLowerCase().trim();
    const id = (staffMember.id || '').toLowerCase().trim();
    const sn = (staffMember.surname || '').toLowerCase().trim();
    const first = (staffMember.first_name || '').toLowerCase().trim();
    
    return cb === fn || 
           cb === id || 
           (sn && cb.includes(sn)) || 
           (first && cb.includes(first)) ||
           fn.includes(cb);
  };

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
      const fetchProfiles = fetch(`/api/profiles?organizationId=${organization.id}`)
        .then(res => res.ok ? res.json() : [])
        .catch(err => {
          console.error('Failed to fetch local profiles:', err);
          return [];
        });

      const fetchInvites = supabase
        .from('invitations')
        .select('*')
        .eq('organization_id', organization.id)
        .is('accepted_at', null)
        .order('created_at', { ascending: false })
        .then(({ data, error }: any) => {
          if (error) throw error;
          return data || [];
        })
        .catch((err: any) => {
          console.warn('Failed to fetch invitations from Supabase (offline fallback):', err);
          return [];
        });

      const [sData, iData] = await Promise.all([fetchProfiles, fetchInvites]);
      staffData = sData;
      inviteData = iData;
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

  useEffect(() => {
    if (activeTab === 'performance' && organization) {
      fetchPerformanceData();
    }
  }, [activeTab, organization]);

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
    let origin = window.location.origin;
    if (origin.includes('tauri://') || origin.includes('localhost:1420')) {
      origin = 'https://amanadiagnostics.com'; // Fallback to cloud URL for emails
    }
    const link = `${origin}/invite/${token}`;
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

      {/* Tab Navigation */}
      <div style={{ padding: '0 2rem', maxWidth: 1200, margin: '0 auto 1.5rem auto' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)' }}>
          <button 
            onClick={() => setActiveTab('directory')}
            style={{
              padding: '0.85rem 1.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'directory' ? '2px solid var(--teal-700)' : '2px solid transparent',
              color: activeTab === 'directory' ? 'var(--teal-800)' : 'var(--gray-500)',
              fontWeight: activeTab === 'directory' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s',
              outline: 'none'
            }}
          >
            <RiTeamLine size={18} /> Team Directory
          </button>
          <button 
            onClick={() => setActiveTab('performance')}
            style={{
              padding: '0.85rem 1.5rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'performance' ? '2px solid var(--teal-700)' : '2px solid transparent',
              color: activeTab === 'performance' ? 'var(--teal-800)' : 'var(--gray-500)',
              fontWeight: activeTab === 'performance' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s',
              outline: 'none'
            }}
          >
            <RiLineChartLine size={18} /> Performance Dashboard
          </button>
        </div>
      </div>

      <div style={{ padding: '0 2rem 3rem', maxWidth: 1200, margin: '0 auto' }}>
        {activeTab === 'directory' ? (
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
        ) : (
          <div>
            {loadingPerf ? (
              <div style={{ padding: '6rem 2rem', textAlign: 'center', background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div className="loading-pulse" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--teal-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal-700)' }}>
                  <RiLineChartLine size={22} />
                </div>
                <div style={{ fontWeight: 700, color: 'var(--gray-700)', fontSize: '0.95rem' }}>Compiling Clinical & Financial Ledger Audit...</div>
                <p style={{ color: 'var(--gray-400)', fontSize: '0.78rem', margin: 0, maxWidth: 360 }}>Evaluating practitioner workloads, matching turnaround times (TAT), and calculating clinical commissions.</p>
              </div>
            ) : !perfData ? (
              <p style={{ padding: '4rem', textAlign: 'center', color: 'var(--gray-500)', fontSize: '0.9rem' }}>
                No performance metrics could be loaded.
              </p>
            ) : (() => {
              // Helper to format TAT minutes to human readable hours/minutes
              const formatTAT = (mins: number) => {
                if (!mins || isNaN(mins) || mins <= 0) return '—';
                if (mins < 60) return `${Math.round(mins)}m`;
                const hrs = Math.floor(mins / 60);
                const remMins = Math.round(mins % 60);
                return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
              };

              // Helper to determine if item matches current date range filter
              const filterByDateRange = (dateStr: string) => {
                if (!dateStr) return false;
                const date = new Date(dateStr);
                const now = new Date();
                
                if (dateRange === 'today') {
                  return date.toDateString() === now.toDateString();
                }
                if (dateRange === '7days') {
                  const sevenDaysAgo = new Date();
                  sevenDaysAgo.setDate(now.getDate() - 7);
                  return date >= sevenDaysAgo;
                }
                if (dateRange === '30days') {
                  const thirtyDaysAgo = new Date();
                  thirtyDaysAgo.setDate(now.getDate() - 30);
                  return date >= thirtyDaysAgo;
                }
                return true; // 'all'
              };

              // Filter datasets
              const filteredTests = perfData.completedTests.filter(t => filterByDateRange(t.completed_at));
              const filteredLedgerTx = perfData.ledgerTransactions.filter(t => filterByDateRange(t.created_at));
              const filteredExtCharges = perfData.externalCharges.filter(t => filterByDateRange(t.created_at));
              const filteredBilling = perfData.patientBilling.filter(p => filterByDateRange(p.created_at));

              // 1. Core KPIs
              const totalTestsCount = filteredTests.length;
              const totalClinicalRevenue = filteredTests.reduce((sum, t) => sum + (t.price || 0), 0);
              
              // 2. Commissions Calculations
              const totalCommissions = filteredTests.reduce((sum, t) => {
                if (t.commission_amount) return sum + t.commission_amount;
                if (t.commission_type === 'percentage') {
                  return sum + ((t.price || 0) * (t.commission_value || 0)) / 100;
                }
                if (t.commission_type === 'fixed') {
                  return sum + (t.commission_value || 0);
                }
                return sum;
              }, 0);

              // 3. Operational TAT metrics (minutes)
              const tatDiffs = filteredTests
                .map(t => {
                  if (!t.completed_at || !t.patient_created_at) return null;
                  const comp = new Date(t.completed_at).getTime();
                  const start = new Date(t.patient_created_at).getTime();
                  const diffMins = (comp - start) / (1000 * 60);
                  return diffMins > 0 ? diffMins : null;
                })
                .filter((d): d is number => d !== null);
              const avgTAT = tatDiffs.length > 0 ? (tatDiffs.reduce((s, v) => s + v, 0) / tatDiffs.length) : 0;

              // 4. Financial Health: billing collection rate
              const totalBilledNet = filteredBilling.reduce((sum, p) => sum + (p.net_amount || p.total_amount || 0), 0);
              const ledgerCollections = filteredLedgerTx.filter(t => t.type === 'deposit').reduce((sum, t) => sum + (t.amount || 0), 0);
              const externalCollections = filteredExtCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
              const totalReceptionCollections = ledgerCollections + externalCollections;
              const collectionRate = totalBilledNet > 0 ? Math.min((totalReceptionCollections / totalBilledNet) * 100, 100) : 100;
              const outstandingReceivables = Math.max(totalBilledNet - totalReceptionCollections, 0);

              // 5. Build individual staff productivity metrics
              const staffPerformanceList = staff.map(member => {
                const staffTests = filteredTests.filter(t => matchesStaff(t.completed_by, member));
                const testCount = staffTests.length;
                const testRev = staffTests.reduce((sum, t) => sum + (t.price || 0), 0);
                
                const commissionSum = staffTests.reduce((sum, t) => {
                  if (t.commission_amount) return sum + t.commission_amount;
                  if (t.commission_type === 'percentage') {
                    return sum + ((t.price || 0) * (t.commission_value || 0)) / 100;
                  }
                  if (t.commission_type === 'fixed') {
                    return sum + (t.commission_value || 0);
                  }
                  return sum;
                }, 0);

                const ledgerTx = filteredLedgerTx.filter(t => matchesStaff(t.created_by, member));
                const extTx = filteredExtCharges.filter(c => matchesStaff(c.created_by, member));
                
                const receiptCount = ledgerTx.filter(t => t.type === 'deposit').length + extTx.length;
                const collectionSum = ledgerTx.filter(t => t.type === 'deposit').reduce((sum, t) => sum + (t.amount || 0), 0) +
                                      extTx.reduce((sum, c) => sum + (c.amount || 0), 0);

                // Staff-specific Turnaround Time
                const staffTatDiffs = staffTests
                  .map(t => {
                    if (!t.completed_at || !t.patient_created_at) return null;
                    const comp = new Date(t.completed_at).getTime();
                    const start = new Date(t.patient_created_at).getTime();
                    const diffMins = (comp - start) / (1000 * 60);
                    return diffMins > 0 ? diffMins : null;
                  })
                  .filter((d): d is number => d !== null);
                const avgTat = staffTatDiffs.length > 0 ? (staffTatDiffs.reduce((s, v) => s + v, 0) / staffTatDiffs.length) : 0;

                return {
                  member,
                  testCount,
                  testRev,
                  commissionSum,
                  receiptCount,
                  collectionSum,
                  avgTat
                };
              });

              // Search Filter
              const searchedStaffPerf = staffPerformanceList.filter(p => 
                (p.member.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.member.role || '').toLowerCase().includes(searchQuery.toLowerCase())
              );

              // Sort calculations
              const sortedStaffPerf = [...searchedStaffPerf].sort((a, b) => {
                if (sortField === 'volume') {
                  const valA = a.member.role === 'reception' ? a.receiptCount : a.testCount;
                  const valB = b.member.role === 'reception' ? b.receiptCount : b.testCount;
                  return valB - valA;
                }
                if (sortField === 'tat') {
                  // Faster TAT is better (ascending), but place 0/nulls at the end
                  const tatA = a.avgTat || 999999;
                  const tatB = b.avgTat || 999999;
                  return tatA - tatB;
                }
                if (sortField === 'commission') {
                  return b.commissionSum - a.commissionSum;
                }
                // Default sort: Revenue generated
                const revA = a.member.role === 'reception' ? a.collectionSum : a.testRev;
                const revB = b.member.role === 'reception' ? b.collectionSum : b.testRev;
                return revB - revA;
              });

              // Calculate Department Breakdown
              const deptStats: Record<string, { count: number; rev: number }> = {};
              filteredTests.forEach(t => {
                const dept = t.department || 'Other';
                if (!deptStats[dept]) deptStats[dept] = { count: 0, rev: 0 };
                deptStats[dept].count += 1;
                deptStats[dept].rev += (t.price || 0);
              });

              // Trend charts builder
              const getTrendData = () => {
                const days: { dateLabel: string; count: number; rev: number }[] = [];
                const daysToCount = dateRange === 'today' ? 1 : dateRange === '7days' ? 7 : dateRange === '30days' ? 15 : 12;
                
                const now = new Date();
                for (let i = daysToCount - 1; i >= 0; i--) {
                  const d = new Date();
                  if (dateRange === 'all') {
                    d.setMonth(now.getMonth() - i);
                    const monthLabel = d.toLocaleString('en-US', { month: 'short' });
                    days.push({ dateLabel: monthLabel, count: 0, rev: 0 });
                  } else {
                    d.setDate(now.getDate() - i);
                    const dateLabel = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                    days.push({ dateLabel, count: 0, rev: 0 });
                  }
                }

                // Populate counts
                filteredTests.forEach(t => {
                  const testDate = new Date(t.completed_at);
                  days.forEach(day => {
                    let match = false;
                    if (dateRange === 'all') {
                      match = testDate.toLocaleString('en-US', { month: 'short' }) === day.dateLabel;
                    } else {
                      match = testDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) === day.dateLabel;
                    }
                    if (match) {
                      day.count += 1;
                      day.rev += (t.price || 0);
                    }
                  });
                });

                return days;
              };

              const trendData = getTrendData();
              const maxRev = Math.max(...trendData.map(d => d.rev), 1000);

              // SVG Area chart points generator
              const width = 580;
              const height = 130;
              const paddingLeft = 45;
              const paddingRight = 15;
              const paddingTop = 10;
              const paddingBottom = 25;
              const chartWidth = width - paddingLeft - paddingRight;
              const chartHeight = height - paddingTop - paddingBottom;

              const points = trendData.map((d, idx) => {
                const x = paddingLeft + (idx / (trendData.length - 1 || 1)) * chartWidth;
                const y = paddingTop + chartHeight - (d.rev / maxRev) * chartHeight;
                return { x, y, val: d.rev, label: d.dateLabel };
              });

              const linePath = points.length > 0
                ? `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`
                : '';

              const areaPath = points.length > 0
                ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
                : '';

              // Export print frame
              const handleExportReport = () => {
                const htmlContent = `
                  <html>
                    <head>
                      <title>EHR Auditor Module: Staff Workloads & Financial Performance Report</title>
                      <style>
                        body { font-family: 'Inter', system-ui, sans-serif; padding: 3rem; color: #1e293b; background: #fff; line-height: 1.5; }
                        h1 { color: #0f172a; font-size: 1.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: -0.02em; margin-bottom: 0.25rem; }
                        h2 { color: #0d9488; font-size: 1.1rem; font-weight: 600; margin-top: 0; margin-bottom: 2rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.75rem; }
                        table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; font-size: 0.85rem; }
                        th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
                        th { background-color: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; }
                        .kpi-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 2rem 0; }
                        .kpi-card { border: 1px solid #e2e8f0; padding: 1.25rem; border-radius: 8px; background: #f8fafc; }
                        .kpi-title { font-size: 0.68rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                        .kpi-value { font-size: 1.4rem; font-weight: 800; color: #0f172a; margin-top: 0.25rem; }
                        .meta-info { display: flex; justify-content: space-between; font-size: 0.8rem; color: #64748b; margin-bottom: 1.5rem; background: #f1f5f9; padding: 0.75rem 1rem; border-radius: 6px; }
                        .footer { margin-top: 4rem; text-align: center; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 1.5rem; }
                      </style>
                    </head>
                    <body>
                      <h1>AMANA CLINICAL DIAGNOSTICS</h1>
                      <h2>Hospital Workload Audit & Financial Performance Report</h2>
                      
                      <div class="meta-info">
                        <div><strong>Report Context:</strong> Administrative Staff Performance Metrics</div>
                        <div><strong>Scope:</strong> ${dateRange === 'today' ? 'Today' : dateRange === '7days' ? 'Last 7 Days' : dateRange === '30days' ? 'Last 30 Days' : 'All Time'}</div>
                        <div><strong>Export Time:</strong> ${new Date().toLocaleString()}</div>
                      </div>

                      <div class="kpi-container">
                        <div class="kpi-card">
                          <div class="kpi-title">Completed Workloads</div>
                          <div class="kpi-value">${totalTestsCount} Tests</div>
                        </div>
                        <div class="kpi-card">
                          <div class="kpi-title">Gross Clinical Revenue</div>
                          <div class="kpi-value">₦${totalClinicalRevenue.toLocaleString('en-NG')}</div>
                        </div>
                        <div class="kpi-card">
                          <div class="kpi-title">Clinician Commissions</div>
                          <div class="kpi-value">₦${totalCommissions.toLocaleString('en-NG')}</div>
                        </div>
                        <div class="kpi-card">
                          <div class="kpi-title">Average Turnaround (TAT)</div>
                          <div class="kpi-value">${formatTAT(avgTAT)}</div>
                        </div>
                      </div>

                      <h3>Personnel Leaderboard & Financial Tracking</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Staff Member</th>
                            <th>Role</th>
                            <th>Activity Volume</th>
                            <th>Revenue Generated</th>
                            <th>Commissions Earned</th>
                            <th>Avg. Turnaround (TAT)</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${sortedStaffPerf.map((p, idx) => `
                            <tr>
                              <td style="font-weight: 700; color: #0f172a;">#${idx + 1}</td>
                              <td style="font-weight: 600; color: #0f172a;">${p.member.full_name}</td>
                              <td><span style="font-size:0.75rem; font-weight:700;">${p.member.role.toUpperCase()}</span></td>
                              <td>${p.member.role === 'reception' ? p.receiptCount + ' Receipts' : p.testCount + ' Tests Completed'}</td>
                              <td style="font-weight: 700;">₦${(p.member.role === 'reception' ? p.collectionSum : p.testRev).toLocaleString('en-NG')}</td>
                              <td style="color:#0d9488; font-weight: 700;">₦${p.commissionSum.toLocaleString('en-NG')}</td>
                              <td style="font-weight: 600;">${p.member.role === 'reception' ? '—' : formatTAT(p.avgTat)}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>

                      <div class="footer">
                        Amana EHR Compliance and Auditing Service • Confidential Record • System Generated Document
                      </div>
                    </body>
                  </html>
                `;
                printHtml(htmlContent);
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.25s ease-out' }}>
                  
                  {/* Executive Header Controls */}
                  <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                    <div>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--teal-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auditing Dashboard</span>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--gray-900)', margin: '0.15rem 0 0 0', letterSpacing: '-0.02em' }}>Workload & Financial Ledger</h2>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {/* Date Range Selector */}
                      <div style={{ display: 'flex', background: 'var(--gray-100)', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--gray-200)' }}>
                        {(['today', '7days', '30days', 'all'] as const).map(range => (
                          <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            style={{
                              padding: '0.4rem 0.85rem',
                              borderRadius: '8px',
                              border: 'none',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              background: dateRange === range ? 'white' : 'transparent',
                              color: dateRange === range ? 'var(--gray-900)' : 'var(--gray-500)',
                              boxShadow: dateRange === range ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                              transition: 'all 0.15s'
                            }}
                          >
                            {range === 'today' ? 'Today' : range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : 'All Time'}
                          </button>
                        ))}
                      </div>

                      {/* Export Button */}
                      <button
                        onClick={handleExportReport}
                        style={{
                          background: 'var(--teal-700)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '0.55rem 1rem',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.15s',
                          boxShadow: '0 4px 6px -1px rgba(13, 148, 136, 0.2)'
                        }}
                        onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--teal-800)'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--teal-700)'; }}
                      >
                        <RiPrinterLine size={15} /> Export Audit Report
                      </button>
                    </div>
                  </div>

                  {/* EHR Grade KPI Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                    
                    {/* KPI 1 */}
                    <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workload Complete</span>
                        <div style={{ padding: '0.3rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
                          <RiFileList3Line size={18} />
                        </div>
                      </div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--gray-900)', marginTop: '0.75rem', lineHeight: 1 }}>{totalTestsCount}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.4rem', fontWeight: 600 }}>Clinical tests processed & signed</div>
                    </div>

                    {/* KPI 2 */}
                    <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gross Clinical Revenue</span>
                        <div style={{ padding: '0.3rem', borderRadius: '8px', background: 'rgba(5, 99, 193, 0.08)', color: '#0563c1' }}>
                          <RiCoinsLine size={18} />
                        </div>
                      </div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--gray-900)', marginTop: '0.75rem', lineHeight: 1 }}>₦{totalClinicalRevenue.toLocaleString('en-NG')}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--teal-700)', marginTop: '0.4rem', fontWeight: 700 }}>
                        Commissions: ₦{totalCommissions.toLocaleString('en-NG')}
                      </div>
                    </div>

                    {/* KPI 3 */}
                    <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Operational TAT</span>
                        <div style={{ padding: '0.3rem', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6' }}>
                          <RiTimeLine size={18} />
                        </div>
                      </div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--gray-900)', marginTop: '0.75rem', lineHeight: 1 }}>
                        {avgTAT > 0 ? formatTAT(avgTAT) : '—'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)', marginTop: '0.4rem', fontWeight: 600 }}>Avg patient check-in to signature</div>
                    </div>

                    {/* KPI 4 */}
                    <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Billing Collection Rate</span>
                        <div style={{ padding: '0.3rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b' }}>
                          <RiCoinsLine size={18} />
                        </div>
                      </div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--gray-900)', marginTop: '0.75rem', lineHeight: 1 }}>{collectionRate.toFixed(1)}%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--red)', marginTop: '0.4rem', fontWeight: 700 }}>
                        Uncollected: ₦{outstandingReceivables.toLocaleString('en-NG')}
                      </div>
                    </div>

                  </div>

                  {/* Dynamic SVG Revenue Trend Chart */}
                  <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '20px', padding: '1.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <div>
                        <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--gray-800)', margin: 0 }}>Revenue & Workload Velocity Trend</h3>
                        <p style={{ color: 'var(--gray-400)', fontSize: '0.72rem', margin: '0.15rem 0 0 0' }}>Billed clinical diagnostic test volume over time</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--teal-700)' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal-700)', display: 'inline-block' }}></span> Gross Revenue
                        </span>
                      </div>
                    </div>

                    <div style={{ position: 'relative', width: '100%', height: height }}>
                      {trendData.length > 1 ? (
                        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                          <defs>
                            <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(13, 148, 136, 0.25)" />
                              <stop offset="100%" stopColor="rgba(13, 148, 136, 0.0)" />
                            </linearGradient>
                          </defs>

                          {/* Grid Lines */}
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                            const yVal = paddingTop + ratio * chartHeight;
                            const labelVal = Math.round(maxRev - ratio * maxRev);
                            return (
                              <g key={i}>
                                <line x1={paddingLeft} y1={yVal} x2={width - paddingRight} y2={yVal} stroke="var(--gray-100)" strokeWidth="1" strokeDasharray="4 4" />
                                <text x={paddingLeft - 10} y={yVal + 4} textAnchor="end" fill="var(--gray-400)" fontSize="8" fontWeight="600">
                                  ₦{labelVal >= 1000 ? (labelVal / 1000) + 'k' : labelVal}
                                </text>
                              </g>
                            );
                          })}

                          {/* Area Fill */}
                          <path d={areaPath} fill="url(#chartGrad)" />

                          {/* Smooth Line */}
                          <path d={linePath} fill="none" stroke="var(--teal-700)" strokeWidth="2.5" strokeLinecap="round" />

                          {/* Interactive Node Dots */}
                          {points.map((p, idx) => (
                            <g key={idx} className="chart-node" style={{ cursor: 'pointer' }}>
                              <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="var(--teal-700)" strokeWidth="2" />
                              <text x={p.x} y={height - 5} textAnchor="middle" fill="var(--gray-500)" fontSize="8" fontWeight="700">
                                {p.label}
                              </text>
                              <title>{`${p.label}: ₦${p.val.toLocaleString()}`}</title>
                            </g>
                          ))}
                        </svg>
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: '0.8rem' }}>
                          Insufficient historical trend data in the selected range.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Main Workload & Leaderboard Split */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '2rem', alignItems: 'start' }}>
                    
                    {/* Left Panel: High Fidelity Leaderboard */}
                    <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                      
                      {/* Leaderboard Toolbar */}
                      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <h3 style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--gray-800)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <RiAwardLine size={18} color="var(--teal-700)" /> Practitioner Workloads & Ledger
                        </h3>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          {/* Search Input */}
                          <input
                            type="text"
                            placeholder="Search staff..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: '1px solid var(--gray-200)',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
                              outline: 'none',
                              width: 140,
                              fontWeight: 600
                            }}
                          />

                          {/* Sort Selector */}
                          <select
                            value={sortField}
                            onChange={e => setSortField(e.target.value as any)}
                            style={{
                              padding: '0.35rem 0.75rem',
                              border: '1px solid var(--gray-200)',
                              borderRadius: '8px',
                              fontSize: '0.78rem',
                              outline: 'none',
                              background: 'white',
                              fontWeight: 700,
                              color: 'var(--gray-700)',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="revenue">Sort by Revenue</option>
                            <option value="volume">Sort by Volume</option>
                            <option value="tat">Sort by Efficiency (TAT)</option>
                            <option value="commission">Sort by Commission</option>
                          </select>
                        </div>
                      </div>

                      {/* Leaderboard Table */}
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                              {['Rank', 'Staff Member', 'Access Role', 'Workload Volume', 'Revenue Contribution', 'Commission Earned', 'Avg Turnaround (TAT)'].map(h => (
                                <th key={h} style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedStaffPerf.map((p, idx) => (
                              <tr key={p.member.id} className="staff-row" onClick={() => setSelectedStaff(p.member)} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                                <td style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: idx === 0 ? 'var(--amber-700)' : 'var(--gray-500)', fontSize: '0.85rem' }}>
                                  #{idx + 1}
                                </td>
                                <td style={{ padding: '0.9rem 1.25rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <div style={{
                                      width: 28, height: 28, borderRadius: '50%', background: getAvatarColor(p.member.full_name || 'Staff'),
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.72rem'
                                    }}>
                                      {getInitials(p.member.full_name)}
                                    </div>
                                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--gray-800)' }}>{p.member.full_name}</div>
                                  </div>
                                </td>
                                <td style={{ padding: '0.9rem 1.25rem' }}>
                                  <span style={{
                                    padding: '0.1rem 0.45rem', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
                                    background: roleColors[p.member.role]?.bg, color: roleColors[p.member.role]?.color
                                  }}>
                                    {p.member.role}
                                  </span>
                                </td>
                                <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', color: 'var(--gray-600)', fontWeight: 600 }}>
                                  {p.member.role === 'reception' ? `${p.receiptCount} receipts` : `${p.testCount} tests`}
                                </td>
                                <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-900)' }}>
                                  ₦{(p.member.role === 'reception' ? p.collectionSum : p.testRev).toLocaleString('en-NG')}
                                </td>
                                <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--teal-800)' }}>
                                  ₦{p.commissionSum.toLocaleString('en-NG')}
                                </td>
                                <td style={{ padding: '0.9rem 1.25rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-700)' }}>
                                  {p.member.role === 'reception' ? '—' : formatTAT(p.avgTat)}
                                </td>
                              </tr>
                            ))}
                            {sortedStaffPerf.length === 0 && (
                              <tr>
                                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.82rem' }}>
                                  No staff match the filter criteria.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right Panel: Advanced Department Share & Activity Log */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      
                      {/* Clinical Dept Share */}
                      <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                        <h3 style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--gray-800)', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <RiBarChart2Line size={18} color="var(--teal-700)" /> Department Revenue Split
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                          {Object.entries(deptStats).map(([dept, stats]) => {
                            const percent = totalClinicalRevenue > 0 ? (stats.rev / totalClinicalRevenue) * 100 : 0;
                            const deptColor = dept === 'lab' ? '#10b981' : dept === 'radiology' ? '#8b5cf6' : '#3b82f6';
                            
                            return (
                              <div key={dept}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                                  <span style={{ fontWeight: 700, textTransform: 'capitalize', color: 'var(--gray-600)' }}>{dept} ({stats.count} tests)</span>
                                  <span style={{ fontWeight: 800, color: 'var(--gray-900)' }}>₦{stats.rev.toLocaleString('en-NG')} ({percent.toFixed(0)}%)</span>
                                </div>
                                <div style={{ width: '100%', height: 6, background: 'var(--gray-100)', borderRadius: 100, overflow: 'hidden' }}>
                                  <div style={{ width: `${percent}%`, height: '100%', background: deptColor, borderRadius: 100 }} />
                                </div>
                              </div>
                            );
                          })}
                          {Object.keys(deptStats).length === 0 && (
                            <p style={{ color: 'var(--gray-400)', fontSize: '0.78rem', margin: 0, textTransform: 'none', textAlign: 'center' }}>No department billing records found.</p>
                          )}
                        </div>
                      </div>

                      {/* Operations Log */}
                      <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
                        <h3 style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--gray-800)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <RiTimeLine size={18} color="var(--teal-700)" /> Activity Log (Clinical)
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          {filteredTests.slice(0, 4).map((t, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '0.75rem', borderBottom: idx < 3 ? '1px solid var(--gray-50)' : 'none', paddingBottom: idx < 3 ? '0.75rem' : 0 }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: '50%', background: 'rgba(13, 148, 136, 0.08)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal-700)', flexShrink: 0
                              }}>
                                <RiCheckDoubleLine size={14} />
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--gray-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {t.test_name}
                                </div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)', marginTop: '0.15rem' }}>
                                  Practitioner: <strong style={{ color: 'var(--gray-700)' }}>{t.completed_by}</strong> · ₦{t.price?.toLocaleString('en-NG')}
                                </div>
                              </div>
                            </div>
                          ))}
                          {filteredTests.length === 0 && (
                            <p style={{ color: 'var(--gray-400)', fontSize: '0.78rem', margin: 0, textTransform: 'none', textAlign: 'center' }}>No recent completions in range.</p>
                          )}
                        </div>
                      </div>

                    </div>

                  </div>

                </div>
              );
            })()}
          </div>
        )}
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
