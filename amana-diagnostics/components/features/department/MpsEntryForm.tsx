'use client';
import { MpsFormState } from '@/lib/store/labResults';

interface Props {
  value: MpsFormState;
  onChange: (next: MpsFormState) => void;
}

const densityPlusOptions = ['Nil', '+', '++', '+++', '++++'];
const speciesOptions = ['Nil', 'Plasmodium falciparum', 'Plasmodium vivax', 'Plasmodium malariae', 'Plasmodium ovale'];
const stageOptions = ['Nil', 'Trophozoites (ring forms)', 'Gametocytes', 'Schizonts', 'Trophozoites & Gametocytes'];

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 700,
  color: 'var(--gray-700)', marginBottom: '0.25rem', textTransform: 'uppercase',
};

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '0.45rem 0.65rem', border: '1px solid var(--gray-300)',
  borderRadius: 'var(--radius)', fontSize: '0.8rem', outline: 'none',
};

const rowStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem',
  borderTop: '1px solid var(--gray-100)', paddingTop: '1rem',
};

export default function MpsEntryForm({ value, onChange }: Props) {
  // Every edit patches the whole state at once. Marking parasites seen or not
  // seen changes four other fields with it, and applying those one at a time
  // would leave only the last.
  const patch = (over: Partial<MpsFormState>) => onChange({ ...value, ...over });

  const setParasiteSeen = (seen: string) => {
    if (seen === 'Not Seen') {
      patch({
        parasiteSeen: 'Not Seen',
        densityPlus: 'Nil', densityCount: 'Nil', species: 'Nil', stage: 'Nil',
      });
    } else if (value.densityPlus === 'Nil') {
      // Coming from a negative form: offer the commonest positive finding
      // rather than making the technologist fill three fields from Nil.
      patch({
        parasiteSeen: 'Seen',
        densityPlus: '+',
        species: 'Plasmodium falciparum',
        stage: 'Trophozoites (ring forms)',
      });
    } else {
      patch({ parasiteSeen: 'Seen' });
    }
  };

  const notSeen = value.parasiteSeen === 'Not Seen';

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
          Malaria Parasite (MPs) Microscopy Form
        </h3>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Malaria Parasite Detection</label>
              <select
                value={value.parasiteSeen}
                onChange={e => setParasiteSeen(e.target.value)}
                style={{
                  ...fieldStyle,
                  background: value.parasiteSeen === 'Seen' ? 'var(--red-light)' : 'white',
                  color: value.parasiteSeen === 'Seen' ? 'var(--red)' : 'var(--gray-900)',
                  fontWeight: value.parasiteSeen === 'Seen' ? 'bold' : 'normal'
                }}
              >
                <option value="Not Seen">Not Seen (Negative)</option>
                <option value="Seen">Seen (Positive)</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Density (+ Plus System)</label>
              <select
                value={value.densityPlus}
                onChange={e => patch({ densityPlus: e.target.value as MpsFormState['densityPlus'] })}
                disabled={notSeen}
                style={{ ...fieldStyle, background: notSeen ? 'var(--gray-100)' : 'white' }}
              >
                {densityPlusOptions.map(o => (
                  <option key={o} value={o}>{o === 'Nil' ? 'Nil (Not Seen)' : o}</option>
                ))}
              </select>
            </div>
          </div>

          {value.parasiteSeen === 'Seen' && (
            <div style={rowStyle}>
              <div>
                <label style={labelStyle}>Parasite Species</label>
                <select
                  value={value.species}
                  onChange={e => patch({ species: e.target.value })}
                  style={fieldStyle}
                >
                  {speciesOptions.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Parasite Stage</label>
                <select
                  value={value.stage}
                  onChange={e => patch({ stage: e.target.value })}
                  style={fieldStyle}
                >
                  {stageOptions.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div style={rowStyle}>
            <div>
              <label style={labelStyle}>Quantitative Density (parasites / µL)</label>
              <input
                value={value.densityCount}
                onChange={e => patch({ densityCount: e.target.value })}
                placeholder="e.g. 240 / µL or Nil"
                style={{ ...fieldStyle, fontFamily: 'var(--font-body)' }}
              />
            </div>

            <div>
              <label style={labelStyle}>Microscopy Comments / RBC Morphology</label>
              <input
                value={value.comment}
                onChange={e => patch({ comment: e.target.value })}
                placeholder="e.g. Normocytic, normochromic RBCs. No other haemoparasite seen."
                style={{ ...fieldStyle, fontFamily: 'var(--font-body)' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
