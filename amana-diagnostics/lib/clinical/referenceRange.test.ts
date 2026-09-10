import { describe, it, expect } from 'vitest';
import {
  parseReferenceRange,
  resolveForSex,
  deriveFlag,
  criticalLimitsFor,
  isSignificantDelta,
  normaliseSex,
  isCritical,
  isAbnormal,
} from './referenceRange';

/**
 * Every format asserted here was taken from the catalogue as it stands, not
 * invented. If a new one appears in the data, add a case here first.
 */

describe('parsing the reference ranges that are actually stored', () => {
  it('reads a closed numeric range', () => {
    expect(parseReferenceRange('3.5-5.0')).toEqual({ kind: 'numeric', low: 3.5, high: 5 });
    expect(parseReferenceRange('135-145')).toEqual({ kind: 'numeric', low: 135, high: 145 });
    expect(parseReferenceRange('1.001-1.030')).toEqual({
      kind: 'numeric', low: 1.001, high: 1.03,
    });
  });

  it('reads an upper bound only', () => {
    expect(parseReferenceRange('<100')).toEqual({ kind: 'numeric', low: null, high: 100 });
    expect(parseReferenceRange('<11.1')).toEqual({ kind: 'numeric', low: null, high: 11.1 });
  });

  it('reads a lower bound only', () => {
    expect(parseReferenceRange('>1.5')).toEqual({ kind: 'numeric', low: 1.5, high: null });
  });

  it('treats a titre as its denominator', () => {
    expect(parseReferenceRange('<1:80')).toEqual({ kind: 'numeric', low: null, high: 80 });
  });

  it('reads sex-specific ranges in all three spellings, either order', () => {
    expect(parseReferenceRange('F: 35-135 / M: 40-160')).toEqual({
      kind: 'sexed',
      female: { kind: 'numeric', low: 35, high: 135 },
      male: { kind: 'numeric', low: 40, high: 160 },
    });
    expect(parseReferenceRange('M: 35-55 / F: 45-65')).toEqual({
      kind: 'sexed',
      male: { kind: 'numeric', low: 35, high: 55 },
      female: { kind: 'numeric', low: 45, high: 65 },
    });
    expect(parseReferenceRange('Female: 3.5-6.4 / Male: 2.7-7.3')).toEqual({
      kind: 'sexed',
      female: { kind: 'numeric', low: 3.5, high: 6.4 },
      male: { kind: 'numeric', low: 2.7, high: 7.3 },
    });
  });

  it('recognises the qualitative expectations', () => {
    for (const text of ['Negative', 'Nil', 'Normal', 'Non-Reactive', 'Not Seen']) {
      expect(parseReferenceRange(text)).toEqual({ kind: 'qualitative', expected: text });
    }
  });

  it('gives up rather than guessing at anything it cannot read', () => {
    expect(parseReferenceRange('')).toEqual({ kind: 'none' });
    expect(parseReferenceRange(null)).toEqual({ kind: 'none' });
    expect(parseReferenceRange('see report')).toEqual({ kind: 'none' });
    expect(parseReferenceRange('age dependent')).toEqual({ kind: 'none' });
  });
});

describe('resolving a sexed range', () => {
  const range = parseReferenceRange('F: 35-135 / M: 40-160');

  it('picks the arm that applies', () => {
    expect(resolveForSex(range, 'male')).toEqual({ kind: 'numeric', low: 40, high: 160 });
    expect(resolveForSex(range, 'female')).toEqual({ kind: 'numeric', low: 35, high: 135 });
  });

  it('refuses to pick one when the sex is unknown', () => {
    // Flagging against one sex's range without knowing the patient's is a
    // guess with a clinical consequence.
    expect(resolveForSex(range, 'unknown')).toEqual({ kind: 'none' });
  });
});

describe('deriving the flag', () => {
  it('flags high and low against a closed range', () => {
    expect(deriveFlag('5.9', '3.5-5.2', { parameter: 'Chloride' })).toBe('H');
    expect(deriveFlag('3.0', '3.5-5.2', { parameter: 'Chloride' })).toBe('L');
    expect(deriveFlag('4.1', '3.5-5.2', { parameter: 'Chloride' })).toBe('');
  });

  it('treats the bounds themselves as in range', () => {
    expect(deriveFlag('3.5', '3.5-5.2', { parameter: 'Chloride' })).toBe('');
    expect(deriveFlag('5.2', '3.5-5.2', { parameter: 'Chloride' })).toBe('');
  });

  it('flags against a one-sided range', () => {
    expect(deriveFlag('150', '<100', { parameter: 'Triglycerides' })).toBe('H');
    expect(deriveFlag('80', '<100', { parameter: 'Triglycerides' })).toBe('');
    expect(deriveFlag('1.0', '>1.5', { parameter: 'HDL' })).toBe('L');
  });

  it('uses the patient sex when the range is sexed', () => {
    expect(deriveFlag('150', 'F: 35-135 / M: 40-160', { sex: 'female' })).toBe('H');
    expect(deriveFlag('150', 'F: 35-135 / M: 40-160', { sex: 'male' })).toBe('');
  });

  it('has no opinion rather than a wrong one', () => {
    // Not numeric.
    expect(deriveFlag('Negative', 'Negative')).toBeNull();
    // No range recorded.
    expect(deriveFlag('4.1', '')).toBeNull();
    // A range we cannot read.
    expect(deriveFlag('4.1', 'age dependent')).toBeNull();
    // A sexed range with no sex to resolve it.
    expect(deriveFlag('150', 'F: 35-135 / M: 40-160', { sex: 'unknown' })).toBeNull();
  });

  it('distinguishes "no opinion" from "in range"', () => {
    // null must never be treated as normal: an empty string asserts the value
    // was checked and found in range, and that assertion has to be earned.
    expect(deriveFlag('4.1', '')).toBeNull();
    expect(deriveFlag('4.1', '3.5-5.2')).toBe('');
  });
});

