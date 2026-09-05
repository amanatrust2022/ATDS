'use client';
import RequireRole from '@/components/RequireRole';
import DepartmentPage from '@/components/DepartmentPage';

function RadiologyPage() {
  return <DepartmentPage department="radiology" />;
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedRadiologyPage(props: any) {
  return (
    <RequireRole allow={['admin', 'radiology']}>
      <RadiologyPage {...props} />
    </RequireRole>
  );
}
