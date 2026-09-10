import type { Metadata } from 'next';

import ProfileScreen from './ProfileScreen';

export const metadata: Metadata = { title: 'My profile' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <ProfileScreen />;
}
