import React, { useEffect, useState } from 'react';
import { RiSearchLine, RiCloseLine, RiUserFollowLine } from '@remixicon/react';
import { PatientProfile } from '@/lib/store';
import { Button, Field, Input } from '@/components/ui';

import styles from './patientLookup.module.css';

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
  const shown = matches.slice(0, 10);
  const expanded = showDrop && query.trim().length > 0;

  const [active, setActive] = useState(0);

  // The highlight belongs to the search that produced it.
  useEffect(() => {
    setActive(0);
  }, [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDrop(false);
      return;
    }
    if (!expanded || shown.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => (i + 1) % shown.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => (i - 1 + shown.length) % shown.length);
    } else if (e.key === 'Enter') {
      // Enter inside the registration form would otherwise submit it, with
      // whatever half-filled state the desk had reached.
      e.preventDefault();
      const pick = shown[active];
      if (pick) onSelectProfile(pick);
    }
  };

  return (
    <>
      <div ref={containerRef} className={styles.panel}>
        <Field label="Returning patient lookup">
          <div className={styles.box}>
            <Input
              role="combobox"
              aria-expanded={expanded}
              aria-controls="patient-lookup-results"
              aria-autocomplete="list"
              prefix={<RiSearchLine size={14} />}
              className={query ? styles.withClear : undefined}
              placeholder="Search by name, phone, or slip number..."
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setShowDrop(true);
              }}
              onFocus={() => setShowDrop(true)}
              onKeyDown={onKeyDown}
            />
            {query && (
              <button
                type="button"
                className={styles.clear}
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  setShowDrop(false);
                }}
              >
                <RiCloseLine size={16} aria-hidden="true" />
              </button>
            )}

            {expanded && (
              <div className={styles.results}>
                <ul
                  id="patient-lookup-results"
                  role="listbox"
                  aria-label="Matching patient profiles"
                  className={styles.resultList}
                >
                  {shown.map((p, i) => (
                    <li key={p.id} role="option" aria-selected={i === active}>
                      <button
                        type="button"
                        className={[styles.result, i === active ? styles.resultActive : '']
                          .filter(Boolean)
                          .join(' ')}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => onSelectProfile(p)}
                      >
                        <span className={styles.resultName}>
                          {[p.firstName, p.middleName, p.surname].filter(Boolean).join(' ')}
                        </span>
                        <span className={styles.resultMeta}>
                          {p.phone} • {p.sex} • Patient ID: {p.id}
                        </span>
                      </button>
                    </li>
                  ))}
                  {matches.length === 0 && (
                    <li className={styles.resultEmpty}>No matching patient profiles found.</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </Field>
      </div>

      {loadedPatientName && (
        <div className={styles.loaded}>
          <span className={styles.loadedMark}>
            <RiUserFollowLine size={14} aria-hidden="true" />
            <span>
              Loaded returning patient: <b>{loadedPatientName}</b> (Patient ID: {selectedPatientProfileId})
            </span>
          </span>
          <Button size="sm" intent="dangerQuiet" onClick={onClear}>
            Clear / Register New
          </Button>
        </div>
      )}
    </>
  );
}
