import React from 'react';

export const inputStyle = (error?: boolean): React.CSSProperties => ({
  width: '100%', padding: '0.65rem 1rem', borderRadius: 'var(--radius)',
  border: error ? '1px solid var(--red)' : '1px solid var(--gray-300)',
  fontSize: '0.82rem', fontFamily: 'var(--font-sans)', outline: 'none'
});

export const btnStyle = (variant: 'primary' | 'outline'): React.CSSProperties => ({
  padding: '0.55rem 1.1rem', borderRadius: 'var(--radius)', fontSize: '0.8rem',
  fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
  border: variant === 'primary' ? 'none' : '1px solid var(--gray-300)',
  background: variant === 'primary' ? 'var(--teal-700)' : 'white',
  color: variant === 'primary' ? 'white' : 'var(--gray-700)',
});

export const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '1rem',
};

export const modalBox: React.CSSProperties = {
  background: 'white', borderRadius: 'var(--radius-lg)',
  width: '100%', boxShadow: 'var(--shadow-lg)',
  overflow: 'hidden', animation: 'fadeIn 0.2s ease',
};

export const closeBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none',
  padding: '0.4rem', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex',
};

export const dropItemStyle: React.CSSProperties = {
  padding: '0.65rem 1rem', cursor: 'pointer',
  borderBottom: '1px solid var(--gray-100)', transition: 'background 0.15s',
};

export const panelStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.96)', borderRadius: 'var(--radius-lg)',
  border: '1px solid rgba(148,163,184,0.22)', overflow: 'hidden',
  boxShadow: '0 18px 40px -28px rgba(15,23,42,0.35)',
};
