'use client';
import { useNotices } from '@/components/Notices';
import RequireRole from '@/components/RequireRole';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

import { useShellSlot } from '@/components/shell';
import { apiBase, reachableOrigin } from '@/lib/cloudOrigin';
import { accessToken, jsonAuthHeaders } from '@/lib/authHeaders';
import { useRuntimeMode } from '@/lib/useRuntimeMode';
import { roleInfo } from '@/lib/staffRoles';

import { StaffDirectory } from './StaffDirectory';
import { StaffProfileModal } from './StaffProfileModal';
import styles from './staff.module.css';

function StaffManagement() {
  const { ask, notify } = useNotices();
  const { profile, organization } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'reception' });
  const [submitting, setSubmitting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);
  const supabase = createClient();

  // What this screen contributes to the shell's header, now that the shell is
  // above it rather than inside it. The heading itself comes from the nav
  // table; this is the line under it, and the quiet mark that a background
  // refresh is running.
  useShellSlot(
    {
      subtitle: 'Who works here, and what each of them can do.',
      actions: loadingRefresh ? (
        <span className={styles['refreshing']} role="status">
          Updating…
        </span>
      ) : undefined,
    },
    [loadingRefresh],
  );

  const isLocalMode = useRuntimeMode() === 'local';

  // The screen used to draw its own toast with a setTimeout, beside the
  // app's notices. It is the app's notices now, which is also where Undo lives.
  const showToast = (message: string, type: 'success' | 'error' = 'success') =>
    notify(message, type === 'error' ? 'error' : 'success');

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
          // Invitations live only in the cloud (the invitee accepts on the
          // web), so a hub reads them from there when it can and shows none
          // when it cannot. This is the one read here that needs the internet.
          console.warn('Could not fetch invitations from the cloud:', err);
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

  /**
   * Both staff actions end at `/api/staff/update`, which holds the service-role
   * key and therefore demands an administrator's bearer token.
   *
   * On the web the screen calls it directly. On a hub the screen calls the
   * hub (`/api/staff/hub`), which writes its own copy and queues the cloud
   * call in the sync outbox for the engine to send — now if the hub is
   * online, later if it is not. This used to be decided by whether the
   * browser happened to hold a token, and "local mode" was taken to mean
   * "no cloud": a hub with a perfectly good internet connection reported
   * the change as skipped and it never left the building.
   */
  const callStaffEndpoint = async (
    body: Record<string, unknown>,
    failure: string,
  ): Promise<'ok' | 'queued'> => {
    if (isLocalMode) {
      const res = await fetch('/api/staff/hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || failure);
      }
      return 'queued';
    }

    const token = await accessToken();
    if (!token) {
      throw new Error('Your session has expired. Sign in again to manage staff.');
    }

    const res = await fetch(`${apiBase()}/api/staff/update`, {
      method: 'POST',
      headers: await jsonAuthHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || failure);
    }
    return 'ok';
  };

  /**
   * Changing what a colleague can do, with a way back.
   *
   * A confirm dialog before every change makes the ninety-nine deliberate
   * ones slower and does not stop the hundredth. An Undo on the notice
   * afterwards makes the mistaken one recoverable. The audit row goes in
   * with the change — on the cloud the route writes it, on a hub the hub
   * does — and the undo is a second row pointing back at it.
   */
  const updateRole = async (
    id: string,
    role: string,
    undo?: { reversesId: string; previousRole: string },
  ) => {
    const member = staff.find((s) => s.id === id);
    const previousRole: string | undefined = undo?.previousRole ?? member?.role;
    const auditId = crypto.randomUUID();
    try {
      const outcome = await callStaffEndpoint(
        {
          action: 'update_role', staffId: id, role,
          auditId, previousRole, reversesId: undo?.reversesId ?? null,
          actorId: profile?.id ?? null, actorName: profile?.full_name ?? null,
          entityLabel: member?.full_name ?? null,
        },
        'Failed to update role',
      );
      const who = member?.full_name || 'This person';
      const label = roleInfo(role).label;
      if (undo) {
        showToast(`${who} is ${label} again.`);
      } else {
        notify(
          outcome === 'queued'
            ? `${who} is now ${label}. The cloud follows with the next sync.`
            : `${who} is now ${label}.`,
          {
            tone: 'success',
            ...(previousRole
              ? { action: { label: 'Undo', run: () => updateRole(id, previousRole, { reversesId: auditId, previousRole: role }) } }
              : {}),
          },
        );
      }
    } catch (err: any) {
      console.warn('Failed to update role:', err);
      showToast(err.message || 'Failed to update role.', 'error');
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
    // No undo for this one: the cloud route cannot act on someone who no
    // longer belongs to the clinic. So it is a question, and it says so.
    if (!await ask(`Remove ${s.full_name || 'this staff member'} from the workspace? This cannot be undone — they would need a new invitation.`)) return;

    try {
      const outcome = await callStaffEndpoint(
        {
          action: 'remove_staff', staffId: s.id,
          auditId: crypto.randomUUID(), actorId: profile?.id ?? null,
          actorName: profile?.full_name ?? null, entityLabel: s.full_name ?? null,
        },
        'Failed to remove staff',
      );
      showToast(outcome === 'queued'
        ? 'Staff removed here. The cloud follows with the next sync.'
        : 'Staff removed from workspace.');
    } catch (err: any) {
      console.warn('Failed to remove staff:', err);
      showToast(err.message || 'Failed to remove staff.', 'error');
    }

    fetchData(true);
  };

  return (
    <div className={styles['screen']}>
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
