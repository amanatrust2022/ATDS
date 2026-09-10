import type { Metadata } from 'next';

import LegacyRouteRedirect from '@/components/LegacyRouteRedirect';

export const metadata: Metadata = { title: 'Laboratory' };

/** Kept only so an old bookmark still lands somewhere — see the component. */
export default function LegacyLaboratoryPage() {
  return <LegacyRouteRedirect path="/lab" message="Taking you to Laboratory…" />;
}
