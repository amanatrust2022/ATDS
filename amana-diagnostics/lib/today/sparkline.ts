/**
 * The geometry of a sparkline: a series of numbers to an SVG path.
 *
 * Pure so it can be tested without a DOM. The component that draws it
 * (components/ui/Sparkline.tsx) passes the box size in and paints the paths
 * this returns; nothing here knows about colour or the page.
 */

export interface SparklineGeometry {
  /** The stroke. Empty when there is nothing to draw. */
  line: string;
  /** The stroke closed down to the baseline, for a faint fill beneath it. */
  area: string;
  /** Where the newest value sits, for the marker on the end. */
  last: { x: number; y: number } | null;
}

export function sparklinePath(
  values: number[],
  width = 96,
  height = 24,
  pad = 1,
): SparklineGeometry {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return { line: '', area: '', last: null };

  const max = Math.max(...clean);
  const min = Math.min(...clean);
  const innerW = Math.max(width - pad * 2, 0);
  const innerH = Math.max(height - pad * 2, 0);
  // A single point has no x span; a flat series has no y span. Both sit at
  // the middle rather than dividing by zero.
  const stepX = clean.length > 1 ? innerW / (clean.length - 1) : 0;
  const span = max - min;

  const points = clean.map((v, i) => {
    const x = pad + (clean.length > 1 ? i * stepX : innerW / 2);
    const y = span > 0 ? pad + innerH - ((v - min) / span) * innerH : pad + innerH / 2;
    return { x: round(x), y: round(y) };
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const baseline = round(pad + innerH);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const area = `${line} L${last.x} ${baseline} L${first.x} ${baseline} Z`;

  return { line, area, last };
}

const round = (n: number) => Math.round(n * 100) / 100;
