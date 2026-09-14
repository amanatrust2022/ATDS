import { describe, expect, it } from 'vitest';

import { sparklinePath } from './sparkline';

describe('sparklinePath', () => {
  it('draws nothing for an empty series', () => {
    expect(sparklinePath([])).toEqual({ line: '', area: '', last: null });
  });

  it('ignores values that are not numbers', () => {
    const geo = sparklinePath([1, NaN, 3, Infinity]);
    expect(geo.line.split('L')).toHaveLength(2);
  });

  it('puts a flat series at mid-height rather than dividing by zero', () => {
    const geo = sparklinePath([5, 5, 5], 96, 24, 1);
    expect(geo.line).toBe('M1 12 L48 12 L95 12');
    expect(geo.last).toEqual({ x: 95, y: 12 });
  });

  it('centres a single point', () => {
    const geo = sparklinePath([7], 96, 24, 1);
    expect(geo.last).toEqual({ x: 48, y: 12 });
  });

  it('rises as values rise — larger values sit higher on the page', () => {
    const geo = sparklinePath([0, 10, 20], 96, 24, 1);
    const ys = geo.line.match(/[\d.]+ ([\d.]+)/g)!.map((m) => Number(m.split(' ')[1]));
    expect(ys[0]).toBeGreaterThan(ys[1]!);
    expect(ys[1]).toBeGreaterThan(ys[2]!);
    expect(ys[0]).toBe(23);
    expect(ys[2]).toBe(1);
  });

  it('closes the area down to the baseline', () => {
    const geo = sparklinePath([0, 10], 96, 24, 1);
    expect(geo.area).toBe(`${geo.line} L95 23 L1 23 Z`);
  });
});
