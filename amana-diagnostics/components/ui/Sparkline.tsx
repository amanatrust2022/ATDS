'use client';

import { sparklinePath } from '@/lib/today/sparkline';

import styles from './Stat.module.css';

/**
 * A trend in the corner of a figure: the last fortnight as a thin line, the
 * newest point marked. It says "rising" or "falling", not how much — the
 * number beside it says that.
 *
 * The line is drawn in the de-emphasis ink and only the newest point in the
 * accent, so a row of these does not turn into a row of coloured stripes.
 */
export function Sparkline({
  values,
  width = 96,
  height = 24,
  title,
}: {
  values: number[];
  width?: number;
  height?: number;
  /** What a screen reader is told the line shows. */
  title: string;
}) {
  const geo = sparklinePath(values, width, height, 2);
  if (!geo.line) return null;

  return (
    <svg
      className={styles['spark']}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={title}
    >
      <path d={geo.area} className={styles['sparkArea']} />
      <path d={geo.line} className={styles['sparkLine']} />
      {geo.last && <circle cx={geo.last.x} cy={geo.last.y} r="2" className={styles['sparkEnd']} />}
    </svg>
  );
}
