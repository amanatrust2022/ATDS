import type { StatDelta } from '@/components/ui/Stat';

/**
 * The period the dashboard is looking at, and the one it compares against.
 *
 * All boundaries are local midnights. "Today" compares against the same
 * weekday last week rather than yesterday: a Monday against a Sunday says
 * nothing about a clinic. Seven and thirty days compare against the block
 * before them. Every function takes `now` so the tests can fix it.
 */

export type Period = 'today' | '7days' | '30days';

export const PERIOD_LABEL: Record<Period, string> = {
  today: 'Today',
  '7days': '7 days',
  '30days': '30 days',
};

/** What the comparison is against, read out beside the arrow. */
export const COMPARISON_LABEL: Record<Period, string> = {
  today: 'vs same day last week',
  '7days': 'vs previous 7 days',
  '30days': 'vs previous 30 days',
};

/** Half-open: start inclusive, end exclusive. */
export interface Range {
  start: Date;
  end: Date;
}

const DAY_MS = 86_400_000;

export function localMidnight(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  return m;
}

const daysOf = (period: Period) => (period === 'today' ? 1 : period === '7days' ? 7 : 30);

/** Today: midnight to now. 7/30 days: the last N whole days ending now. */
export function currentRange(period: Period, now: Date): Range {
  const days = daysOf(period);
  const start = new Date(localMidnight(now).getTime() - (days - 1) * DAY_MS);
  return { start, end: new Date(now.getTime() + 1) };
}

/**
 * The period to compare against, the same length and the same time of day.
 * Comparing a full day last week with a half day today would always read as
 * a drop; the prior range ends at the same clock time.
 */
export function priorRange(period: Period, now: Date): Range {
  const shift = period === 'today' ? 7 : daysOf(period);
  const current = currentRange(period, now);
  return {
    start: new Date(current.start.getTime() - shift * DAY_MS),
    end: new Date(current.end.getTime() - shift * DAY_MS),
  };
}

export function inRange(iso: string | null | undefined, r: Range): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= r.start.getTime() && t < r.end.getTime();
}

/**
 * How a figure moved, as a percentage of the prior one.
 *
 * No prior figure means no percentage: 0 → 5 is not "up infinity", it is
 * "nothing to compare with". The sentiment says whether the direction is
 * welcome — money owed going up is bad news; money billed going up is good.
 */
export function delta(
  current: number,
  prior: number,
  opts: { higherIsGood?: boolean; label: string },
): StatDelta {
  const higherIsGood = opts.higherIsGood ?? true;
  if (!(prior > 0)) {
    return { value: 0, direction: 'flat', label: 'no prior data', sentiment: 'neutral' };
  }
  const pct = ((current - prior) / prior) * 100;
  if (Math.abs(pct) < 0.5) {
    return { value: 0, direction: 'flat', label: opts.label, sentiment: 'neutral' };
  }
  const direction = pct > 0 ? 'up' : 'down';
  const welcome = direction === 'up' ? higherIsGood : !higherIsGood;
  return {
    value: Math.round(pct * 10) / 10,
    direction,
    label: opts.label,
    sentiment: welcome ? 'good' : 'bad',
  };
}

/**
 * One number per local day for the last `days` days, oldest first — the
 * sparkline's series. Anything outside the span is dropped.
 */
export function dailyBuckets(
  items: { at: string | null | undefined; value: number }[],
  days: number,
  now: Date,
): number[] {
  const end = localMidnight(now).getTime() + DAY_MS;
  const start = end - days * DAY_MS;
  const buckets = new Array<number>(days).fill(0);
  for (const item of items) {
    if (!item.at) continue;
    const t = new Date(item.at).getTime();
    if (Number.isNaN(t) || t < start || t >= end) continue;
    // Index by local day, not by elapsed milliseconds: a DST shift would
    // otherwise put an evening entry in the next day's bucket.
    const idx = Math.round((localMidnight(new Date(t)).getTime() - start) / DAY_MS);
    if (idx >= 0 && idx < days) buckets[idx] = (buckets[idx] ?? 0) + item.value;
  }
  return buckets;
}
