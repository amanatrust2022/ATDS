import type { Metadata } from 'next';

import AuditScreen from './AuditScreen';

export const metadata: Metadata = { title: 'Audit log' };

/**
 * The audit trail of every admin action — who changed what, and when.
 *
 * A server component, so the page title and HTML exist before JavaScript.
 * The screen itself is the client component beside this file.
 */
export default function Page() {
  return <AuditScreen />;
}
