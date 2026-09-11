'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RiSearchLine } from '@remixicon/react';

import { Button, Field, Input } from '@/components/ui';
import type { Patient } from '@/lib/store';

import styles from './billingAccount.module.css';

const PAGE_SIZE = 5;

function fullName(p: Patient): string {
  return [p.firstName, p.middleName, p.surname].filter(Boolean).join(' ');
}

/**
 * Choosing the patient a wallet belongs to.
 *
 * A select is no use here — this list is every patient the centre has ever
 * registered — so it stays a search. What changed is that the results used to
 * be `<div onClick>`: not reachable by keyboard, not announced as a list, and
 * invisible to anything but a mouse. They are a listbox of buttons now, with
 * arrow keys and Escape.
 */
export function OwnerPicker({
  patients,
  query,
  onQueryChange,
  page,
  onPageChange,
  open,
  onOpenChange,
  selectedId,
  onSelect,
  onClear,
  error,
}: {
  patients: Patient[];
  query: string;
  onQueryChange: (q: string) => void;
  page: number;
  onPageChange: (p: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string;
  onSelect: (patient: Patient) => void;
  onClear: () => void;
  error?: string | undefined;
}) {
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return patients.filter(
      (p) => fullName(p).toLowerCase().includes(q) || (p.phone || '').includes(q),
    );
  }, [patients, query]);

  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const shown = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const expanded = open && query.trim().length > 0;

  // The highlight belongs to the page being looked at, not to the search.
  useEffect(() => {
    setActive(0);
  }, [query, page]);

  // Clicking away closes it. Without this the list stayed over the fields
  // below until something else was typed.
  useEffect(() => {
    if (!expanded) return;
    const onDocDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [expanded, onOpenChange]);

  const selected = selectedId
    ? patients.find((p) => String(p.id) === String(selectedId))
    : undefined;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onOpenChange(false);
      return;
    }
    if (!expanded || shown.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % shown.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + shown.length) % shown.length);
    } else if (e.key === 'Enter') {
      // Enter inside a form would otherwise submit it — opening an account
      // with whatever half-filled state the desk had reached.
      e.preventDefault();
      const pick = shown[active];
      if (pick) onSelect(pick);
    }
  };

  return (
    <Field label="Account owner" required error={error} hint="The patient the wallet belongs to.">
      <div ref={boxRef} className={styles['picker']}>
        <Input
          role="combobox"
          aria-expanded={expanded}
          aria-controls="owner-results"
          aria-autocomplete="list"
          prefix={<RiSearchLine size={14} />}
          placeholder="Search patient by name or phone…"
          value={query}
          // Deliberately not required, though the field is. This box holds the
          // search, not the answer — the answer is the patient already chosen
          // below it, and choosing one clears the box. Marking it required
          // would have the browser refuse to submit a form that is complete.
          required={false}
          onChange={(e) => {
            onQueryChange(e.target.value);
            onPageChange(0);
            onOpenChange(true);
          }}
          onFocus={() => onOpenChange(true)}
          onKeyDown={onKeyDown}
        />

        {selected && (
          <p className={styles['chosen']}>
            <span>
              Selected owner: <b>{fullName(selected)}</b>
              {selected.phone ? ` (${selected.phone})` : ''}
            </span>
            <Button size="sm" intent="dangerQuiet" onClick={onClear}>
              Remove
            </Button>
          </p>
        )}

        {expanded && (
          <div className={styles['results']}>
            <ul id="owner-results" role="listbox" aria-label="Matching patients" className={styles['resultList']}>
              {shown.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    className={[styles['result'], i === active ? styles['resultActive'] : '']
                      .filter(Boolean)
                      .join(' ')}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => onSelect(p)}
                  >
                    <span className={styles['resultName']}>{fullName(p)}</span>
                    <span className={styles['resultMeta']}>
                      {p.phone || 'no phone'} · Slip {p.slipNumber}
                    </span>
                  </button>
                </li>
              ))}
              {matches.length === 0 && (
                <li className={styles['resultEmpty']}>No patients found.</li>
              )}
            </ul>

            {totalPages > 1 && (
              <div className={styles['pager']}>
                <Button
                  size="sm"
                  type="button"
                  disabled={page === 0}
                  onClick={() => onPageChange(Math.max(0, page - 1))}
                >
                  Previous
                </Button>
                <span>
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  size="sm"
                  type="button"
                  disabled={page >= totalPages - 1}
                  onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}
