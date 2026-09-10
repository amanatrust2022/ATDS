'use client';

import { useAuth } from '@/components/AuthProvider';
import { AppShell } from '@/components/shell';
import { EmptyState } from '@/components/ui';

/**
 * The admin area used to carry its own navigation: a 260px dark sidebar with
 * hard-coded hex colours, three separate link lists, and a "Department
 * Switcher" that existed because there was no other way to reach Reception
 * from here. That was the app's third navigation system, after the header's
 * back arrow and the avatar dropdown.
 *
 * It is all one rail now, in AppShell, driven by components/shell/navigation.ts.
 * Admin sections and departments sit in the same list, filtered by role, so
 * nothing needs a switcher.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  if (profile?.role !== 'admin') {
    return (
      <AppShell title="Administration">
        <EmptyState title="You do not have access to this area">
          Administration is limited to workspace administrators. If you need something
          from here, ask an administrator at your centre.
        </EmptyState>
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
