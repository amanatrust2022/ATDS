import type { Metadata } from 'next';

import ReportsScreen from './ReportsScreen';

export const metadata: Metadata = { title: 'Reports' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <ReportsScreen />;
}
