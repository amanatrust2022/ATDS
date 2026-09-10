'use client';

import { Spinner } from '@/components/ui';

import styles from './BootScreen.module.css';

/**
 * Shown while the session is being resolved, before any screen or shell exists.
 *
 * This is the only place in the product where a bare spinner is the honest
 * answer: nothing is known yet, so there is no shape to draw a skeleton of.
 * Everywhere below the shell uses a content-shaped placeholder instead.
 */
export default function BootScreen({
  label = 'Loading workspace…',
  detail,
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div className={styles['screen']} role="status" aria-live="polite">
      <div className={styles['inner']}>
        <Spinner size={32} />
        <p className={styles['label']}>{label}</p>
        {detail && <p className={styles['detail']}>{detail}</p>}
      </div>
    </div>
  );
}
