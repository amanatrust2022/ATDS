'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingPanel } from '@/components/ui';
import { useAuth } from '@/components/AuthProvider';
import type { Profile } from '@/components/AuthProvider';

export type Role = Profile['role'];

/**
 * Gates a screen on the signed-in user's role.
 *
 * Role used to decide only where you landed after signing in, never what you
 * could open. Anyone who typed `/<clinic>/admin/staff` into the address bar got
 * the staff screen — including the ability to change roles and remove
 * colleagues — regardless of who they were.
 *
 * This is the visible half of the fix. It stops a screen being *shown*; it is
 * not what stops the data being *read*. That is row-level security in the
 * database and the guards in `lib/apiAuth.ts`, and neither of those trusts this
 * component. A check that runs in the browser can always be stepped around, so
 * it must never be the only one.
 */
export default function RequireRole({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const { profile, organization, loading, profileReady } = useAuth();
  const router = useRouter();

  const decided = !loading && profileReady;
  const permitted = !!profile && allow.includes(profile.role);

  useEffect(() => {
    if (!decided) return;

    if (!profile) {
      router.replace('/login');
      return;
    }
    if (!permitted) {
      // Sent to their own workspace rather than shown a dead end.
      router.replace(landingFor(profile.role, organization?.slug));
    }
  }, [decided, permitted, profile, organization?.slug, router]);

  if (!decided) return <Waiting message="Loading your workspace…" />;
  if (!profile) return <Waiting message="Signing you in…" />;
  if (!permitted) return <Waiting message="Taking you to your workspace…" />;

  return <>{children}</>;
}

/** Where a role belongs. Mirrors `getWorkspacePath` in the header. */
export function landingFor(role: Role | undefined, slug: string | undefined): string {
  if (!slug) return '/';
  if (role === 'admin') return `/${slug}/admin`;
  if (role === 'lab' || role === 'lab_tech') return `/${slug}/lab`;
  if (role === 'radiology') return `/${slug}/radiology`;
  return `/${slug}/reception`;
}

/**
 * The shell is above this now, so a screen waiting on its role check keeps the
 * rail, the header and the breadcrumbs. This used to paint a full-height
 * gradient over all of it in three hard-coded hex colours that had no dark
 * counterpart, so on a dark theme it flashed a white page between screens.
 */
function Waiting({ message }: { message: string }) {
  return <LoadingPanel label={message} />;
}
