'use client';

import { createContext, forwardRef, useContext, useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import styles from './Field.module.css';

/**
 * The form layer.
 *
 * Across 192 inputs and 56 selects the app had four label associations, no
 * aria-invalid, no aria-describedby, and errors rendered as loose red text
 * that a screen reader never connected to the control it described.
 *
 * `Field` fixes that structurally rather than by review. It mints one id,
 * hands it to the control, and points aria-describedby at whichever of the
 * hint and error are actually present. A control inside a Field cannot be
 * unlabelled, because the label is the Field's own prop.
 *
 *   <Field label="Surname" error={errors.surname} required>
 *     <Input value={v} onChange={...} />
 *   </Field>
 */

interface FieldContextValue {
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Lets a control pick up the ids its Field minted. */
function useFieldControl() {
  return useContext(FieldContext);
}

export interface FieldProps {
  label: string;
  children: ReactNode;
  /** Guidance shown before the user gets it wrong. */
  hint?: string;
  /** What went wrong. Its presence is what marks the control invalid. */
  error?: string | null | undefined;
  required?: boolean;
  /** Marks the field "optional" in the label. Use on mostly-required forms. */
  optional?: boolean;
  /** A control that sits beside the label, e.g. "Use today's date". */
  action?: ReactNode;
  /** Hides the label visually but keeps it for screen readers. */
  labelHidden?: boolean;
  className?: string;
}

export function Field({
  label,
  children,
  hint,
  error,
  required = false,
  optional = false,
  action,
  labelHidden = false,
  className,
}: FieldProps) {
  const base = useId();
  const controlId = `${base}-control`;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;

  const invalid = Boolean(error);

  // Point at whichever of the two exist. An empty string here would make the
  // control claim to be described by an element that is not on the page.
  const describedBy =
    [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ controlId, describedBy, invalid, required }}>
      <div className={[styles['field'], className ?? ''].filter(Boolean).join(' ')}>
        <div className={styles['labelRow']}>
          <label
            htmlFor={controlId}
            className={labelHidden ? 'sr-only' : styles['label']}
          >
            {label}
            {required && (
              <span className={styles['required']} aria-hidden="true">
                *
              </span>
            )}
            {required && <span className="sr-only"> (required)</span>}
            {optional && !required && (
              <span className={styles['optional']}> (optional)</span>
            )}
          </label>
          {action}
        </div>

        {hint && (
          <p id={hintId} className={styles['hint']}>
            {hint}
          </p>
        )}

        {children}

        {/* role="alert" so the message is announced when it appears, not only
         * when the control is next focused. */}
        {invalid && (
          <p id={errorId} className={styles['error']} role="alert">
            <span className={styles['errorMark']} aria-hidden="true">
              !
            </span>
            <span>{error}</span>
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

/* ========================================================================
 * Controls
 * ==================================================================== */

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  /** Shown inside the control's left edge — a currency mark, a search icon. */
  prefix?: ReactNode;
  /** Shown inside the right edge — a unit, a clear button. */
  suffix?: ReactNode;
  /** Right-aligns and tabularises the figures, for money and counts. */
  numeric?: boolean;
  className?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { prefix, suffix, numeric, className, ...rest },
  ref,
) {
  const field = useFieldControl();

  const control = (
    <input
      ref={ref}
      id={rest.id ?? field?.controlId}
      aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      required={rest.required ?? field?.required}
      className={[
        styles['control'],
        field?.invalid ? styles['invalid'] : '',
        numeric ? styles['numeric'] : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );

  if (!prefix && !suffix) return control;

  return (
    <div
      className={[
        styles['wrap'],
        prefix ? styles['hasPrefix'] : '',
        suffix ? styles['hasSuffix'] : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {prefix && (
        <span className={styles['prefix']} aria-hidden="true">
          {prefix}
        </span>
      )}
      {control}
      {suffix && (
        <span className={styles['suffix']} aria-hidden="true">
          {suffix}
        </span>
      )}
    </div>
  );
});

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & {
  className?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 4, ...rest },
  ref,
) {
  const field = useFieldControl();
  return (
    <textarea
      ref={ref}
      rows={rows}
      id={rest.id ?? field?.controlId}
      aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      required={rest.required ?? field?.required}
      className={[
        styles['control'],
        styles['textarea'],
        field?.invalid ? styles['invalid'] : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  );
});

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  /** Shown as a disabled first option, so the empty state reads as a prompt. */
  placeholder?: string;
  className?: string;
  children: ReactNode;
};

/**
 * The native select, styled. It is deliberately not a Radix Select: on a
 * clinic tablet the OS picker is faster, more familiar and works offline.
 * Reach for Combobox when the list needs search or free text.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { placeholder, className, children, ...rest },
  ref,
) {
  const field = useFieldControl();
  return (
    <select
      ref={ref}
      id={rest.id ?? field?.controlId}
      aria-describedby={rest['aria-describedby'] ?? field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      required={rest.required ?? field?.required}
      className={[
        styles['control'],
        styles['select'],
        field?.invalid ? styles['invalid'] : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {children}
    </select>
  );
});

/* ========================================================================
 * Choice controls
 * ==================================================================== */

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  hint?: string;
}

function Choice({ label, hint, type, ...rest }: ChoiceProps & { type: 'checkbox' | 'radio' }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <label className={styles['choice']} htmlFor={rest.id ?? id}>
      <input type={type} id={rest.id ?? id} aria-describedby={hintId} {...rest} />
      <span>
        <span className={styles['choiceLabel']}>{label}</span>
        {hint && (
          <span id={hintId} className={styles['choiceHint']}>
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}

export function Checkbox(props: ChoiceProps) {
  return <Choice {...props} type="checkbox" />;
}

export function Radio(props: ChoiceProps) {
  return <Choice {...props} type="radio" />;
}

/**
 * A set of related controls with one shared label — a radio group, a row of
 * checkboxes. Uses a real fieldset so the legend is announced with each
 * option rather than being visual-only.
 */
export function FieldSet({
  legend,
  children,
  className,
}: {
  legend: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={[styles['fieldset'], className ?? ''].filter(Boolean).join(' ')}>
      <legend className={styles['legend']}>{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Fields laid out side by side, collapsing to one column when narrow. */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className={styles['row']}>{children}</div>;
}
