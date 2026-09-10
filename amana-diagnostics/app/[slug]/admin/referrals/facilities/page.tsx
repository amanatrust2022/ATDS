import type { Metadata } from 'next';

import ReferringFacilitiesScreen from './ReferringFacilitiesScreen';

export const metadata: Metadata = { title: 'Facilities' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <ReferringFacilitiesScreen />;
}
