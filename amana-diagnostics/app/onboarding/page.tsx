import type { Metadata } from 'next';

import OnboardingScreen from './OnboardingScreen';

export const metadata: Metadata = { title: 'Set up your workspace' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <OnboardingScreen />;
}
