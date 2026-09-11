'use client';
import { useNotices } from '@/components/Notices';
import RequireRole from '@/components/RequireRole';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { RiAlertLine, RiCheckDoubleLine, RiLineChartLine, RiTeamLine } from '@remixicon/react';
import { useParams } from 'next/navigation';

import { Tabs, TabPanel } from '@/components/ui';
import { useShellSlot } from '@/components/shell';
import { printHtml } from '@/lib/templates';
import { apiBase, reachableOrigin } from '@/lib/cloudOrigin';
import { orgName } from '@/lib/branding';
import { buildStaffAuditHtml } from '@/lib/staffAudit';
import {
  filterByRange,
  searchStaff,
  sortStaff,
  staffRows,
  totalsFor,
  type DateRange,
  type PerformanceData,
  type SortField,
} from '@/lib/staffPerformance';

import { StaffDirectory } from './StaffDirectory';
import { StaffPerformance } from './StaffPerformance';
import { StaffProfileModal } from './StaffProfileModal';
import styles from './staff.module.css';

async function withTimeout(promise: any, ms: number, onWarning: () => void): Promise<any> {
  const timer = setTimeout(onWarning, ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

function StaffManagement() {
  const { ask } = useNotices();
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
  const [perfData, setPerfData] = useState<PerformanceData | null>(null);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('revenue');
  const supabase = createClient();

  // What this screen contributes to the shell's header, now that the shell is
  // above it rather than inside it. The heading itself comes from the nav
  // table; this is the line under it, and the quiet mark that a background
  // refresh is running.
  useShellSlot(
    {
      subtitle: 'Invite users and manage roles for your workspace.',
      actions: loadingRefresh ? (
        <span className={styles['refreshing']} role="status">
          Updating…
        </span>
      ) : undefined,
    },
    [loadingRefresh],
  );

  const fetchPerformanceData = async () => {
    if (!organization) return;
    setLoadingPerf(true);
    try {
      const res = await fetch(`/api/admin/performance?organizationId=${organization.id}&localMode=${isLocalMode}`);
      if (res.ok) {
        const data = await res.json();
        // Four arrays, guaranteed here rather than assumed four hundred lines
        // below. The dashboard reads `perfData.completedTests.filter(...)`
        // directly, and the only guard was `!perfData` — so a response that
        // came back missing any one of these (a partial failure in the route,
        // an older deployment) threw during render and took the whole admin
        // screen down to a blank page.
        setPerfData({
          completedTests: data?.completedTests ?? [],
          ledgerTransactions: data?.ledgerTransactions ?? [],
          externalCharges: data?.externalCharges ?? [],
          patientBilling: data?.patientBilling ?? [],
        });
      }
    } catch (e) {
      console.error('Failed to fetch performance data:', e);
      showToast('Failed to load performance metrics.', 'error');
    } finally {
      setLoadingPerf(false);
    }
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

    const subscription = supabase
      .channel('invitations_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations', filter: `organization_id=eq.${organization.id}` }, () => {
        fetchData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [organization]);

  useEffect(() => {
    if (activeTab === 'performance' && organization) {
      fetchPerformanceData();
    }
  }, [activeTab, organization]);

  const [sendingEmail, setSendingEmail] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (link: string, id: string = 'main') => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
    const link = `${reachableOrigin()}/invite/${token}`;
    // Update UI immediately since DB insert was successful
    setInviteLink(link);
    setForm({ email: '', role: 'reception' });
    fetchData(true);

    try {
      const apiEndpoint = `${apiBase()}/api/invite`;

      const emailRes = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          role: form.role,
          organizationName: organization.name,
          inviteLink: link,
        }),
      });

      if (!emailRes.ok) {
        // The route already says what went wrong — a missing BREVO_API_KEY, a
        // sender Brevo will not accept, a rejected address. Throwing "Failed to
        // send email" over the top of that left nothing to act on.
        let reason = `${emailRes.status}`;
        try {
          const body = await emailRes.json();
          if (body?.error) reason = body.error;
        } catch { /* not JSON; the status will have to do */ }
        throw new Error(reason);
      }
      showToast('Invitation email sent successfully!');
    } catch (err: any) {
      console.error('Email send error:', err);
      showToast(`Invitation created, but the email failed: ${err.message}. Copy the link manually.`, 'error');
    } finally {
      setSubmitting(false);
      setSendingEmail(false);
    }
  };

  const updateRole = async (id: string, role: string) => {
    try {
      const apiEndpoint = `${apiBase()}/api/staff/update`;

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_role', staffId: id, role })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update role');
      }
      
      showToast('Staff role updated successfully!');
    } catch (err: any) {
      console.warn('Failed to update role:', err);
      showToast(err.message || 'Failed to update role in cloud.', 'error');
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
    if (!await ask('Revoke this pending invitation?')) return;
    try {
      const { error } = await supabase.from('invitations').delete().eq('id', id);
      if (error) throw error;
      showToast('Invitation revoked successfully!');
    } catch (err: any) {
      console.warn('Failed to revoke invite in Supabase:', err);
      showToast(err.message || 'Failed to revoke invitation.', 'error');
    }
    fetchData(true);
  };

  const removeStaff = async (s: any) => {
    if (!await ask(`Remove ${s.full_name || 'this staff member'} from the workspace?`)) return;

    try {
      const apiEndpoint = `${apiBase()}/api/staff/update`;

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove_staff', staffId: s.id })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove staff');
      }
      
      showToast('Staff removed from workspace.');
    } catch (err: any) {
      console.warn('Failed to remove staff:', err);
      showToast(err.message || 'Failed to remove staff in cloud.', 'error');
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

  const handleExport = () => {
    if (!perfData) return;
    const now = new Date();
    const filtered = filterByRange(perfData, dateRange, now);
    printHtml(
      buildStaffAuditHtml({
        clinicName: orgName(organization),
        range: dateRange,
        totals: totalsFor(filtered),
        rows: sortStaff(searchStaff(staffRows(staff, filtered), searchQuery), sortField),
        now,
      }),
    );
  };

  return (
    <div className={styles['screen']}>
      {toast && (
        <div className={styles['toast']} data-tone={toast.type} role="status">
          {toast.type === 'success' ? <RiCheckDoubleLine size={18} /> : <RiAlertLine size={18} />}
          {toast.message}
        </div>
      )}

      {/* A real tab strip: arrow keys move between tabs, only the selected one
        * is in the tab order, and each panel is associated with its tab. The
        * two bare <button>s this replaces had none of that. */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'directory' | 'performance')}
        ariaLabel="Staff sections"
        items={[
          { value: 'directory', label: 'Team directory', icon: <RiTeamLine size={16} />, count: staff.length },
          { value: 'performance', label: 'Performance', icon: <RiLineChartLine size={16} /> },
        ]}
      >
        <TabPanel value="directory">
          <StaffDirectory
            staff={staff}
            invites={invites}
            loading={loading}
            form={form}
            onFormChange={setForm}
            submitting={submitting}
            onInvite={handleInvite}
            inviteLink={inviteLink}
            copiedId={copiedId}
            onCopy={handleCopyLink}
            onRevoke={revokeInvite}
            onRoleChange={updateRole}
            onSelect={setSelectedStaff}
            myId={profile?.id}
          />
        </TabPanel>

        <TabPanel value="performance">
          <StaffPerformance
            data={perfData}
            loading={loadingPerf}
            staff={staff}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortField={sortField}
            onSortChange={setSortField}
            onExport={handleExport}
            onSelect={setSelectedStaff}
          />
        </TabPanel>
      </Tabs>

      <StaffProfileModal
        member={selectedStaff}
        isMe={selectedStaff?.id === profile?.id}
        onClose={() => setSelectedStaff(null)}
        onRoleChange={(id, role) => {
          updateRole(id, role);
          setSelectedStaff((prev: any) => (prev ? { ...prev, role } : prev));
        }}
        onRemove={(member) => {
          removeStaff(member);
          setSelectedStaff(null);
        }}
      />
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedStaffManagement(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <StaffManagement {...props} />
    </RequireRole>
  );
}
