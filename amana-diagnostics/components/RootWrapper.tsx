'use client';
import { useAuth } from '@/components/AuthProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/onboarding', '/update-password'];

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

  const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/invite/');
  const isOrgRoute = !isPublic && !pathname.startsWith('/login') && !pathname.startsWith('/signup');

  useEffect(() => {
    if (loading) return;

    // Not logged in → redirect to login (except on public pages)
    if (!user && !isPublic) { router.push('/login'); return; }

    // Logged in but no org yet → always go to onboarding (unless already there or on a public page)
    if (user && !organization && pathname !== '/onboarding' && !pathname.startsWith('/invite/')) {
      router.push('/onboarding'); return;
    }

    // Logged in with org → immediately redirect away from login/signup/landing to the role workspace
    if (user && organization && (pathname === '/login' || pathname === '/signup' || pathname === '/')) {
      router.replace(getRolePath(profile?.role, organization.slug)); return;
    }
  }, [user, profile, organization, loading, pathname]);

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
