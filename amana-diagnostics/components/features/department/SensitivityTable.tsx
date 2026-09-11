'use client';

import { McsFormState } from '@/lib/store/labResults';
import { Alert, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';

import styles from './entryForm.module.css';

type Sensitivity = McsFormState['sensitivity'];
type Result = Sensitivity[number]['result'];

interface Props {
  /** The whole antibiogram; it is split down the middle into two columns. */
  sensitivity: Sensitivity;
  gramReaction: string;
  onResult: (index: number, result: Result) => void;
}

/**
 * What each score means, spelled out.
 *
 * The row said "R" and tinted itself red. A doctor prescribes from this, and a
 * tint is not a reading — it does not survive a monochrome print, a colour
 * vision difference, or a screen reader. The word goes beside the letter.
 */
const MEANING: Record<Exclude<Result, ''>, string> = {
  S: 'Sensitive',
  I: 'Intermediate',
  R: 'Resistant',
};

const WORD_CLASS: Record<Exclude<Result, ''>, string> = {
  S: styles['wordS']!,
  I: styles['wordI']!,
  R: styles['wordR']!,
};

function AntibioticColumn({
  rows,
  offset,
  onResult,
}: {
  rows: Sensitivity;
  offset: number;
  onResult: Props['onResult'];
}) {
  const focusRow = (index: number) => {
    document.getElementById(`anti-input-${index}`)?.focus();
  };

  // Typing S, I or R scores the row and jumps to the next, so a technologist
  // can work down a plate reading without touching the mouse.
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key.toUpperCase();
    if (key === 'S' || key === 'I' || key === 'R') {
      e.preventDefault();
      onResult(index, key as Result);
      focusRow(index + 1);
    } else if (key === 'BACKSPACE' || key === 'DELETE') {
      e.preventDefault();
      onResult(index, '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusRow(index + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusRow(index - 1);
    }
  };

  return (
    <table className={styles['astTable']}>
      <caption className="sr-only">
        Antibiotic sensitivity. Type S, I or R in a result box to score it and move to the next.
      </caption>
      <thead>
        <tr>
          <th scope="col">Antibiotic</th>
          <th scope="col">Result</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, idx) => {
          const globalIdx = offset + idx;
          const scored = s.result !== '';

          return (
            <tr key={s.code} className={scored ? styles['scored'] : undefined}>
              <td>
                <span className={styles['drug']}>{s.antibiotic}</span>{' '}
                <span className={styles['code']}>({s.code})</span>
              </td>
              <td>
                <div className={styles['scoreCell']}>
                  <Input
                    id={`anti-input-${globalIdx}`}
                    // Named after the drug. Thirty identical one-character
                    // boxes were thirty of "edit text", and scoring the wrong
                    // row is a wrong prescription.
                    aria-label={`${s.antibiotic} result`}
                    className={styles['scoreBox']}
                    value={s.result}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      if (['S', 'I', 'R', ''].includes(val)) onResult(globalIdx, val as Result);
                    }}
                    onKeyDown={(e) => handleKeyDown(globalIdx, e)}
                    placeholder="—"
                    maxLength={1}
                  />

                  {scored && (
                    <span className={`${styles['scoreWord']} ${WORD_CLASS[s.result as 'S']}`}>
                      {MEANING[s.result as 'S']}
                    </span>
                  )}

                  <span className={styles['scoreButtons']}>
                    {(['S', 'I', 'R'] as const).map((res) => (
                      <Button
                        key={res}
                        size="sm"
                        intent={s.result === res ? 'primary' : 'secondary'}
                        aria-pressed={s.result === res}
                        aria-label={`${s.antibiotic}: ${MEANING[res]}`}
                        onClick={() => onResult(globalIdx, res)}
                      >
                        {res}
                      </Button>
                    ))}
                    {scored && (
                      <Button
                        size="sm"
                        intent="ghost"
                        aria-label={`Clear the ${s.antibiotic} result`}
                        onClick={() => onResult(globalIdx, '')}
                      >
                        Clear
                      </Button>
                    )}
                  </span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function SensitivityTable({ sensitivity, gramReaction, onResult }: Props) {
  const half = Math.ceil(sensitivity.length / 2);

  return (
    <Card>
      <CardHeader
        title="Antibiotic sensitivity"
        subtitle="Type S, I or R to score a row and move to the next."
      />
      <CardBody>
        {!gramReaction ? (
          <Alert tone="warning">
            Choose a gram reaction in the culture section above — gram positive or gram negative —
            to load the matching antibiotics.
          </Alert>
        ) : sensitivity.length === 0 ? (
          <p className={styles['astHint']}>
            No antibiotics for a {gramReaction.toLowerCase()} culture. A panel is loaded only for
            gram positive and gram negative.
          </p>
        ) : (
          <div className={styles['panel']}>
            <AntibioticColumn rows={sensitivity.slice(0, half)} offset={0} onResult={onResult} />
            <AntibioticColumn rows={sensitivity.slice(half)} offset={half} onResult={onResult} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
