'use client';
import {
  McsFormState,
  colourOptions, appearanceOptions, microscopyDefaults,
  growthOptions, degreeOptions, shapeOptions,
  GRAM_POSITIVE_ANTIBIOTICS, GRAM_NEGATIVE_ANTIBIOTICS,
  isNoGrowth,
} from '@/lib/store/labResults';
import SensitivityTable from './SensitivityTable';
import { cardStyle, cardHeaderStyle, labelStyle, inputStyle, tableHeaderStyle, btnStyle } from './entryFormStyles';

interface Props {
  value: McsFormState;
  onChange: (next: McsFormState) => void;
}

/**
 * Microscopy, culture and sensitivity — the full urine/swab/stool workup.
 *
 * Each handler produces one complete next state. Nothing here batches two
 * edits into a single event, so a plain `onChange(next)` is enough; if that
 * ever changes, build the whole patch in one call rather than chaining.
 */
export default function McsEntryForm({ value: mcsState, onChange }: Props) {
  const noGrowth = isNoGrowth(mcsState.culture.growth);

  const updateMcsState = (section: 'macroscopy' | 'culture', field: string, val: string) => {
    onChange({
      ...mcsState,
      [section]: { ...mcsState[section], [field]: val },
    });
  };

  const updateMicroscopyRow = (index: number, field: 'parameter' | 'value', val: string) => {
    onChange({
      ...mcsState,
      microscopy: mcsState.microscopy.map((m, idx) => (idx === index ? { ...m, [field]: val } : m)),
    });
  };

  const addMicroscopyRow = () =>
    onChange({ ...mcsState, microscopy: [...mcsState.microscopy, { parameter: '', value: '' }] });

  const removeMicroscopyRow = (index: number) =>
    onChange({ ...mcsState, microscopy: mcsState.microscopy.filter((_, idx) => idx !== index) });

  const updateSensitivityResult = (index: number, result: McsFormState['sensitivity'][number]['result']) =>
    onChange({
      ...mcsState,
      sensitivity: mcsState.sensitivity.map((s, idx) => (idx === index ? { ...s, result } : s)),
    });

  // Changing the gram reaction swaps in the matching antibiotic panel, keeping
  // any result already scored against an antibiotic that appears in both.
  const handleGramReactionChange = (newGram: string) => {
    const panel =
      newGram === 'Gram Positive' ? GRAM_POSITIVE_ANTIBIOTICS
        : newGram === 'Gram Negative' ? GRAM_NEGATIVE_ANTIBIOTICS
          : null;

    onChange({
      ...mcsState,
      culture: { ...mcsState.culture, gramReaction: newGram },
      sensitivity: panel
        ? panel.map(g => ({
            ...g,
            result: mcsState.sensitivity.find(s => s.code === g.code)?.result ?? '',
          }))
        : [],
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.25rem' }}>
    {/* ROW 1: Macroscopy & Microscopy */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
      {/* ROW 1, COLUMN 1: Macroscopy */}
      <div style={cardStyle}>
        <h3 style={cardHeaderStyle}>Macroscopy</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1rem' }}>
          <div>
            <label style={labelStyle}>Colour</label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <select
                value={colourOptions.includes(mcsState.macroscopy.colour) ? mcsState.macroscopy.colour : 'Other...'}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'Other...') {
                    updateMcsState('macroscopy', 'colour', '');
                  } else {
                    updateMcsState('macroscopy', 'colour', val);
                  }
                }}
                style={inputStyle(false)}
                tabIndex={1}
              >
                <option value="">-- Select Colour --</option>
                {colourOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
                <option value="Other...">Other (Type custom)...</option>
              </select>
              {(!colourOptions.includes(mcsState.macroscopy.colour) || mcsState.macroscopy.colour === '') && (
                <input
                  value={mcsState.macroscopy.colour}
                  onChange={e => updateMcsState('macroscopy', 'colour', e.target.value)}
                  placeholder="Type custom colour..."
                  style={{ ...inputStyle(false), flex: 1.5 }}
                  tabIndex={2}
                />
              )}
            </div>
          </div>
        
          <div>
            <label style={labelStyle}>Appearance</label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <select
                value={appearanceOptions.includes(mcsState.macroscopy.appearance) ? mcsState.macroscopy.appearance : 'Other...'}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'Other...') {
                    updateMcsState('macroscopy', 'appearance', '');
                  } else {
                    updateMcsState('macroscopy', 'appearance', val);
                  }
                }}
                style={inputStyle(false)}
                tabIndex={3}
              >
                <option value="">-- Select Appearance --</option>
                {appearanceOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
                <option value="Other...">Other (Type custom)...</option>
              </select>
              {(!appearanceOptions.includes(mcsState.macroscopy.appearance) || mcsState.macroscopy.appearance === '') && (
                <input
                  value={mcsState.macroscopy.appearance}
                  onChange={e => updateMcsState('macroscopy', 'appearance', e.target.value)}
                  placeholder="Type custom appearance..."
                  style={{ ...inputStyle(false), flex: 1.5 }}
                  tabIndex={4}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    
      {/* ROW 1, COLUMN 2: Microscopy */}
      <div style={cardStyle}>
        <h3 style={cardHeaderStyle}>Microscopy</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
          <div style={{ overflowY: 'auto', maxHeight: '185px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--teal-50)' }}>
                  <th style={{ ...tableHeaderStyle, width: '55%' }}>Parameter</th>
                  <th style={tableHeaderStyle}>Value</th>
                  <th style={{ ...tableHeaderStyle, width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {mcsState.microscopy.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                    <td style={{ padding: '0.25rem 0.4rem' }}>
                      <select
                        value={microscopyDefaults.includes(m.parameter) ? m.parameter : 'Other...'}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'Other...') {
                            updateMicroscopyRow(idx, 'parameter', '');
                          } else {
                            updateMicroscopyRow(idx, 'parameter', val);
                          }
                        }}
                        style={inputStyle(false)}
                        tabIndex={10 + idx * 2}
                      >
                        <option value="">-- Select Parameter --</option>
                        {microscopyDefaults.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                        <option value="Other...">Other (Type)...</option>
                      </select>
                      {(!microscopyDefaults.includes(m.parameter) || m.parameter === '') && (
                        <input
                          value={m.parameter}
                          onChange={e => updateMicroscopyRow(idx, 'parameter', e.target.value)}
                          placeholder="Type parameter..."
                          style={{ ...inputStyle(false), marginTop: '0.2rem' }}
                        />
                      )}
                    </td>
                    <td style={{ padding: '0.25rem 0.4rem' }}>
                      <input
                        value={m.value}
                        onChange={e => updateMicroscopyRow(idx, 'value', e.target.value)}
                        placeholder="Value (e.g. 1-2/hpf)"
                        style={inputStyle(false)}
                        tabIndex={11 + idx * 2}
                      />
                    </td>
                    <td style={{ padding: '0.25rem 0.4rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => removeMicroscopyRow(idx)}
                        style={{ border: 'none', background: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '1.2rem', padding: '0.1rem 0.3rem' }}
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={addMicroscopyRow}
            style={{ ...btnStyle('outline'), alignSelf: 'flex-start', padding: '0.3rem 0.7rem', fontSize: '0.72rem' }}
          >
            + Add Parameter
          </button>
        </div>
      </div>
    </div>
  
    {/* ROW 2: Culture */}
    <div style={cardStyle}>
      <h3 style={cardHeaderStyle}>Culture Findings</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1rem' }}>
        <div>
          <label style={labelStyle}>Growth</label>
          <select
            value={growthOptions.includes(mcsState.culture.growth) ? mcsState.culture.growth : 'Other...'}
            onChange={e => {
              const val = e.target.value;
              if (val === 'Other...') {
                updateMcsState('culture', 'growth', '');
              } else {
                updateMcsState('culture', 'growth', val);
              }
            }}
            style={inputStyle(false)}
            tabIndex={50}
          >
            <option value="">-- Select Growth --</option>
            {growthOptions.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
            <option value="Other...">Other (Type custom)...</option>
          </select>
          {(!growthOptions.includes(mcsState.culture.growth) || mcsState.culture.growth === '') && (
            <input
              value={mcsState.culture.growth}
              onChange={e => updateMcsState('culture', 'growth', e.target.value)}
              placeholder="Type growth description..."
              style={{ ...inputStyle(false), marginTop: '0.25rem' }}
            />
          )}
        </div>
      
        {!noGrowth && (
          <>
            <div>
              <label style={labelStyle}>Organism Isolated</label>
              <input
                value={mcsState.culture.organism}
                onChange={e => updateMcsState('culture', 'organism', e.target.value)}
                placeholder="e.g. Staphylococcus aureus"
                style={inputStyle(false)}
                tabIndex={51}
              />
            </div>
          
            <div>
              <label style={labelStyle}>Degree</label>
              <select
                value={degreeOptions.includes(mcsState.culture.degree) ? mcsState.culture.degree : 'Other...'}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'Other...') {
                    updateMcsState('culture', 'degree', '');
                  } else {
                    updateMcsState('culture', 'degree', val);
                  }
                }}
                style={inputStyle(false)}
                tabIndex={52}
              >
                <option value="">-- Select Degree --</option>
                {degreeOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
                <option value="Other...">Other (Type custom)...</option>
              </select>
              {(!degreeOptions.includes(mcsState.culture.degree) || mcsState.culture.degree === '') && (
                <input
                  value={mcsState.culture.degree}
                  onChange={e => updateMcsState('culture', 'degree', e.target.value)}
                  placeholder="Type degree..."
                  style={{ ...inputStyle(false), marginTop: '0.25rem' }}
                />
              )}
            </div>
          
            <div>
              <label style={labelStyle}>Gram Reaction</label>
              <select
                value={mcsState.culture.gramReaction}
                onChange={e => handleGramReactionChange(e.target.value)}
                style={inputStyle(false)}
                tabIndex={53}
              >
                <option value="">-- Select Reaction --</option>
                <option value="Gram Positive">Gram Positive</option>
                <option value="Gram Negative">Gram Negative</option>
                <option value="Gram Variable">Gram Variable</option>
                <option value="Not Applicable">Not Applicable</option>
                <option value="Nil">Nil</option>
              </select>
            </div>
          
            <div>
              <label style={labelStyle}>Shape</label>
              <select
                value={shapeOptions.includes(mcsState.culture.shape) ? mcsState.culture.shape : 'Other...'}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'Other...') {
                    updateMcsState('culture', 'shape', '');
                  } else {
                    updateMcsState('culture', 'shape', val);
                  }
                }}
                style={inputStyle(false)}
                tabIndex={54}
              >
                <option value="">-- Select Shape --</option>
                {shapeOptions.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
                <option value="Other...">Other (Type custom)...</option>
              </select>
              {(!shapeOptions.includes(mcsState.culture.shape) || mcsState.culture.shape === '') && (
                <input
                  value={mcsState.culture.shape}
                  onChange={e => updateMcsState('culture', 'shape', e.target.value)}
                  placeholder="Type shape..."
                  style={{ ...inputStyle(false), marginTop: '0.25rem' }}
                />
              )}
            </div>
          
            <div>
              <label style={labelStyle}>Incubation Period</label>
              <input
                value={mcsState.culture.incubationPeriod}
                onChange={e => updateMcsState('culture', 'incubationPeriod', e.target.value)}
                placeholder="e.g. 24 hours"
                style={inputStyle(false)}
                tabIndex={55}
              />
            </div>
          
            <div>
              <label style={labelStyle}>Incubation Temp</label>
              <input
                value={mcsState.culture.incubationTemperature}
                onChange={e => updateMcsState('culture', 'incubationTemperature', e.target.value)}
                placeholder="e.g. 37°C"
                style={inputStyle(false)}
                tabIndex={56}
              />
            </div>
          </>
        )}
      </div>
    </div>
  
      {!noGrowth && (
        <SensitivityTable
          sensitivity={mcsState.sensitivity}
          gramReaction={mcsState.culture.gramReaction}
          onResult={updateSensitivityResult}
        />
      )}
    </div>
  );
}
