'use client';

import { useId, useState } from 'react';

import { Field, Input, Select } from '@/components/ui';

import styles from './entryForm.module.css';

/**
 * A reading picked from a standard list, or typed when the plate does not
 * match one.
 *
 * Every dropdown in the workup did this by hand, with the same defect in each:
 *
 *   value={options.includes(current) ? current : 'Other...'}
 *
 * An empty string is not in the options either, so a reading nobody had taken
 * yet displayed as "Other (Type custom)" — and the "-- Select --" placeholder
 * the markup carried could never be shown. Opening a result that had not been
 * filled in showed "Other" selected on every dropdown in the form, on a
 * document a doctor prescribes from.
 *
 * Here, empty means empty. "Other" is a state the user enters deliberately,
 * and is remembered while the box beside it is still blank.
 */
const OTHER = '__other__';

export function ChoiceField({
  label,
  options,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
  /** Placeholder for the free-text box, e.g. "Type the colour". */
  placeholder: string;
  hint?: string;
}) {
  // A typed value that is not on the list is self-evidently "Other". A blank
  // one is only "Other" if the user just chose it and has yet to type.
  const typed = value !== '' && !options.includes(value);
  const [chosenOther, setChosenOther] = useState(false);
  const showCustom = typed || chosenOther;

  const customId = useId();

  return (
    <Field label={label} hint={hint}>
      <Select
        value={showCustom ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setChosenOther(true);
            onChange('');
          } else {
            setChosenOther(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">Not recorded</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={OTHER}>Something else…</option>
      </Select>

      {showCustom && (
        <div className={styles['custom']}>
          <label className="sr-only" htmlFor={customId}>
            {placeholder}
          </label>
          <Input
            id={customId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        </div>
      )}
    </Field>
  );
}
