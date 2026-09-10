import type { Metadata } from 'next';

import OrganisationScreen from './OrganisationScreen';

export const metadata: Metadata = { title: 'Organisation' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <OrganisationScreen />;
}
