import { Skeleton, SkeletonRows } from '@/components/ui';

import styles from './loading.module.css';

/**
 * What a workspace screen looks like while its code is on the way.
 *
 * Next renders this into the shell's <main> the moment a navigation starts, so
 * the rail, header and breadcrumbs are already correct and only the panel is
 * waiting. It is deliberately the shape of a toolbar over a table, because
 * that is the shape of nearly every screen here — a spinner in the middle of
 * the page would say less and move the layout twice.
 */
export default function WorkspaceLoading() {
  return (
    <div className={styles['panel']}>
      <div className={styles['toolbar']}>
        <span className={styles['search']}>
          <Skeleton height={32} />
        </span>
        <Skeleton width={110} height={32} />
      </div>
      <SkeletonRows rows={8} columns={[3, 2, 2, 2, 1]} />
    </div>
  );
}
