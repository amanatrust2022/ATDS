'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { useAuth } from '@/components/AuthProvider';
import { AppShell } from '@/components/shell';
import { ShellSlotProvider } from '@/components/shell/ShellSlot';

/**
 * The frame every workspace screen renders inside.
 *
 * The shell used to be rendered by the screens themselves — DepartmentPage,
 * ReceptionPage and the profile page each opened with their own <AppShell>.
 * That meant the rail, the header, the breadcrumbs, the clock and the command
 * palette were torn down and rebuilt on every navigation: the whole window
 * blanked, the rail re-read its collapsed state from localStorage, and the
 * clock restarted. Moving between two screens looked like a page load because
 * structurally it was one.
 *
 * Here it is mounted once for the whole /[slug] subtree, so navigation swaps
 * <main> and nothing else. Screens contribute their part of the header through
 * ShellSlot.
 */
export default function WorkspaceFrame({ children }: { children: React.ReactNode }) {
  const { organization, loading } = useAuth();
  const params = useParams();
  const slug = params?.['slug'] as string;
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!organization) return; // RootWrapper handles this redirect
    if (organization.slug !== slug) {
      router.replace(`/${organization.slug}/reception`);
    }
  }, [organization, loading, slug, router]);

  return (
    <ShellSlotProvider>
      <AppShell>{children}</AppShell>
    </ShellSlotProvider>
  );
}
