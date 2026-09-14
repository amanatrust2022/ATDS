'use client';

import Link from 'next/link';
import { RiCheckDoubleLine } from '@remixicon/react';

import { Button } from '@/components/ui';
import type { Exception } from '@/lib/today';

import styles from './today.module.css';

const SEVERITY_WORD: Record<Exception['severity'], string> = {
  3: 'Now',
  2: 'Soon',
  1: 'Today',
  0: 'When free',
};

/**
 * What needs someone, worst first.
 *
 * Every row is the thing to act on, not a report about it: it links to the
 * bench, the patient, or the payout screen already filtered to the problem.
 * The one action a row can carry itself is "run sync now", because that
 * needs no screen — only the hub.
 */
export function ExceptionsInbox({
  exceptions,
  onRunSync,
  syncing,
}: {
  exceptions: Exception[];
  onRunSync: () => void;
  syncing: boolean;
}) {
  if (exceptions.length === 0) {
    return (
      <p className={styles['allClear']}>
        <RiCheckDoubleLine size={20} aria-hidden="true" />
        Nothing needs you. Every result is out, every visit is paid, and the cloud is up to date.
      </p>
    );
  }

  return (
    <ul className={styles['inbox']} aria-label="What needs attention">
      {exceptions.map((e) => (
        <li key={e.key} className={styles['inboxRow']}>
          <span className={[styles['sev'], styles[`sev${e.severity}`]].join(' ')} aria-hidden="true" />
          <span className={styles['inboxText']}>
            <Link href={e.href} className={styles['inboxTitle']}>
              {e.title}
            </Link>
            <span className={styles['inboxDetail']}>{e.detail}</span>
          </span>
          <span className={styles['inboxAct']}>
            <span className={styles['sevWord']}>{SEVERITY_WORD[e.severity]}</span>
            {e.action?.kind === 'run_sync' && (
              <Button size="sm" intent="secondary" loading={syncing} onClick={onRunSync}>
                {e.action.label}
              </Button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
