import type { Metadata } from 'next';

import NewPasswordScreen from './NewPasswordScreen';

export const metadata: Metadata = { title: 'Choose a new password' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <NewPasswordScreen />;
}
