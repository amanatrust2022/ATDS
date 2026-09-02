'use client';
import type { RadiologyFormState } from '@/lib/radiology-templates';
import { estimateGestationalAge, applyObstetricEstimate } from '@/lib/store/obstetrics';
import { labelStyle, plainInputStyle } from './entryFormStyles';

interface Props {
  value: RadiologyFormState;
  onChange: (next: RadiologyFormState) => void;
}

const purpleLabel: React.CSSProperties = { ...labelStyle, color: '#6b21a8' };

const selectOptions: Record<string, { label: string; options: [string, string][] }> = {
  presentation: {
    label: 'Presentation',
    options: [['Cephalic', 'Cephalic'], ['Breech', 'Breech'], ['Transverse', 'Transverse'], ['Mobile', 'Mobile']],
  },
  placenta: {
    label: 'Placenta',
    options: [
      ['POSTERIOR', 'Posterior'], ['ANTERIOR', 'Anterior'], ['FUNDAL', 'Fundal'],
      ['LOW LYING', 'Low Lying'], ['PLACENTA PREVIA', 'Placenta Previa'],
    ],
  },
  afi: {
    label: 'Amniotic Fluid (AFI)',
    options: [['ADEQUATE', 'Adequate'], ['OLIGOHYDRAMNIOS', 'Oligohydramnios'], ['POLYHYDRAMNIOS', 'Polyhydramnios']],
  },
};

export default function ObstetricsCalculator({ value, onChange }: Props) {
  const setMeasurement = (field: string, val: string) =>
    onChange({ ...value, measurements: { ...value.measurements, [field]: val } });

  const estimate = estimateGestationalAge(value.measurements);

  const numberField = (field: 'bpd' | 'fl' | 'crl' | 'fhr', label: string, hint: string) => (
    <div>
      <label style={purpleLabel}>{label}</label>
      <input
        type="number"
        placeholder={hint}
        value={value.measurements[field] || ''}
        onChange={e => setMeasurement(field, e.target.value)}
        style={plainInputStyle}
      />
    </div>
  );

  const selectField = (field: 'presentation' | 'placenta' | 'afi') => {
    const { label, options } = selectOptions[field];
    return (
      <div>
        <label style={purpleLabel}>{label}</label>
        <select
          value={value.measurements[field] || ''}
          onChange={e => setMeasurement(field, e.target.value)}
          style={plainInputStyle}
        >
          <option value="">-- Select --</option>
          {options.map(([val, text]) => (
            <option key={val} value={val}>{text}</option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div style={{
      background: '#faf5ff', border: '1px solid #e9d5ff',
      borderRadius: 'var(--radius-lg)', padding: '1rem',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
        Obstetrics Calculator (Hadlock Fit)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
        {numberField('bpd', 'BPD (mm)', 'e.g. 35')}
        {numberField('fl', 'FL (mm)', 'e.g. 24')}
        {numberField('crl', 'CRL (mm)', 'e.g. 50')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
        {numberField('fhr', 'FHR (bpm)', 'e.g. 140')}
        {selectField('presentation')}
        {selectField('placenta')}
        {selectField('afi')}
      </div>

      {estimate ? (
        <div style={{
          background: 'white', padding: '0.75rem',
          borderRadius: 'var(--radius)', border: '1px solid #d8b4fe',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#4b5563', fontWeight: 500 }}>GA Estimate: </span>
            <span style={{ fontSize: '0.9rem', color: '#6b21a8', fontWeight: 700 }}>
              {estimate.weeks} Weeks {estimate.days} Day(s)
            </span>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginLeft: '1rem' }}>|</span>
            <span style={{ fontSize: '0.8rem', color: '#4b5563', fontWeight: 500, marginLeft: '1rem' }}>EDD: </span>
            <span style={{ fontSize: '0.9rem', color: '#6b21a8', fontWeight: 700 }}>{estimate.edd}</span>
          </div>
          <button
            onClick={() => onChange(applyObstetricEstimate(value, estimate))}
            style={{
              background: '#7c3aed', color: 'white', border: 'none',
              padding: '0.4rem 0.8rem', borderRadius: 'var(--radius)',
              fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer'
            }}
          >
            Apply &amp; Insert into Report
          </button>
        </div>
      ) : (
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>
          Enter BPD, FL, or CRL to calculate gestational age and delivery date.
        </div>
      )}
    </div>
  );
}
