'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

/**
 * The app had 264 buttons, each styled inline, with hover simulated by 42
 * onMouseOver handlers — which never fire for a keyboard user, so a focused
 * button gave no feedback at all. This is that button, once.
 *
 * `loading` disables the control and swaps the label for a spinner while
 * keeping the label's width, so a row of buttons does not reflow on save.
 * An icon-only button must carry a label for screen readers; the types make
 * that non-optional rather than a review comment.
 */

export type ButtonIntent =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'dangerQuiet'
  | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg';

type BaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  intent?: ButtonIntent;
  size?: ButtonSize;
  /** Shown before the label. Decorative — it is hidden from screen readers. */
  icon?: ReactNode;
  /** Shown after the label, for disclosure chevrons and the like. */
  iconAfter?: ReactNode;
  fullWidth?: boolean;
  /** Disables the button and shows a spinner in place of the label. */
  loading?: boolean;
  /** Escape hatch for layout only — never for colour, size or spacing. */
  className?: string;
};

/** With children, an accessible name comes from the text. */
type WithChildren = BaseProps & { children: ReactNode; 'aria-label'?: string };

/** Without children there is no text, so a label has to be supplied. */
type IconOnly = BaseProps & { children?: undefined; 'aria-label': string };

export type ButtonProps = WithChildren | IconOnly;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    intent = 'secondary',
    size = 'md',
    icon,
    iconAfter,
    fullWidth,
    loading = false,
    disabled,
    children,
    className,
    type = 'button',
    ...rest
  },
  ref,
) {
  const iconOnly = children == null;

  const classes = [
    styles['button'],
    styles[intent],
    styles[size],
    fullWidth ? styles['fullWidth'] : '',
    iconOnly ? styles['iconOnly'] : '',
    loading ? styles['isLoading'] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      // A screen reader should hear that the button is working, not silence.
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span className={styles['spinner']} aria-hidden="true">
          <span className={styles['spinnerDot']} />
        </span>
      )}
      <span className={styles['label']} style={labelStyle}>
        {icon && <span aria-hidden="true" style={iconStyle}>{icon}</span>}
        {children}
        {iconAfter && <span aria-hidden="true" style={iconStyle}>{iconAfter}</span>}
      </span>
    </button>
  );
});

/* These two are layout-only and identical everywhere, so they stay inline
 * rather than earning class names of their own. */
const labelStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
} as const;

const iconStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
} as const;

/**
 * Buttons that act on the same object, sat flush against one another.
 * Use it for "Save / Save and print", not for unrelated actions.
 */
export function ButtonGroup({
  children,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  'aria-label': string;
}) {
  return (
    <div className={styles['group']} role="group" aria-label={ariaLabel}>
      {children}
    </div>
  );
}
