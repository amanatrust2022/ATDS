import type { CSSProperties } from 'react';

/** Shared look for the MCS workup cards, so the form and the antibiogram match. */

export const cardStyle: CSSProperties = {
  background: 'white',
  border: '1px solid var(--gray-300)',
  borderRadius: 'var(--radius-lg)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--shadow-sm)'
};

export const cardHeaderStyle: CSSProperties = {
  background: 'var(--teal-50)',
  color: 'var(--teal-800)',
  fontSize: '0.8rem',
  fontWeight: 700,
  padding: '0.6rem 1rem',
  borderBottom: '1px solid var(--teal-200)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

export const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: 'var(--gray-700)',
  marginBottom: '0.25rem',
  textTransform: 'uppercase'
};

export const tableHeaderStyle: CSSProperties = {
  padding: '0.5rem 0.5rem',
  textAlign: 'left',
  fontWeight: 700,
  color: 'var(--teal-800)',
  borderBottom: '2px solid var(--teal-200)',
  fontSize: '0.72rem'
};

export const inputStyle = (hasError: boolean): CSSProperties => ({
  width: '100%',
  padding: '0.45rem 0.65rem',
  border: `1px solid ${hasError ? 'var(--red)' : 'var(--gray-300)'}`,
  borderRadius: 'var(--radius)',
  fontSize: '0.8rem',
  color: 'var(--gray-900)',
  background: 'white',
  outline: 'none',
  fontFamily: 'var(--font-body)',
});

export const btnStyle = (variant: 'primary' | 'outline'): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.5rem 1rem',
  borderRadius: 'var(--radius)',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: variant === 'primary' ? 'none' : '1px solid var(--gray-300)',
  background: variant === 'primary' ? 'var(--teal-700)' : 'white',
  color: variant === 'primary' ? 'white' : 'var(--gray-700)',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
});

/** The radiology forms use the same field look without the error state. */
export const plainInputStyle: CSSProperties = inputStyle(false);
