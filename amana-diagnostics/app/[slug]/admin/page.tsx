'use client';
import { useAuth } from '@/components/AuthProvider';
import { RiDashboardLine, RiTeamLine, RiHospitalLine, RiMailSendLine } from '@remixicon/react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

export default function AdminOverview() {
  const { organization } = useAuth();
  const supabase = createClient();
  const [stats, setStats] = useState({ staffCount: 0, pendingInvites: 0 });

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
        try {
          const res = await fetch(`/api/profiles?organizationId=${organization.id}`);
          if (res.ok) {
            const profiles = await res.json();
            staffCount = Array.isArray(profiles) ? profiles.length : 0;
          }
        } catch (err) {
          console.error('Failed to fetch local profiles for stats:', err);
        }

        try {
          const { count, error } = await supabase
            .from('invitations')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organization.id)
            .is('accepted_at', null);
          if (!error && count !== null) {
            inviteCount = count;
          }
        } catch (err) {
          console.warn('Failed to fetch invitations from Supabase (offline fallback):', err);
        }
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
    <div style={{ minHeight: '100vh', background: 'var(--gray-50)' }}>
      <div style={{ background: 'white', borderBottom: '1px solid var(--gray-200)', padding: '1.5rem 2rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--gray-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RiDashboardLine size={24} color="var(--teal-600)" /> Workspace Overview
        </h1>
        <p style={{ color: 'var(--gray-500)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Welcome back to the {organization?.name} admin console.
        </p>
      </div>

      <div style={{ padding: '0 2rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          
          <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(68,114,196,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4472c4' }}>
              <RiTeamLine size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{stats.staffCount}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', marginTop: '0.2rem' }}>Active Staff</div>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <RiMailSendLine size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{stats.pendingInvites}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', marginTop: '0.2rem' }}>Pending Invites</div>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <RiHospitalLine size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.2 }}>{organization?.slug}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', marginTop: '0.2rem' }}>Workspace ID</div>
            </div>
          </div>

        </div>

        <div style={{ background: 'white', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: '2rem', textAlign: 'center' }}>
           <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Ready to start your day?</h3>
           <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Use the sidebar to navigate to Reception, Laboratory, or Radiology to view today's queues.</p>
        </div>
      </div>
    </div>
  );
}
