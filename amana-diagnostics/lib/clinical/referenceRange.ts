/**
 * Reading a reference range, and deciding what a result is.
 *
 * The reference range has always been stored beside every parameter and shown
 * to the technologist, but nothing ever read it. The H/L flag was a dropdown
 * they set by hand, so an unset flag looked exactly like a normal result and a
 * mis-set one was invisible. This is the parser that closes that gap.
 *
 * The formats below are the ones actually present in the catalogue — counted,
 * not guessed:
 *
 *   3.5-5.0            a closed range
 *   <100  <1:80        an upper bound only (titres included)
 *   >1.5               a lower bound only
 *   F: 35-135 / M: 40-160        sex-specific, three spellings of each sex
 *   Negative  Nil  Normal  Non-Reactive  Not Seen       qualitative
 *   (empty)            no range recorded
 *
 * Anything unrecognised returns `kind: 'none'` and produces no flag. Guessing
 * at a range we cannot read would be worse than leaving it to the human.
 */

export type Sex = 'male' | 'female' | 'unknown';

export type ReferenceRange =
  | { kind: 'none' }
  | { kind: 'qualitative'; expected: string }
  | { kind: 'numeric'; low: number | null; high: number | null }
  | { kind: 'sexed'; male: ReferenceRange; female: ReferenceRange };

/** Empty means "within range"; the rest match ResultFlagValue in the UI. */
export type Flag = '' | 'H' | 'L' | 'HH' | 'LL';

const QUALITATIVE = [
  'negative', 'nil', 'normal', 'non-reactive', 'nonreactive',
  'not seen', 'absent', 'none seen', 'clear', 'trace',
];

/** "1:80" is a titre; its magnitude is the denominator. */
function parseNumber(raw: string): number | null {
  const text = raw.trim();
  const titre = text.match(/^1\s*:\s*(\d+(?:\.\d+)?)$/);
  if (titre) return Number(titre[1]);
  const plain = text.match(/^-?\d+(?:\.\d+)?$/);
  return plain ? Number(text) : null;
}

function parseSimple(raw: string): ReferenceRange {
  const text = raw.trim();
  if (!text) return { kind: 'none' };

  if (QUALITATIVE.includes(text.toLowerCase())) {
    return { kind: 'qualitative', expected: text };
  }

  const upper = text.match(/^<\s*=?\s*(.+)$/);
  if (upper) {
    const high = parseNumber(upper[1]!);
    return high === null ? { kind: 'none' } : { kind: 'numeric', low: null, high };
  }

  const lower = text.match(/^>\s*=?\s*(.+)$/);
  if (lower) {
    const low = parseNumber(lower[1]!);
    return low === null ? { kind: 'none' } : { kind: 'numeric', low, high: null };
  }

  // A closed range. The separator may be a hyphen, an en dash, or " to ".
  // Split on the LAST separator so a negative lower bound survives.
  const closed = text.match(/^(-?[\d.]+(?:\s*:\s*\d+)?)\s*(?:-|–|—|to)\s*(-?[\d.]+(?:\s*:\s*\d+)?)$/i);
  if (closed) {
    const low = parseNumber(closed[1]!);
    const high = parseNumber(closed[2]!);
    if (low !== null && high !== null) return { kind: 'numeric', low, high };
  }

  return { kind: 'none' };
}

const MALE = /^\s*(m|male)\s*$/i;
const FEMALE = /^\s*(f|female)\s*$/i;

/** Parses one stored reference-range string. */
export function parseReferenceRange(raw: string | null | undefined): ReferenceRange {
  const text = (raw ?? '').trim();
  if (!text) return { kind: 'none' };

  // "F: 35-135 / M: 40-160" — either sex may come first, and the separator is
  // a slash in every example in the catalogue.
  if (text.includes(':') && /\b(m|f|male|female)\s*:/i.test(text)) {
    const parts = text.split(/[/;]/).map((p) => p.trim()).filter(Boolean);
    let male: ReferenceRange = { kind: 'none' };
    let female: ReferenceRange = { kind: 'none' };
    let matched = 0;

    for (const part of parts) {
      const at = part.indexOf(':');
      if (at < 0) continue;
      const label = part.slice(0, at);
      const value = part.slice(at + 1);
      if (MALE.test(label)) {
        male = parseSimple(value);
        matched++;
      } else if (FEMALE.test(label)) {
        female = parseSimple(value);
        matched++;
      }
    }

    if (matched > 0) return { kind: 'sexed', male, female };
  }

  return parseSimple(text);
}

/** Picks the arm of a sexed range that applies. Unknown sex has no range. */
export function resolveForSex(range: ReferenceRange, sex: Sex): ReferenceRange {
  if (range.kind !== 'sexed') return range;
  if (sex === 'male') return range.male;
  if (sex === 'female') return range.female;
  // Flagging against one sex's range when we do not know the patient's would
  // be a guess with a clinical consequence. Leave it to the human.
  return { kind: 'none' };
}

