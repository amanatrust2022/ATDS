'use client';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { homePathFor } from '@/components/shell/navigation';
import BootScreen from '@/components/BootScreen';
import { getRuntimeMode, rememberRuntimeMode } from '@/lib/runtimeMode';
import { isRecoveryLink, RESET_PATH } from '@/lib/passwordReset';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/update-password', '/download'];

const getRolePath = homePathFor;

export default function RootWrapper({ children }: { children: React.ReactNode }) {
  const { user, profile, organization, loading, authReady, profileReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasAuthResolved = authReady && profileReady && !loading;

  const [isInitialSyncing, setIsInitialSyncing] = useState(false);
  const [syncProgressText, setSyncProgressText] = useState('Syncing database...');

  /*
   * A password-reset link that lands anywhere but the reset screen — Supabase
   * falls back to the site's front page when the return address is not one
   * it knows — is walked over to the reset screen with its tokens intact.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === RESET_PATH) return;
    if (isRecoveryLink(window.location.href)) {
      window.location.replace(`${RESET_PATH}${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered on scope:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    }
  }, []);

  /*
   * A hub that has never pulled the clinic's data is an empty register. Hold
   * the boot screen while the first pull runs, so the first thing a
   * receptionist sees is today's patients rather than nothing. The engine
   * decides what "never" means (lib/sync/engine.ts); this only asks.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasAuthResolved || !user || !organization) return;
    if (getRuntimeMode() !== 'local') return;

    let cancelled = false;
    const checkAndRunInitialSync = async () => {
      try {
        const statusRes = await fetch('/api/sync');
        if (!statusRes.ok) return;
        const status = await statusRes.json();
        if (!status.enabled || status.initialSyncDone || cancelled) return;

        setIsInitialSyncing(true);
        setSyncProgressText('Downloading workspace database...');

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        try {
          const { createClient } = await import('@/lib/supabase');
          const { data: { session } } = await createClient().auth.getSession();
          if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
        } catch (e) {
          console.warn('[RootWrapper] Could not retrieve session token for initial sync:', e);
        }

        const syncRes = await fetch('/api/sync', {
          method: 'POST',
          headers,
          body: JSON.stringify({ organizationId: organization.id }),
        });
        const after = syncRes.ok ? await syncRes.json() : null;
        if (cancelled) return;

        if (after?.initialSyncDone) {
          setSyncProgressText('Workspace ready!');
        } else if (after?.status === 'offline') {
          setSyncProgressText('No connection to the cloud yet. You can start; the download continues when it returns.');
        } else if (after?.status === 'signed_out') {
          setSyncProgressText('Sign in to download the workspace.');
        } else {
          setSyncProgressText('Still downloading. You can start; the rest arrives in the background.');
        }
        setTimeout(() => { if (!cancelled) setIsInitialSyncing(false); }, after?.initialSyncDone ? 800 : 2500);
      } catch (err) {
        console.error('Initial sync check error:', err);
        if (!cancelled) setIsInitialSyncing(false);
      }
    };

    checkAndRunInitialSync();
    return () => { cancelled = true; };
  }, [user, organization, hasAuthResolved]);

  /*
   * Ask the server which mode it is serving and remember the answer. This is
   * the only writer of the mode flag; every reader goes through
   * lib/runtimeMode. A page load whose guess was wrong reloads so that every
   * module-load snapshot agrees.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) return;
        const data = await res.json();
        const changed = rememberRuntimeMode(data.localMode ? 'local' : 'cloud');
        if (changed) window.location.reload();
      } catch (err) {
        console.warn('Failed to fetch config from server:', err);
      }
    };
    checkConfig();
  }, []);

  const currentPath = pathname || '';
  const isPublic = PUBLIC_PATHS.includes(currentPath) || currentPath.startsWith('/invite/') || currentPath.startsWith('/portal');

  useEffect(() => {
    if (loading) return;
    if (!pathname) return;
    if (!hasAuthResolved) return;

    if (!user && !isPublic) { router.replace('/login'); return; }

    const hasNoOrg = !profile || !profile.organization_id;
    const shouldGoToOnboarding = Boolean(
      user && hasNoOrg &&
      currentPath !== '/onboarding' &&
      currentPath !== '/login' &&
      currentPath !== '/signup' &&
      !currentPath.startsWith('/invite/')
    );

    if (shouldGoToOnboarding) {
      router.replace('/onboarding');
      return;
    }

    if (user && organization && (
      currentPath === '/login' ||
      currentPath === '/signup' ||
      currentPath === '/' ||
      currentPath === '/onboarding'
    )) {
      router.replace(getRolePath(profile?.role, organization.slug));
    }
  }, [user, profile, organization, loading, currentPath, hasAuthResolved]);

  // A patient on the portal has no staff session to wait for. The portal
  // authenticates against its own emailed code, and the effects above already
  // treat /portal as public — but every return below this point held it behind
  // the Supabase auth check, so a patient opening a link to their results sat
  // through the staff boot screen before the portal appeared.
  if (currentPath.startsWith('/portal')) return <>{children}</>;

  // Still loading auth
  if (loading || !authReady || !profileReady) return <BootScreen />;

  // Blocking initial sync screen
  if (isInitialSyncing) {
    return (
      <BootScreen
        label={syncProgressText}
        detail="Setting up your local environment"
      />
    );
  }

  // Auth resolved but user is on a path that will redirect them —
  // show spinner instead of flashing the page content for one frame
  const willRedirect = user && organization && (
    currentPath === '/' ||
    currentPath === '/login' ||
    currentPath === '/signup' ||
    currentPath === '/onboarding'
  );
  if (willRedirect) return <BootScreen label="Taking you to your workspace…" />;

  // Unauthenticated on a protected route — return null while redirect fires
  if (!user && !isPublic) return null;

  return <>{children}</>;
}
