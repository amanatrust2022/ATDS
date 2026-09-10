import type { Metadata } from 'next';

import ReferringDoctorsScreen from './ReferringDoctorsScreen';

export const metadata: Metadata = { title: 'Doctors' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <ReferringDoctorsScreen />;
}
