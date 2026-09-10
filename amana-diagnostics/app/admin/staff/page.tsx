import type { Metadata } from 'next';

import LegacyRouteRedirect from '@/components/LegacyRouteRedirect';

export const metadata: Metadata = { title: 'Staff' };

/**
 * The old, workspace-less staff screen.
 *
 * There were two staff screens and they did not agree. This one changed a role
 * by writing `profiles.role` straight from the browser, which left the auth
 * user's metadata saying something different; the workspace one goes through
 * `/api/staff/update`, which keeps both in step. It also created accounts by
 * typing a password for someone, a second route into the clinic alongside
 * invitations, and its own access check let *reception* manage staff.
 *
 * Nothing links here. Rather than keep two implementations of one job in step,
 * this sends people to the real screen.
 */
export default function LegacyStaffPage() {
  return <LegacyRouteRedirect path="/admin/staff" message="Taking you to staff management…" />;
}
