import type { Metadata } from 'next';

import SignUpScreen from './SignUpScreen';

export const metadata: Metadata = { title: 'Create your workspace' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <SignUpScreen />;
}
