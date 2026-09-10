import type { Metadata } from 'next';

import PatientsScreen from './PatientsScreen';

export const metadata: Metadata = { title: 'Patients' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <PatientsScreen />;
}
