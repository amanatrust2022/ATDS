import { describe, expect, it } from 'vitest';

import { currentRange, dailyBuckets, delta, inRange, localMidnight, priorRange } from './period';

// A Monday, mid-morning, in local time — whatever the machine's zone is.
const NOW = new Date(2026, 8, 14, 10, 30, 0);
const DAY = 86_400_000;

describe('currentRange', () => {
  it('today runs from local midnight to now', () => {
    const r = currentRange('today', NOW);
    expect(r.start).toEqual(localMidnight(NOW));
    expect(r.end.getTime()).toBe(NOW.getTime() + 1);
  });

  it('seven days starts six midnights back, so today is the seventh day', () => {
    const r = currentRange('7days', NOW);
    expect(r.start).toEqual(new Date(localMidnight(NOW).getTime() - 6 * DAY));
  });

  it('thirty days starts twenty-nine midnights back', () => {
    const r = currentRange('30days', NOW);
    expect(r.start).toEqual(new Date(localMidnight(NOW).getTime() - 29 * DAY));
  });
});

describe('priorRange', () => {
  it('today compares with the same weekday last week, to the same clock time', () => {
    const r = priorRange('today', NOW);
    expect(r.start).toEqual(new Date(localMidnight(NOW).getTime() - 7 * DAY));
    expect(r.end.getTime()).toBe(NOW.getTime() + 1 - 7 * DAY);
  });

  it('seven days compares with the seven before', () => {
    const cur = currentRange('7days', NOW);
    const r = priorRange('7days', NOW);
    expect(r.end.getTime()).toBe(cur.end.getTime() - 7 * DAY);
    expect(r.start.getTime()).toBe(cur.start.getTime() - 7 * DAY);
  });
});

describe('inRange', () => {
  const r = currentRange('today', NOW);

  it('excludes 23:59 yesterday and includes 00:00 today', () => {
    expect(inRange(new Date(2026, 8, 13, 23, 59, 59).toISOString(), r)).toBe(false);
    expect(inRange(new Date(2026, 8, 14, 0, 0, 0).toISOString(), r)).toBe(true);
  });

  it('excludes a moment after now, and garbage', () => {
    expect(inRange(new Date(NOW.getTime() + 60_000).toISOString(), r)).toBe(false);
    expect(inRange(null, r)).toBe(false);
    expect(inRange('not a date', r)).toBe(false);
  });
});

describe('delta', () => {
  it('has nothing to say without a prior figure', () => {
    expect(delta(5, 0, { label: 'vs' })).toEqual({
      value: 0, direction: 'flat', label: 'no prior data', sentiment: 'neutral',
    });
  });

  it('reads a rise as good by default', () => {
    expect(delta(120, 100, { label: 'vs last week' })).toEqual({
      value: 20, direction: 'up', label: 'vs last week', sentiment: 'good',
    });
  });

  it('reads a rise as bad when told higher is worse', () => {
    expect(delta(120, 100, { label: 'vs', higherIsGood: false }).sentiment).toBe('bad');
    expect(delta(80, 100, { label: 'vs', higherIsGood: false }).sentiment).toBe('good');
  });

  it('calls a change under half a percent flat', () => {
    expect(delta(1002, 1000, { label: 'vs' }).direction).toBe('flat');
  });

  it('rounds to one decimal', () => {
    expect(delta(107, 100, { label: 'vs' }).value).toBe(7);
    expect(delta(1077, 1000, { label: 'vs' }).value).toBe(7.7);
  });
});

describe('dailyBuckets', () => {
  it('sums into one bucket per local day, oldest first, today last', () => {
    const b = dailyBuckets(
      [
        { at: NOW.toISOString(), value: 10 },
        { at: new Date(2026, 8, 14, 1, 0).toISOString(), value: 5 },
        { at: new Date(2026, 8, 13, 23, 0).toISOString(), value: 7 },
        { at: new Date(2026, 8, 1, 12, 0).toISOString(), value: 100 }, // 13 days ago — outside 14? no: inside
      ],
      14,
      NOW,
    );
    expect(b).toHaveLength(14);
    expect(b[13]).toBe(15);
    expect(b[12]).toBe(7);
    expect(b[0]).toBe(100);
  });

  it('drops anything older than the span or in the future', () => {
    const b = dailyBuckets(
      [
        { at: new Date(2026, 7, 31, 12, 0).toISOString(), value: 1 },
        { at: new Date(2026, 8, 15, 12, 0).toISOString(), value: 1 },
        { at: null, value: 1 },
      ],
      14,
      NOW,
    );
    expect(b.every((v) => v === 0)).toBe(true);
  });
});
