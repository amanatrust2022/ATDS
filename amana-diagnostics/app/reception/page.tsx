'use client';
import RequireRole from '@/components/RequireRole';
import ReceptionPage from '@/components/ReceptionPage';

function LegacyReceptionPage() {
  return <ReceptionPage />;
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedLegacyReceptionPage(props: any) {
  return (
    <RequireRole allow={['admin', 'reception']}>
      <LegacyReceptionPage {...props} />
    </RequireRole>
  );
}
