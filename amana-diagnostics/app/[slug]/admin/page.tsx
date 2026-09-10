import type { Metadata } from 'next';

import AdminOverviewScreen from './AdminOverviewScreen';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <AdminOverviewScreen />;
}
