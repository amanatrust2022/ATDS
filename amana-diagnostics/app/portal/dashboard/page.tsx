import type { Metadata } from 'next';

import PortalDashboardScreen from './PortalDashboardScreen';

export const metadata: Metadata = { title: 'Your results' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <PortalDashboardScreen />;
}
