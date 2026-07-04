'use client';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/update-password', '/download'];

// Maps each staff role to its direct workspace URL
const getRolePath = (role: string | undefined, slug: string) => {
  switch (role) {
    case 'lab': return `/${slug}/lab`;
    case 'radiology': return `/${slug}/radiology`;
    case 'admin': return `/${slug}/admin`;
    case 'reception': return `/${slug}/reception`;
    default: return `/${slug}/reception`;
  }
};

export default function RootWrapper({ children }: { children: React.ReactNode }) {
  const { user, profile, organization, loading, authReady, profileReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasAuthResolved = authReady && profileReady && !loading;

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered on scope:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkConfig = async () => {
      try {
        const h = window.location.hostname;
        const isLocalHostname = (
          h === 'localhost' || h === '127.0.0.1' ||
          h.startsWith('192.168.') || h.startsWith('10.') || h.startsWith('172.')
        );

        // On cloud hostnames, force local mode to false immediately
        // — don't even wait for /api/config, prevents any state poisoning.
        if (!isLocalHostname) {
          const current = localStorage.getItem('amana_local_mode');
          if (current !== 'false') {
            localStorage.setItem('amana_local_mode', 'false');
            if (current !== null) {
              // Reload to ensure AuthProvider picks up the corrected mode
              window.location.reload();
            }
          }
          return;
        }

        // Local hostname — ask the server what mode we're in
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          const currentLocalMode = localStorage.getItem('amana_local_mode');
          const newLocalMode = String(data.localMode);
          if (currentLocalMode !== newLocalMode) {
            localStorage.setItem('amana_local_mode', newLocalMode);
            window.location.reload();
          }
        }
      } catch (err) {
        console.warn('Failed to fetch config from server:', err);
      }
    };
    checkConfig();
  }, []);

  const currentPath = pathname || '';
  const isPublic = PUBLIC_PATHS.includes(currentPath) || currentPath.startsWith('/invite/') || currentPath.startsWith('/portal');
  const isOrgRoute = !isPublic && !currentPath.startsWith('/login') && !currentPath.startsWith('/signup');

  useEffect(() => {
    if (loading) return;
    if (!pathname) return; // Prevent running redirect logic before Next.js hydration has resolved the pathname

    // Only redirect when auth has actually resolved. This prevents the cloud-mode bounce between login/onboarding.
    if (!hasAuthResolved) return;

    // Not logged in → redirect to login (except on public pages)
    if (!user && !isPublic) { router.replace('/login'); return; }

    // Logged in but no profile or no organization linked yet → go to onboarding.
    // IMPORTANT: Exclude /login and /signup — in Cloud Mode, auth fires before profile is fetched,
    // so redirecting from these paths would fire before the profile data arrives, causing a premature
    // redirect to /onboarding even for users with a valid organization.
    const hasNoOrg = !profile || !profile.organization_id;
    const shouldGoToOnboarding = Boolean(user && hasNoOrg && currentPath !== '/onboarding' && currentPath !== '/login' && currentPath !== '/signup' && !currentPath.startsWith('/invite/'));

    if (shouldGoToOnboarding) {
      // Allow a signed-in user with a fallback profile to continue if the backend created the profile row.
      const fallbackProfile = profile && profile.id && profile.full_name && profile.role;
      if (fallbackProfile) {
        router.replace(`/${organization?.slug || 'workspace'}/reception`);
        return;
      }
      router.replace('/onboarding');
      return;
    }

    // Logged in with org → immediately redirect away from login/signup/landing to the role workspace
    if (user && organization && (currentPath === '/login' || currentPath === '/signup' || currentPath === '/' || currentPath === '/onboarding')) {
      router.replace(getRolePath(profile?.role, organization.slug)); return;
    }
  }, [user, profile, organization, loading, currentPath, hasAuthResolved]);

  if (loading || !authReady || !profileReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1628' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #4472c4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Loading workspace...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
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
  if (loading || !authReady || !profileReady) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1628' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '3px solid #4472c4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Loading workspace...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }


  if (!user && !isPublic) return null;

  return <>{children}</>;
}
