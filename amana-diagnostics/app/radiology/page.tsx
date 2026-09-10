import type { Metadata } from 'next';

import LegacyRouteRedirect from '@/components/LegacyRouteRedirect';

export const metadata: Metadata = { title: 'Radiology' };

/** Kept only so an old bookmark still lands somewhere — see the component. */
export default function LegacyRadiologyPage() {
  return <LegacyRouteRedirect path="/radiology" message="Taking you to Radiology…" />;
}
