import {
  FLAG_WORD,
  deriveFlag,
  isAbnormal,
  isCritical,
  type Flag,
  type Sex,
} from './referenceRange';

/**
 * The comment a set of results writes for itself.
 *
 * Every report carries a free-text comment box and almost every report goes out
 * with it empty, because writing the same sentence about the same panel forty
 * times a day is the first thing a busy bench stops doing. What is lost is not
 * decoration: the comment is the only part of the report that says, in words,
 * which values are outside their range and which of them matter now. A clinician
 * reading a column of numbers against a column of ranges has to do that work
 * themselves, on every report, and a critical value can pass unremarked.
 *
 * So the flags write it. The rule is narrow on purpose:
 *
 *   - it reports what the flags say, and nothing more — no diagnosis, no
 *     suggested treatment, no differential. "Haemoglobin is low" is a reading
 *     of the reference range; "the patient is anaemic" is a diagnosis, and this
 *     is not the thing that makes diagnoses;
 *   - a parameter with no result, or no readable reference range, is named as
 *     not assessed rather than silently called normal;
 *   - critical values lead, because they are why somebody must be telephoned;
 *   - and every word of it is editable. It is a draft in the technologist's
 *     box, not a signature on their behalf.
 */

export interface CommentableResult {
  parameter: string;
  result: string;
  unit?: string;
  range?: string;
  flag?: string;
}

export interface AutoCommentOptions {
  sex?: Sex;
  /** Caps how many abnormal parameters are named before they are counted. */
  maxNamed?: number;
}

interface Assessed {
  row: CommentableResult;
  flag: Flag | null;
}

/** What each row is, taking an override over the derived flag. */
export function assess(
  results: CommentableResult[],
  sex: Sex = 'unknown',
): Assessed[] {
  return results.map((row) => {
    if (!String(row.result ?? '').trim()) return { row, flag: null };
    const suggested = deriveFlag(row.result, row.range, { parameter: row.parameter, sex });
    const flag = (row.flag || suggested || null) as Flag | null;
    return { row, flag: flag === '' ? null : flag };
  });
}

const withUnit = (row: CommentableResult) =>
  `${String(row.result).trim()}${row.unit ? ` ${row.unit}` : ''}`;

/** "Haemoglobin 9.1 g/dL (reference 12 - 16) is low." */
function sentenceFor({ row, flag }: Assessed): string {
  const word = FLAG_WORD[(flag || 'N') as Exclude<Flag, ''>];
  const reference = row.range?.trim() ? ` (reference ${row.range.trim()})` : '';
  return `${row.parameter} ${withUnit(row)}${reference} is ${word}.`;
}

const list = (items: string[], maxNamed: number): string => {
  if (items.length <= maxNamed) return items.join(' ');
  const rest = items.length - maxNamed;
  return `${items.slice(0, maxNamed).join(' ')} A further ${rest} parameter${rest === 1 ? ' is' : 's are'} outside the reference range.`;
};

/**
 * Builds the comment. Returns an empty string when there is nothing yet to
 * comment on — no results typed — so nothing is written into an empty form.
 */
export function buildAutoComment(
  results: CommentableResult[],
  options: AutoCommentOptions = {},
): string {
  const { sex = 'unknown', maxNamed = 8 } = options;
  const assessed = assess(results, sex);

  const entered = assessed.filter(({ row }) => String(row.result ?? '').trim() !== '');
  if (entered.length === 0) return '';

  const critical = entered.filter(({ flag }) => isCritical(flag));
  const abnormal = entered.filter(({ flag }) => isAbnormal(flag) && !isCritical(flag));
  const normal = entered.filter(({ flag }) => flag === 'N');
  const unassessed = entered.filter(({ flag }) => flag === null);

  const parts: string[] = [];

  if (critical.length > 0) {
    parts.push(
      `CRITICAL: ${list(critical.map(sentenceFor), maxNamed)} ` +
      'Result verified and the requesting clinician is to be informed without delay.',
    );
  }

  if (abnormal.length > 0) {
    parts.push(list(abnormal.map(sentenceFor), maxNamed));
  }

  if (critical.length === 0 && abnormal.length === 0 && normal.length > 0) {
    parts.push(
      normal.length === entered.length
        ? 'All parameters are within their reference ranges.'
        : 'No parameter is outside its reference range.',
    );
  } else if (normal.length > 0) {
    parts.push(
      `The remaining ${normal.length} parameter${normal.length === 1 ? ' is' : 's are'} within ${normal.length === 1 ? 'its' : 'their'} reference range${normal.length === 1 ? '' : 's'}.`,
    );
  }

  // Never let silence stand for normality. A parameter the range parser cannot
  // read is one nobody has checked, and the comment has to say so rather than
  // let it be counted among the values found to be in range.
  if (unassessed.length > 0) {
    const names = unassessed.slice(0, maxNamed).map(({ row }) => row.parameter).join(', ');
    const more = unassessed.length > maxNamed ? ` and ${unassessed.length - maxNamed} more` : '';
    parts.push(
      `Not assessed against a reference range: ${names}${more}. Interpret clinically.`,
    );
  }

  return parts.join(' ').trim();
}

/**
 * Whether the comment box may be rewritten as the results change.
 *
 * Deliberately not a marker inside the text: nothing about how the sentence was
 * produced belongs on a clinical document a patient keeps. The caller remembers
 * the last comment it generated, and the box is its own to replace only while
 * it still holds exactly that, or nothing at all. The moment a technologist
 * types a single character of their own, it is theirs.
 */
export function mayReplace(
  notes: string | null | undefined,
  lastGenerated: string | null | undefined,
): boolean {
  const text = (notes ?? '').trim();
  return text === '' || text === (lastGenerated ?? '').trim();
}
