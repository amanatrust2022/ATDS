'use client';

import { useAuth } from '@/components/AuthProvider';
import { EmptyState } from '@/components/ui';

/**
 * The admin area used to carry its own navigation: a 260px dark sidebar with
 * hard-coded hex colours, three separate link lists, and a "Department
 * Switcher" that existed because there was no other way to reach Reception
 * from here. That was the app's third navigation system, after the header's
 * back arrow and the avatar dropdown.
 *
 * It is all one rail now, mounted once in app/[slug]/layout.tsx and driven by
 * components/shell/navigation.ts. What is left here is the access check —
 * belt to the braces of RequireRole on each screen, and of row-level security
 * in the database, which is the only one of the three that actually holds.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();

  if (profile?.role !== 'admin') {
    return (
      <EmptyState title="You do not have access to this area">
        Administration is limited to workspace administrators. If you need something
        from here, ask an administrator at your centre.
      </EmptyState>
    );
  }

  return <>{children}</>;
}
