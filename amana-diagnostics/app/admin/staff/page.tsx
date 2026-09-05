'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

/**
 * The old, workspace-less staff screen.
 *
 * There were two staff screens and they did not agree. This one changed a role
 * by writing `profiles.role` straight from the browser, which left the auth
 * user's metadata saying something different; the workspace one goes through
 * `/api/staff/update`, which keeps both in step. It also created accounts by
 * typing a password for someone, a second route into the clinic alongside
 * invitations, and its own access check let *reception* manage staff.
 *
 * Nothing links here. Rather than keep two implementations of one job in step,
 * this now sends people to the real screen.
 */
export default function LegacyStaffRedirect() {
  const { organization, loading, profileReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !profileReady) return;
    router.replace(organization?.slug ? `/${organization.slug}/admin/staff` : '/');
  }, [loading, profileReady, organization?.slug, router]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--gray-500)', fontSize: '0.85rem',
    }}>
      Taking you to staff management…
    </div>
  );
}
