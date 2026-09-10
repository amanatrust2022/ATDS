import type { Metadata } from 'next';

import PortalReportScreen from './PortalReportScreen';

export const metadata: Metadata = { title: 'Your report' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <PortalReportScreen />;
}
