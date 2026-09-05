'use client';
import RequireRole from '@/components/RequireRole';
import DepartmentPage from '@/components/DepartmentPage';
function LabPage() { return <DepartmentPage department="lab" />; }

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedLabPage(props: any) {
  return (
    <RequireRole allow={['admin', 'lab', 'lab_tech']}>
      <LabPage {...props} />
    </RequireRole>
  );
}
