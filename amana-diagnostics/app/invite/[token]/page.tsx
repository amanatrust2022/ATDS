import type { Metadata } from 'next';

import InviteScreen from './InviteScreen';

export const metadata: Metadata = { title: 'Accept your invitation' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <InviteScreen />;
}
