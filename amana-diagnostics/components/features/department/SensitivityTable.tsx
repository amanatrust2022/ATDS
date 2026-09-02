'use client';
import { McsFormState } from '@/lib/store/labResults';
import { cardStyle, cardHeaderStyle, tableHeaderStyle } from './entryFormStyles';

type Sensitivity = McsFormState['sensitivity'];
type Result = Sensitivity[number]['result'];

interface Props {
  /** The whole antibiogram; it is split down the middle into two columns. */
  sensitivity: Sensitivity;
  gramReaction: string;
  onResult: (index: number, result: Result) => void;
}

const rowColour = (result: Result) =>
  result === 'R' ? 'rgba(192, 57, 43, 0.08)'
    : result === 'S' ? 'rgba(30, 126, 90, 0.08)'
      : result === 'I' ? 'rgba(212, 133, 10, 0.08)'
        : 'white';

const textColour = (result: Result) =>
  result === 'R' ? 'var(--red)'
    : result === 'S' ? 'var(--green)'
      : result === 'I' ? 'var(--amber)'
        : 'var(--gray-900)';

const buttonColour = (res: 'S' | 'I' | 'R') =>
  res === 'R' ? 'var(--red)' : res === 'S' ? 'var(--green)' : 'var(--amber)';

/**
 * One column of the antibiogram. `offset` is the row's position in the whole
 * list, which is what the input ids, the tab order and the S/I/R keyboard
 * navigation all count in — so the two columns read as one continuous run.
 */
function AntibioticColumn({
  rows, offset, onResult,
}: { rows: Sensitivity; offset: number; onResult: Props['onResult'] }) {
  const focusRow = (index: number) => {
    const el = document.getElementById(`anti-input-${index}`);
    if (el) (el as HTMLInputElement).focus();
  };

  // Typing S, I or R scores the row and jumps to the next, so a technologist can
  // work down a plate reading without touching the mouse.
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
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
      <thead>
        <tr style={{ background: 'var(--teal-50)' }}>
          <th style={{ ...tableHeaderStyle, width: '45%' }}>Antibiotic Name</th>
          <th style={tableHeaderStyle}>Result</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, idx) => {
          const globalIdx = offset + idx;
          const colour = textColour(s.result);

          return (
            <tr key={s.code} style={{ borderBottom: '1px solid var(--gray-100)', background: rowColour(s.result) }}>
              <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600, color: colour }}>
                {s.antibiotic} ({s.code})
              </td>
              <td style={{ padding: '0.25rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  id={`anti-input-${globalIdx}`}
                  value={s.result}
                  onChange={e => {
                    const val = e.target.value.toUpperCase();
                    if (['S', 'I', 'R', ''].includes(val)) {
                      onResult(globalIdx, val as Result);
                    }
                  }}
                  onKeyDown={e => handleKeyDown(globalIdx, e)}
                  placeholder="-"
                  maxLength={1}
                  style={{
                    width: '32px',
                    padding: '0.2rem',
                    border: '1px solid var(--gray-300)',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    color: colour,
                    background: 'white'
                  }}
                  tabIndex={100 + globalIdx}
                />
                <div style={{ display: 'flex', gap: '0.15rem' }}>
                  {(['S', 'I', 'R'] as const).map(res => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => onResult(globalIdx, res)}
                      style={{
                        border: '1px solid var(--gray-300)',
                        background: s.result === res ? buttonColour(res) : 'white',
                        color: s.result === res ? 'white' : 'var(--gray-600)',
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        padding: '0.1rem 0.3rem',
                        cursor: 'pointer'
                      }}
                    >
                      {res}
                    </button>
                  ))}
                  {s.result && (
                    <button
                      type="button"
                      onClick={() => onResult(globalIdx, '')}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: 'var(--gray-400)',
                        fontSize: '0.65rem',
                        padding: '0.1rem 0.2rem',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Clear
                    </button>
                  )}
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
  const halfLength = Math.ceil(sensitivity.length / 2);

  return (
    <div style={cardStyle}>
      <h3 style={cardHeaderStyle}>Antibiotic Sensitivity Testing (AST)</h3>
      <div style={{ padding: '1rem' }}>
        {!gramReaction ? (
          <div style={{ color: 'var(--amber)', background: 'var(--amber-light)', padding: '0.75rem 1rem', border: '1px solid #ffeeba', fontSize: '0.8rem', fontWeight: 600 }}>
            Please select Gram Reaction (Gram Positive or Gram Negative) in the Culture section above to load the matching antibiotics.
          </div>
        ) : sensitivity.length === 0 ? (
          <div style={{ color: 'var(--gray-500)', fontSize: '0.8rem', fontStyle: 'italic' }}>
            No antibiotics populated. Verify that Gram Reaction is Gram Positive or Gram Negative.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <AntibioticColumn rows={sensitivity.slice(0, halfLength)} offset={0} onResult={onResult} />
            <AntibioticColumn rows={sensitivity.slice(halfLength)} offset={halfLength} onResult={onResult} />
          </div>
        )}
      </div>
    </div>
  );
}
