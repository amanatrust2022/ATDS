'use client';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useEffect } from 'react';

export default function SlugLayout({ children }: { children: React.ReactNode }) {
  const { organization, loading } = useAuth();
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!organization) { router.push('/login'); return; }
    if (organization.slug !== slug) {
      // User belongs to a different org — redirect to their workspace
      router.push(`/${organization.slug}/reception`);
    }
  }, [organization, loading, slug]);

  if (loading || !organization) return null;

  return <>{children}</>;
}
