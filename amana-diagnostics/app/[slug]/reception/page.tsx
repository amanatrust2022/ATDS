'use client';
import RequireRole from '@/components/RequireRole';
import ReceptionPage from '@/components/ReceptionPage';
function SlugReceptionPage() { return <ReceptionPage />; }

/** Only these roles may open this screen — see components/RequireRole.tsx. */
export default function GuardedSlugReceptionPage(props: any) {
  return (
    <RequireRole allow={['admin', 'reception']}>
      <SlugReceptionPage {...props} />
    </RequireRole>
  );
}
