import type { Metadata } from 'next';

import LegacyRouteRedirect from '@/components/LegacyRouteRedirect';

export const metadata: Metadata = { title: 'Reception' };

/** Kept only so an old bookmark still lands somewhere — see the component. */
export default function LegacyReceptionPage() {
  return <LegacyRouteRedirect path="/reception" message="Taking you to Reception…" />;
}
