'use client';
import { WidalFormState } from '@/lib/store/labResults';

interface Props {
  value: WidalFormState;
  onChange: (next: WidalFormState) => void;
}

const antigens = [
  { name: 'S. Typhi', keys: { O: 'typhiO', H: 'typhiH' } },
  { name: 'S. Paratyphi A', keys: { O: 'paratyphiAO', H: 'paratyphiAH' } },
  { name: 'S. Paratyphi B', keys: { O: 'paratyphiBO', H: 'paratyphiBH' } },
  { name: 'S. Paratyphi C', keys: { O: 'paratyphiCO', H: 'paratyphiCH' } }
] as const;

const titerOptions = ['Negative', '1:20', '1:40', '1:80', '1:160', '1:320'];

/** 1:80 and above is the clinically significant titre, so it is called out in red. */
const isSignificant = (titer: string) =>
  titer !== 'Negative' && titer !== '1:20' && titer !== '1:40';

function TiterCell({ titer, onSelect }: { titer: string; onSelect: (val: string) => void }) {
  const significant = isSignificant(titer);
  return (
    <td style={{ padding: '0.35rem' }}>
      <select
        value={titer}
        onChange={e => onSelect(e.target.value)}
        style={{
          width: '100%',
          padding: '0.4rem 0.6rem',
          border: '1px solid var(--gray-300)',
          borderRadius: 'var(--radius)',
          fontSize: '0.8rem',
          outline: 'none',
          background: significant ? 'var(--red-light)' : 'white',
          color: significant ? 'var(--red)' : 'var(--gray-900)',
          fontWeight: significant ? 'bold' : 'normal'
        }}
      >
        {titerOptions.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </td>
  );
}

export default function WidalEntryForm({ value, onChange }: Props) {
  const setTiter = (key: keyof WidalFormState, val: string) => onChange({ ...value, [key]: val });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
      <div style={{
        background: 'white',
        border: '1px solid var(--teal-200)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <h3 style={{
          background: 'var(--teal-50)',
          color: 'var(--teal-850)',
          fontSize: '0.8rem',
          fontWeight: 700,
          padding: '0.6rem 1rem',
          borderBottom: '1px solid var(--teal-200)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Salmonella Antigen Titers (Widal Reaction Matrix)
        </h3>
        <div style={{ padding: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--teal-200)' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 700, color: 'var(--teal-800)' }}>Antigen</th>
                <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: 'var(--teal-800)', width: '40%' }}>O Titer</th>
                <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: 'var(--teal-800)', width: '40%' }}>H Titer</th>
              </tr>
            </thead>
            <tbody>
              {antigens.map(a => (
                <tr key={a.name} style={{ borderBottom: '1px solid var(--gray-200)' }}>
                  <td style={{ padding: '0.5rem', fontWeight: 600, color: 'var(--gray-800)' }}>{a.name}</td>
                  <TiterCell titer={value[a.keys.O]} onSelect={val => setTiter(a.keys.O, val)} />
                  <TiterCell titer={value[a.keys.H]} onSelect={val => setTiter(a.keys.H, val)} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
