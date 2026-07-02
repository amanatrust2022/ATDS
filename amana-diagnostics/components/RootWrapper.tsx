'use client';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/update-password', '/download'];

// Maps each staff role to its direct workspace URL
const getRolePath = (role: string | undefined, slug: string) => {
  switch (role) {
    case 'lab':       return `/${slug}/lab`;
    case 'radiology': return `/${slug}/radiology`;
    case 'admin':     return `/${slug}/admin`;
    case 'reception': return `/${slug}/reception`;
    default:          return `/${slug}/reception`;
  }
};

export default function RootWrapper({ children }: { children: React.ReactNode }) {
  const { user, profile, organization, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hasAuthResolved = !loading;

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
    if (
      user &&
      hasNoOrg &&
      currentPath !== '/onboarding' &&
      currentPath !== '/login' &&
      currentPath !== '/signup' &&
      !currentPath.startsWith('/invite/')
    ) {
      router.replace('/onboarding'); return;
    }

    // Logged in with org → immediately redirect away from login/signup/landing to the role workspace
    if (user && organization && (currentPath === '/login' || currentPath === '/signup' || currentPath === '/' || currentPath === '/onboarding')) {
      router.replace(getRolePath(profile?.role, organization.slug)); return;
    }
  }, [user, profile, organization, loading, currentPath, hasAuthResolved]);

  if (loading) {
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
