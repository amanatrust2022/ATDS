import React from 'react';
import { RiSearchLine, RiCloseLine } from '@remixicon/react';
import { PatientProfile } from '@/lib/store';
import { inputStyle, dropItemStyle } from './styles';

interface PatientLookupProps {
  patientProfiles: PatientProfile[];
  query: string;
  setQuery: (q: string) => void;
  showDrop: boolean;
  setShowDrop: (show: boolean) => void;
  loadedPatientName: string;
  selectedPatientProfileId: number | null;
  onSelectProfile: (profile: PatientProfile) => void;
  onClear: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/** Returns the profiles matching a lookup query by name or phone. */
export const matchPatientProfiles = (profiles: PatientProfile[], query: string): PatientProfile[] => {
  const q = query.toLowerCase();
  return profiles.filter(p => {
    const fullName = `${p.firstName || ''} ${p.middleName || ''} ${p.surname || ''}`.toLowerCase();
    return fullName.includes(q) || (p.phone || '').includes(q);
  });
};

export default function PatientLookup({
  patientProfiles, query, setQuery, showDrop, setShowDrop,
  loadedPatientName, selectedPatientProfileId, onSelectProfile, onClear, containerRef,
}: PatientLookupProps) {
  const matches = matchPatientProfiles(patientProfiles, query);

  return (
    <>
      <div ref={containerRef} style={{ background: '#f0fdfa', border: '1px dashed var(--teal-200)', padding: '0.75rem', borderRadius: 'var(--radius)', position: 'relative' }}>
        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--teal-800)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Returning Patient Lookup
        </label>
        <div style={{ position: 'relative' }}>
          <RiSearchLine size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--teal-600)' }} />
          <input
            style={{ ...inputStyle(false), paddingLeft: 30, borderColor: 'var(--teal-200)' }}
            placeholder="Search by name, phone, or slip number..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setShowDrop(true);
            }}
            onFocus={() => setShowDrop(true)}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setShowDrop(false);
              }}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex' }}
            >
              <RiCloseLine size={16} />
            </button>
          )}
        </div>

        {showDrop && query.trim().length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--gray-300)', zIndex: 60, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: 'var(--radius)', marginTop: '0.25rem' }}>
            {matches.slice(0, 10).map(p => (
              <div
                key={p.id}
                onClick={() => onSelectProfile(p)}
                style={dropItemStyle}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--teal-50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--gray-900)' }}>
                      {p.firstName} {p.middleName} {p.surname}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--gray-500)' }}>
                      {p.phone} • {p.sex} • Patient ID: {p.id}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {matches.length === 0 && (
              <div style={{ padding: '0.75rem', color: 'var(--gray-400)', fontSize: '0.75rem', textAlign: 'center' }}>
                No matching patient profiles found.
              </div>
            )}
          </div>
        )}
      </div>

      {loadedPatientName && (
        <div style={{ background: 'var(--teal-50)', border: '1px solid var(--teal-200)', padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--teal-800)', borderRadius: 'var(--radius)' }}>
          <span>Loaded returning patient: <b>{loadedPatientName}</b> (Patient ID: {selectedPatientProfileId})</span>
          <button
            onClick={onClear}
            style={{ background: 'none', border: 'none', color: 'var(--red)', fontWeight: 600, cursor: 'pointer' }}
          >
            Clear / Register New
          </button>
        </div>
      )}
    </>
  );
}