/**
 * Panic thresholds: the values a clinician has to be told about now.
 *
 * These defaults cover analytes where published critical limits are broadly
 * consistent, and they are deliberately conservative. They are a starting
 * point, not an authority: every laboratory sets its own critical limits, and
 * a medical director is expected to review and sign off on this list. The UI
 * says so, and `criticalLimitsFor` takes an override so a workspace can
 * replace any of them.
 *
 * Units follow the catalogue's own entries for each analyte.
 */
export interface CriticalLimits {
  /** At or below this is a critical low. */
  low?: number;
  /** At or above this is a critical high. */
  high?: number;
  unit: string;
}

export const DEFAULT_CRITICAL_LIMITS: Record<string, CriticalLimits> = {
  potassium:   { low: 2.8, high: 6.2, unit: 'mmol/L' },
  sodium:      { low: 120, high: 160, unit: 'mmol/L' },
  glucose:     { low: 2.5, high: 25.0, unit: 'mmol/L' },
  calcium:     { low: 1.6, high: 3.5, unit: 'mmol/L' },
  haemoglobin: { low: 7.0, high: 20.0, unit: 'g/dL' },
  hemoglobin:  { low: 7.0, high: 20.0, unit: 'g/dL' },
  platelets:   { low: 50, high: 1000, unit: 'x10^9/L' },
  'platelet count': { low: 50, high: 1000, unit: 'x10^9/L' },
  'white blood cells': { low: 2.0, high: 30.0, unit: 'x10^9/L' },
  wbc:         { low: 2.0, high: 30.0, unit: 'x10^9/L' },
  creatinine:  { high: 500, unit: 'umol/L' },
};

/** Matches a parameter name to a limit set, tolerantly. */
export function criticalLimitsFor(
  parameter: string,
  overrides?: Record<string, CriticalLimits>,
): CriticalLimits | null {
  const key = parameter.trim().toLowerCase();
  const table = { ...DEFAULT_CRITICAL_LIMITS, ...(overrides ?? {}) };

  if (table[key]) return table[key]!;

  // "Serum Potassium (K+)" should still find "potassium".
  for (const [name, limits] of Object.entries(table)) {
    if (key.includes(name)) return limits;
  }
  return null;
}

export interface DeriveOptions {
  parameter?: string;
  sex?: Sex;
  criticalOverrides?: Record<string, CriticalLimits>;
  /** Set false to derive H/L only and never escalate to a critical tier. */
  useCriticalLimits?: boolean;
}

/**
 * What flag a result carries, given its reference range.
 *
 * Returns `null` — meaning "no opinion" — when the result is not numeric or
 * the range cannot be read. `null` is not the same as `''`: an empty string
 * asserts the value is in range, and we must not assert that on a guess.
 */
export function deriveFlag(
  result: string | number | null | undefined,
  rangeText: string | null | undefined,
  options: DeriveOptions = {},
): Flag | null {
  const { parameter, sex = 'unknown', criticalOverrides, useCriticalLimits = true } = options;

  const value = typeof result === 'number' ? result : parseNumber(String(result ?? ''));
  if (value === null || Number.isNaN(value)) return null;

  // A panic value outranks the reference range: it is the reason the result
  // needs a phone call, whatever the range says.
  if (useCriticalLimits && parameter) {
    const limits = criticalLimitsFor(parameter, criticalOverrides);
    if (limits) {
      if (limits.low !== undefined && value <= limits.low) return 'LL';
      if (limits.high !== undefined && value >= limits.high) return 'HH';
    }
  }

  const range = resolveForSex(parseReferenceRange(rangeText), sex);

  if (range.kind === 'numeric') {
    if (range.low !== null && value < range.low) return 'L';
    if (range.high !== null && value > range.high) return 'H';
    return '';
  }

  return null;
}

/** True for the two tiers that carry a release interlock. */
export const isCritical = (flag: Flag | null): boolean => flag === 'HH' || flag === 'LL';

/** True for anything outside the reference range, critical included. */
export const isAbnormal = (flag: Flag | null): boolean =>
  flag === 'H' || flag === 'L' || flag === 'HH' || flag === 'LL';

/**
 * Whether this result differs enough from the patient's last one to be worth
 * a second look before release.
 *
 * A delta check is how a transposed digit or a mislabelled tube gets caught:
 * the number is plausible on its own and implausible next to last week's. The
 * threshold is deliberately loose — this prompts a human to look, it does not
 * block anything, and crying wolf would make it useless.
 */
export function isSignificantDelta(
  previous: number,
  current: number,
  /** Fractional change that counts as significant. 0.5 = fifty per cent. */
  threshold = 0.5,
): boolean {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return false;
  if (previous === 0) return current !== 0;
  return Math.abs(current - previous) / Math.abs(previous) >= threshold;
}

/** Reads a patient's stored sex into the value the range parser expects. */
export function normaliseSex(raw: string | null | undefined): Sex {
  const text = (raw ?? '').trim().toLowerCase();
  if (text.startsWith('m')) return 'male';
  if (text.startsWith('f')) return 'female';
  return 'unknown';
}
