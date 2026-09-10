import type { Metadata } from 'next';

import RequireRole from '@/components/RequireRole';
import ReceptionPage from '@/components/ReceptionPage';

export const metadata: Metadata = { title: 'Reception' };

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function Page() {
  return (
    <RequireRole allow={['admin', 'reception']}>
      <ReceptionPage />
    </RequireRole>
  );
}
