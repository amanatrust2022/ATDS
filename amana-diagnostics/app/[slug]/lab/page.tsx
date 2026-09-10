import type { Metadata } from 'next';

import RequireRole from '@/components/RequireRole';
import DepartmentPage from '@/components/DepartmentPage';

export const metadata: Metadata = { title: 'Laboratory' };

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function Page() {
  return (
    <RequireRole allow={['admin', 'lab', 'lab_tech']}>
      <DepartmentPage department="lab" />
    </RequireRole>
  );
}
