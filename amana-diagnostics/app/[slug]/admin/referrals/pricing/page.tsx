import type { Metadata } from 'next';

import ReferralPricingScreen from './ReferralPricingScreen';

export const metadata: Metadata = { title: 'Pricing' };

/**
 * A server component, so this route's HTML exists before its JavaScript does.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <ReferralPricingScreen />;
}
