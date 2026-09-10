'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/components/AuthProvider';
import { LoadingPanel } from '@/components/ui';

/**
 * Sends a slug-less route to its workspace equivalent.
 *
 * /lab, /reception and /radiology were second copies of the workspace screens
 * mounted outside /[slug], from before the product was multi-tenant. Nothing
 * linked to them and every redirect in the app already pointed at the slug
 * version, so they were reachable only by typing them — and once the shell
 * moved into app/[slug]/layout.tsx they would have rendered a screen with no
 * navigation around it at all.
 *
 * The workspace is only known once the profile has loaded, which is why this
 * redirects from the browser rather than from the server.
 */
export default function LegacyRouteRedirect({
  path,
  message,
}: {
  /**
   * Where this route lives now, below the workspace slug — '/admin/staff'.
   *
   * A path rather than a function of the slug: these shells are server
   * components, and a server component cannot hand a client component a
   * function. The build says so, which is how this was caught.
   */
  path: string;
  message: string;
}) {
  const { organization, loading, profileReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !profileReady) return;
    router.replace(organization?.slug ? `/${organization.slug}${path}` : '/');
  }, [loading, profileReady, organization?.slug, router, path]);

  return <LoadingPanel label={message} />;
}
