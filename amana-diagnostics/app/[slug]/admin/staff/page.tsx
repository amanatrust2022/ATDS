import type { Metadata } from 'next';

import StaffScreen from './StaffScreen';

export const metadata: Metadata = { title: 'Staff' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <StaffScreen />;
}
