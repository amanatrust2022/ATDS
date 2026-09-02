'use client';
import type { DepartmentTheme } from './theme';

export interface EditableResult {
  parameter: string;
  result: string;
  unit: string;
  range: string;
  flag: string;
}

interface Props {
  results: EditableResult[];
  onUpdate: (index: number, field: 'result' | 'flag', value: string) => void;
  theme: DepartmentTheme;
}

const headings = ['Parameter', 'Result', 'Unit', 'Reference Range', 'Flag'];

/** High reads red, low reads blue, normal stays plain. */
const flagBackground = (flag: string) =>
  flag === 'H' ? '#fdf2f2' : flag === 'L' ? '#eff6ff' : 'white';

const flagColour = (flag: string) =>
  flag === 'H' ? 'var(--red)' : flag === 'L' ? '#1a6aaf' : 'var(--gray-500)';

/**
 * The plain parameter/result grid, used both as the whole form for an ordinary
 * test and as the "Additional Parameters" block beneath a Widal or MPs matrix.
 */
export default function ParameterTable({ results, onUpdate, theme }: Props) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
      <thead>
        <tr style={{ background: theme.light }}>
          {headings.map(h => (
            <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700, color: theme.text, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--gray-100)' }}>
            <td style={{ padding: '0.45rem 0.75rem', fontWeight: 500 }}>{r.parameter}</td>
            <td style={{ padding: '0.3rem 0.5rem' }}>
              <input
                value={r.result}
                onChange={e => onUpdate(i, 'result', e.target.value)}
                placeholder="Enter result"
                style={{ padding: '0.35rem 0.6rem', border: '1px solid var(--gray-300)', borderRadius: 0, fontSize: '0.8rem', width: '100%', minWidth: 120, background: flagBackground(r.flag), fontFamily: 'var(--font-body)' }}
              />
            </td>
            <td style={{ padding: '0.45rem 0.75rem', color: 'var(--gray-500)' }}>{r.unit || '—'}</td>
            <td style={{ padding: '0.45rem 0.75rem', color: 'var(--gray-500)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{r.range || '—'}</td>
            <td style={{ padding: '0.3rem 0.5rem' }}>
              <select
                value={r.flag}
                onChange={e => onUpdate(i, 'flag', e.target.value)}
                style={{ padding: '0.35rem 0.5rem', borderRadius: 0, fontSize: '0.8rem', border: '1px solid var(--gray-300)', background: flagBackground(r.flag), color: flagColour(r.flag), fontWeight: r.flag ? 700 : 400, fontFamily: 'var(--font-body)' }}
              >
                <option value="">Normal</option>
                <option value="H">H (High)</option>
                <option value="L">L (Low)</option>
              </select>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
