import type { Metadata } from 'next';

import PortalSignInScreen from './PortalSignInScreen';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <PortalSignInScreen />;
}