describe('critical values', () => {
  it('escalates past H/L when a panic limit is crossed', () => {
    expect(deriveFlag('6.5', '3.5-5.2', { parameter: 'Potassium' })).toBe('HH');
    expect(deriveFlag('2.5', '3.5-5.2', { parameter: 'Potassium' })).toBe('LL');
    // Abnormal, but not yet critical.
    expect(deriveFlag('5.6', '3.5-5.2', { parameter: 'Potassium' })).toBe('H');
  });

  it('treats the panic limit itself as critical', () => {
    expect(deriveFlag('6.2', '3.5-5.2', { parameter: 'Potassium' })).toBe('HH');
    expect(deriveFlag('2.8', '3.5-5.2', { parameter: 'Potassium' })).toBe('LL');
  });

  it('applies a panic limit even where the reference range is unreadable', () => {
    // The value still needs a phone call whether or not we could read the range.
    expect(deriveFlag('6.5', 'age dependent', { parameter: 'Potassium' })).toBe('HH');
  });

  it('matches a limit set through a decorated parameter name', () => {
    expect(criticalLimitsFor('Serum Potassium (K+)')).toEqual(
      expect.objectContaining({ low: 2.8, high: 6.2 }),
    );
    expect(criticalLimitsFor('Random Blood Glucose')).toEqual(
      expect.objectContaining({ low: 2.5, high: 25 }),
    );
  });

  it('lets a workspace override a limit', () => {
    const overrides = { potassium: { low: 3.0, high: 5.5, unit: 'mmol/L' } };
    expect(deriveFlag('5.6', '3.5-5.2', { parameter: 'Potassium', criticalOverrides: overrides }))
      .toBe('HH');
  });

  it('can be switched off entirely', () => {
    expect(
      deriveFlag('6.5', '3.5-5.2', { parameter: 'Potassium', useCriticalLimits: false }),
    ).toBe('H');
  });

  it('has no limits for an analyte that is not in the table', () => {
    expect(criticalLimitsFor('Urine colour')).toBeNull();
  });
});

describe('flag predicates', () => {
  it('separates critical from merely abnormal', () => {
    expect(isCritical('HH')).toBe(true);
    expect(isCritical('LL')).toBe(true);
    expect(isCritical('H')).toBe(false);
    expect(isCritical('')).toBe(false);
    expect(isCritical(null)).toBe(false);
  });

  it('counts every out-of-range tier as abnormal', () => {
    expect(['H', 'L', 'HH', 'LL'].every((f) => isAbnormal(f as never))).toBe(true);
    expect(isAbnormal('')).toBe(false);
    expect(isAbnormal(null)).toBe(false);
  });
});

describe('delta checks', () => {
  it('notices a change large enough to be worth a second look', () => {
    expect(isSignificantDelta(4.2, 11.8)).toBe(true);
    expect(isSignificantDelta(11.8, 4.2)).toBe(true);
  });

  it('stays quiet about ordinary variation', () => {
    expect(isSignificantDelta(4.2, 4.6)).toBe(false);
    expect(isSignificantDelta(140, 142)).toBe(false);
  });

  it('handles a previous value of zero without dividing by it', () => {
    expect(isSignificantDelta(0, 0)).toBe(false);
    expect(isSignificantDelta(0, 3)).toBe(true);
  });

  it('ignores values that are not finite', () => {
    expect(isSignificantDelta(Number.NaN, 5)).toBe(false);
    expect(isSignificantDelta(5, Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('reading the stored sex', () => {
  it('accepts the spellings the patient record uses', () => {
    expect(normaliseSex('Male')).toBe('male');
    expect(normaliseSex('M')).toBe('male');
    expect(normaliseSex('female')).toBe('female');
    expect(normaliseSex('F')).toBe('female');
  });

  it('does not guess', () => {
    expect(normaliseSex('')).toBe('unknown');
    expect(normaliseSex(null)).toBe('unknown');
    expect(normaliseSex('Other')).toBe('unknown');
  });
});
