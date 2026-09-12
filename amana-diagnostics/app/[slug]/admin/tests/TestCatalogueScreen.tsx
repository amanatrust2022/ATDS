'use client';
import RequireRole from '@/components/RequireRole';
import { useAuth } from '@/components/AuthProvider';
import TestManager from '@/components/TestManager';
import { useShellSlot } from '@/components/shell/ShellSlot';

import styles from './testCatalogue.module.css';

function AdminTestsPage() {
  const { organization } = useAuth();

  // The shell owns the page heading; the sentence under it is the screen's.
  useShellSlot(
    { subtitle: 'Add custom investigations, customize categories and specimens, and adjust reference ranges for all departments.' },
    [],
  );

  return (
    <div className={styles.page}>
      {organization?.id ? (
        <TestManager organizationId={organization.id} />
      ) : (
        <p className={styles.waiting} role="status" aria-live="polite">
          Loading workspace details…
        </p>
      )}
    </div>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GuardedAdminTestsPage(props: any) {
  return (
    <RequireRole allow={['admin']}>
      <AdminTestsPage {...props} />
    </RequireRole>
  );
}
