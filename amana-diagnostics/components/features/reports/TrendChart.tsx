'use client';

import { useId } from 'react';

import { EmptyState } from '@/components/ui';
import type { ChartGeometry, TrendPoint } from '@/lib/staffPerformance';

import styles from './TrendChart.module.css';

/** Money, the way this product writes it everywhere else. */
const naira = (n: number) => `₦${(n || 0).toLocaleString('en-NG')}`;

/**
 * Billed value of tests signed off, by day.
 *
 * The geometry is lib/staffPerformance.ts; this only paints it. It used to
 * live inside the staff performance page, which is why the Today screen
 * could not draw the same picture without copying eighty lines of SVG.
 */
export function TrendChart({
  trend,
  geo,
  emptyHint = 'Pick a longer period to see a trend.',
}: {
  trend: TrendPoint[];
  geo: ChartGeometry;
  emptyHint?: string;
}) {
  // Two charts on one page must not share a gradient id.
  const gradientId = useId();

  if (trend.length < 2) {
    return (
      <EmptyState title="Not enough history" compact>
        {emptyHint}
      </EmptyState>
    );
  }

  return (
    <div className={styles['chart']}>
      <svg
        viewBox={`0 0 ${geo.width} ${geo.height}`}
        className={styles['chartSvg']}
        role="img"
        aria-label={`Revenue from ${trend[0]?.dateLabel} to ${trend[trend.length - 1]?.dateLabel}, peaking at ${naira(geo.maxRev)}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={styles['fillTop']} />
            <stop offset="100%" className={styles['fillBottom']} />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = geo.paddingTop + ratio * geo.chartHeight;
          const labelVal = Math.round(geo.maxRev - ratio * geo.maxRev);
          return (
            <g key={i}>
              <line
                x1={geo.paddingLeft}
                y1={y}
                x2={geo.width - geo.paddingRight}
                y2={y}
                className={styles['gridLine']}
                strokeDasharray="4 4"
              />
              <text x={geo.paddingLeft - 10} y={y + 4} textAnchor="end" className={styles['axisLabel']}>
                ₦{labelVal >= 1000 ? `${Math.round(labelVal / 1000)}k` : labelVal}
              </text>
            </g>
          );
        })}

        <path d={geo.areaPath} fill={`url(#${gradientId})`} />
        <path d={geo.linePath} className={styles['trendLine']} />

        {geo.points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="10" className={styles['hit']}>
              <title>{`${p.label}: ${naira(p.val)}`}</title>
            </circle>
            <circle cx={p.x} cy={p.y} r="3.5" className={styles['node']} />
            <text x={p.x} y={geo.height - 5} textAnchor="middle" className={styles['axisLabel']}>
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
