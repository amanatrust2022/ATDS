'use client';
import { useAuth } from '@/components/AuthProvider';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SlugLayout({ children }: { children: React.ReactNode }) {
  const { organization, loading } = useAuth();
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!organization) return; // RootWrapper handles this redirect
    if (organization.slug !== slug) {
      router.replace(`/${organization.slug}/reception`);
    }
  }, [organization, loading, slug]);

  // Don't render a blank page — let RootWrapper handle loading state
  return <>{children}</>;
}
