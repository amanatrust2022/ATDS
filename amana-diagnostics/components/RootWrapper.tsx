'use client';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/update-password', '/download'];

const getRolePath = (role: string | undefined, slug: string) => {
  switch (role) {
    case 'lab':       return `/${slug}/lab`;
    case 'radiology': return `/${slug}/radiology`;
    case 'admin':     return `/${slug}/admin`;
    case 'reception': return `/${slug}/reception`;
    default:          return `/${slug}/reception`;
  }
};

const Spinner = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1628' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, border: '3px solid #4472c4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Loading workspace...</p>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

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

        if (!isLocalHostname) {
          const current = localStorage.getItem('amana_local_mode');
          if (current !== 'false') {
            localStorage.setItem('amana_local_mode', 'false');
            if (current !== null) window.location.reload();
          }
          return;
        }

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
      const fallbackProfile = profile && profile.id && profile.full_name && profile.role;
      if (fallbackProfile) {
        router.replace(`/${organization?.slug || 'workspace'}/reception`);
        return;
      }
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

  // Still loading auth
  if (loading || !authReady || !profileReady) return <Spinner />;

  // Auth resolved but user is on a path that will redirect them —
  // show spinner instead of flashing the page content for one frame
  const willRedirect = user && organization && (
    currentPath === '/' ||
    currentPath === '/login' ||
    currentPath === '/signup' ||
    currentPath === '/onboarding'
  );
  if (willRedirect) return <Spinner />;

  // Unauthenticated on a protected route — return null while redirect fires
  if (!user && !isPublic) return null;

  return <>{children}</>;
}
