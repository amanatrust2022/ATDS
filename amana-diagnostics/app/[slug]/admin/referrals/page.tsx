import type { Metadata } from 'next';

import ReferrersScreen from './ReferrersScreen';

export const metadata: Metadata = { title: 'Referrers' };

/**
 * Doctors and facilities that refer patients, as one screen.
 *
 * Was a four-tile overview grid that linked to four separate screens: doctors,
 * facilities, pricing (now merged into Catalogue) and commissions. Pricing
 * moved to /admin/tests. Doctors and facilities are now one table here.
 * Commissions are their own screen at /admin/referrals/commissions.
 */
export default function Page() {
  return <ReferrersScreen />;
}
