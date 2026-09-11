'use client';
import RequireRole from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import { RiTeamLine, RiHospitalLine, RiMailSendLine } from '@remixicon/react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Card } from '@/components/ui';
import { useShellSlot } from '@/components/shell/ShellSlot';

import styles from './overview.module.css';

function AdminOverview() {
  const { organization } = useAuth();
  const supabase = createClient();
  const [stats, setStats] = useState({ staffCount: 0, pendingInvites: 0 });

  // The shell owns the page heading; the sentence under it is the screen's.
  useShellSlot(
    { subtitle: organization ? `Welcome back to the ${organization.name} admin console.` : undefined },
    [organization?.name],
  );

  useEffect(() => {
    async function loadStats() {
      if (!organization) return;

      const isLocalMode = typeof window !== 'undefined'
        ? (localStorage.getItem('amana_local_mode') === null
            ? (window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1' ||
               window.location.hostname.startsWith('192.168.') ||
               window.location.hostname.startsWith('10.') ||
               window.location.hostname.startsWith('172.'))
            : localStorage.getItem('amana_local_mode') === 'true')
        : (process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true');

      let staffCount = 0;
      let inviteCount = 0;

      if (isLocalMode) {
        const fetchProfiles = fetch(`/api/profiles?organizationId=${organization.id}`)
          .then(res => res.ok ? res.json() : [])
          .then(profiles => {
            return Array.isArray(profiles) ? profiles.length : 0;
          })
          .catch(err => {
            console.error('Failed to fetch local profiles for stats:', err);
            return 0;
          });

        const fetchInvites = supabase
          .from('invitations')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organization.id)
          .is('accepted_at', null)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then(({ count, error }: any) => {
            if (error) throw error;
            return count || 0;
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .catch((err: any) => {
            console.warn('Failed to fetch invitations from Supabase (offline fallback):', err);
            return 0;
          });

        const [sCount, iCount] = await Promise.all([fetchProfiles, fetchInvites]);
        staffCount = sCount;
        inviteCount = iCount;
      } else {
        try {
          const [{ count: sCount }, { count: iCount }] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('organization_id', organization.id),
            supabase.from('invitations').select('*', { count: 'exact', head: true }).eq('organization_id', organization.id).is('accepted_at', null),
          ]);
          staffCount = sCount || 0;
          inviteCount = iCount || 0;
        } catch (err) {
          console.error('Failed to fetch stats from Supabase:', err);
        }
      }

      setStats({ staffCount, pendingInvites: inviteCount });
    }
    loadStats();
  }, [organization]);

  return (
    <div className={styles.page}>
      <div className={styles.stats}>
        <Card raised className={styles.tile}>
          <span className={`${styles.tileIcon} ${styles.iconStaff}`} aria-hidden="true">
            <RiTeamLine size={24} />
          </span>
          <div>
            <div className={styles.figure}>{stats.staffCount}</div>
            <div className={styles.tileLabel}>Active staff</div>
          </div>
        </Card>

        <Card raised className={styles.tile}>
          <span className={`${styles.tileIcon} ${styles.iconInvites}`} aria-hidden="true">
            <RiMailSendLine size={24} />
          </span>
          <div>
            <div className={styles.figure}>{stats.pendingInvites}</div>
            <div className={styles.tileLabel}>Pending invites</div>
          </div>
        </Card>

        <Card raised className={styles.tile}>
          <span className={`${styles.tileIcon} ${styles.iconWorkspace}`} aria-hidden="true">
            <RiHospitalLine size={24} />
          </span>
          <div>
            <div className={styles.figureText}>{organization?.slug}</div>
            <div className={styles.tileLabel}>Workspace ID</div>
          </div>
        </Card>
      </div>

      <Card raised className={styles.cta}>
        <h2 className={styles.ctaHead}>Ready to start your day?</h2>
        <p className={styles.ctaBody}>
          Use the sidebar to open Reception, Laboratory or Radiology and see today&apos;s queues.
        </p>
      </Card>
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GuardedAdminOverview(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <AdminOverview {...props} />
    </RequireRole>
  );
}
