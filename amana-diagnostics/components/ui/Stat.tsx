'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { RiArrowDownLine, RiArrowRightLine, RiArrowUpLine } from '@remixicon/react';

import { Skeleton } from './Feedback';
import { Sparkline } from './Sparkline';
import type { Tone } from './Status';
import styles from './Stat.module.css';

/**
 * One figure with its context: a label, the number, how it compares to a
 * named period, and the shape of the last fortnight.
 *
 * Before this each screen drew its own tile — the overview had one set of
 * classes, the staff performance page another, referrals a third — and none
 * of them could say whether a number was up or down. This is the one tile,
 * and it knows that "up" is not always good: outstanding money rising is
 * bad, and the colour follows the sentiment, not the arrow.
 *
 * While the figure is being fetched it shows a placeholder, never a zero. A
 * zero is a value; a clinic that has billed nothing today should see it, and
 * a clinic whose figures have not arrived yet should not.
 */

export interface StatDelta {
  /** Signed change, as a percentage when there is a prior figure to compare to. */
  value: number;
  direction: 'up' | 'down' | 'flat';
  /** "vs same day last week", "no prior data" — read out beside the arrow. */
  label: string;
  /** Whether this direction is welcome. Defaults to neutral: coloured ink only when it is set. */
  sentiment?: 'good' | 'bad' | 'neutral';
}

export interface StatProps {
  label: string;
  value: ReactNode;
  delta?: StatDelta;
  /** A short series, oldest first, drawn as a sparkline under the figure. */
  spark?: number[];
  tone?: Tone;
  icon?: ReactNode;
  /** A line under the figure — "of which ₦12,000 this week". */
  note?: ReactNode;
  /** Makes the whole tile the way to the screen that explains it. */
  href?: string;
  loading?: boolean;
  /** Tighter for a row of six on a phone. */
  dense?: boolean;
  className?: string;
}

const DELTA_ICON = {
  up: <RiArrowUpLine size={13} aria-hidden="true" />,
  down: <RiArrowDownLine size={13} aria-hidden="true" />,
  flat: <RiArrowRightLine size={13} aria-hidden="true" />,
};

export function Stat({
  label,
  value,
  delta,
  spark,
  tone = 'neutral',
  icon,
  note,
  href,
  loading = false,
  dense = false,
  className,
}: StatProps) {
  const classes = [
    styles['stat'],
    dense ? styles['dense'] : '',
    href ? styles['link'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <>
      <div className={styles['head']}>
        <span className={styles['label']}>{label}</span>
        {icon && (
          <span className={styles['icon']} data-tone={tone} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      <div className={styles['row']}>
        {loading ? (
          <span className={styles['value']} role="status" aria-label={`Loading ${label}`}>
            <Skeleton width="4.5em" height="1em" />
          </span>
        ) : (
          <span className={styles['value']}>{value}</span>
        )}
        {spark && spark.length > 1 && !loading && (
          <Sparkline values={spark} title={`${label}, recent trend`} />
        )}
      </div>

      {delta && !loading && (
        <span
          className={[
            styles['delta'],
            styles[deltaClass(delta.direction)],
            delta.sentiment === 'good' ? styles['good'] : '',
            delta.sentiment === 'bad' ? styles['bad'] : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {DELTA_ICON[delta.direction]}
          {delta.direction !== 'flat' && (
            <span className={styles['deltaValue']}>{formatDelta(delta.value)}</span>
          )}
          <span className={styles['deltaLabel']}>{delta.label}</span>
        </span>
      )}

      {note && !loading && <span className={styles['note']}>{note}</span>}
    </>
  );

  if (href) {
    return (
      // No aria-label: the link is named by its content, so a screen reader
      // hears the label, the figure and the change, not just "open".
      <Link href={href} className={classes}>
        {body}
      </Link>
    );
  }

  return <div className={classes}>{body}</div>;
}

const deltaClass = (d: StatDelta['direction']) =>
  d === 'up' ? 'deltaUp' : d === 'down' ? 'deltaDown' : 'deltaFlat';

/** "+12%", "−8%" — a real minus sign, one decimal only when it is small. */
export function formatDelta(pct: number): string {
  const abs = Math.abs(pct);
  const digits = abs > 0 && abs < 10 ? 1 : 0;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${sign}${abs.toFixed(digits)}%`;
}
