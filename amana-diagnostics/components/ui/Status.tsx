'use client';

import type { ReactNode } from 'react';
import styles from './Status.module.css';

/**
 * Status marks.
 *
 * Nothing here encodes meaning in colour alone. The result grid these
 * replace tinted a cell red for high and blue for low and put a bare letter
 * beside it — which fails WCAG 1.4.1, disappears on the monochrome printouts
 * clinics actually hand out, and is read aloud as "H" with no context.
 */

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'critical' | 'info';

/** A small labelled marker: a department, a plan tier, a payment state. */
export function Badge({
  children,
  tone = 'neutral',
  solid = false,
  icon,
}: {
  children: ReactNode;
  tone?: Tone;
  /** Filled rather than tinted. For the one badge that must not be missed. */
  solid?: boolean;
  icon?: ReactNode;
}) {
  return (
    <span
      className={[styles['badge'], styles[tone], solid ? styles['solid'] : '']
        .filter(Boolean)
        .join(' ')}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

/**
 * Where something is in a workflow. The dot's shape carries the state as
 * well as its colour, so the four states stay distinguishable in greyscale.
 */
export type StatusShape = 'ring' | 'filled' | 'square' | 'pulse';

export function StatusPill({
  label,
  tone = 'neutral',
  shape = 'ring',
}: {
  label: string;
  tone?: Exclude<Tone, 'info'>;
  shape?: StatusShape;
}) {
  const toneClass = {
    neutral: styles['toneNeutral'],
    accent: styles['toneAccent'],
    success: styles['toneSuccess'],
    warning: styles['toneWarning'],
    critical: styles['toneCritical'],
  }[tone];

  const shapeClass = {
    ring: '',
    filled: styles['dotFilled'],
    square: styles['dotSquare'],
    pulse: styles['dotPulse'],
  }[shape];

  return (
    <span className={[styles['pill'], toneClass].filter(Boolean).join(' ')}>
      <span
        className={[styles['dot'], shapeClass].filter(Boolean).join(' ')}
        aria-hidden="true"
      />
      <span className={styles['pillLabel']}>{label}</span>
    </span>
  );
}

/* ========================================================================
 * Clinical result flags
 * ==================================================================== */

/**
 * How a result sits against its reference range.
 *
 * `critical` is deliberately not "very high" — a panic value is a different
 * kind of thing from an abnormal one, it has its own thresholds, and it
 * carries a release interlock. Keeping them separate in the type stops the
 * two being conflated at the call site.
 */
export type ResultFlagValue = '' | 'H' | 'L' | 'HH' | 'LL';

const FLAG_TEXT: Record<Exclude<ResultFlagValue, ''>, { mark: string; word: string }> = {
  H: { mark: 'H', word: 'High' },
  L: { mark: 'L', word: 'Low' },
  HH: { mark: 'HH', word: 'Critical high' },
  LL: { mark: 'LL', word: 'Critical low' },
};

export function ResultFlag({
  value,
  /** Hides the word on very narrow columns. The letter and colour remain,
   * and the full wording still reaches screen readers. */
  compact = false,
}: {
  value: ResultFlagValue;
  compact?: boolean;
}) {
  if (!value) {
    return (
      <span className={[styles['flag'], styles['flagNormal']].join(' ')}>
        <span aria-hidden="true">&mdash;</span>
        <span className="sr-only">Within reference range</span>
      </span>
    );
  }

  const { mark, word } = FLAG_TEXT[value];
  const critical = value === 'HH' || value === 'LL';
  const toneClass = critical
    ? styles['flagCritical']
    : value === 'H'
      ? styles['flagHigh']
      : styles['flagLow'];

  return (
    <span className={[styles['flag'], toneClass].join(' ')}>
      <span className={styles['flagMark']} aria-hidden="true">
        {mark}
      </span>
      {!compact && <span aria-hidden="true">{word}</span>}
      <span className="sr-only">{word}</span>
    </span>
  );
}

/**
 * This result against the patient's previous one for the same parameter.
 *
 * A delta check is how a transposed digit or a mislabelled tube gets caught
 * before release: the number is plausible on its own and implausible next to
 * last week's. `significant` marks a change large enough to be worth a look.
 */
export function ResultDelta({
  previous,
  current,
  unit,
  significant = false,
}: {
  previous: number;
  current: number;
  unit?: string;
  significant?: boolean;
}) {
  const change = current - previous;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'level';
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  const magnitude = Math.abs(change);

  return (
    <span
      className={[styles['delta'], significant ? styles['deltaWarn'] : '']
        .filter(Boolean)
        .join(' ')}
      title={`Previous: ${previous}${unit ? ` ${unit}` : ''}`}
    >
      <span aria-hidden="true">{arrow}</span>
      <span aria-hidden="true">
        {magnitude}
        {unit ? ` ${unit}` : ''}
      </span>
      <span className="sr-only">
        {direction === 'level'
          ? 'Unchanged from previous result'
          : `${magnitude}${unit ? ` ${unit}` : ''} ${direction} from previous result of ${previous}${
              unit ? ` ${unit}` : ''
            }${significant ? '. Larger than expected — please check.' : ''}`}
      </span>
    </span>
  );
}
