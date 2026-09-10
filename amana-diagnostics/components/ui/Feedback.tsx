'use client';

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';
import styles from './Feedback.module.css';

/**
 * Loading, empty and error states.
 *
 * The app had zero skeletons, zero Suspense boundaries and zero error
 * boundaries, so every screen showed a centred spinner while it waited and
 * took the whole tree down when anything threw.
 */

/* ========================================================================
 * Alert
 * ==================================================================== */

export type AlertTone = 'info' | 'success' | 'warning' | 'critical';

const ALERT_MARK: Record<AlertTone, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  critical: '!',
};

/** What the tone means, for anyone who cannot see the colour. */
const ALERT_ROLE: Record<AlertTone, string> = {
  info: 'Note',
  success: 'Success',
  warning: 'Warning',
  critical: 'Error',
};

export function Alert({
  tone = 'info',
  title,
  children,
  actions,
  /** Announce it when it appears. Use for anything the user did not expect. */
  live = false,
}: {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  live?: boolean;
}) {
  const toneClass = {
    info: styles['alertInfo'],
    success: styles['alertSuccess'],
    warning: styles['alertWarning'],
    critical: styles['alertCritical'],
  }[tone];

  return (
    <div
      className={[styles['alert'], toneClass].join(' ')}
      role={live ? (tone === 'critical' ? 'alert' : 'status') : undefined}
    >
      <span className={styles['alertMark']} aria-hidden="true">
        {ALERT_MARK[tone]}
      </span>
      <div className={styles['alertBody']}>
        <span className="sr-only">{ALERT_ROLE[tone]}: </span>
        {title && <div className={styles['alertTitle']}>{title}</div>}
        <div className={styles['alertText']}>{children}</div>
        {actions && <div className={styles['alertActions']}>{actions}</div>}
      </div>
    </div>
  );
}

/* ========================================================================
 * Skeleton
 * ==================================================================== */

export function Skeleton({
  width,
  height,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  return (
    <span
      className={[styles['skeleton'], className ?? ''].filter(Boolean).join(' ')}
      style={{ width: width ?? '100%', height: height ?? '1em' }}
      aria-hidden="true"
    />
  );
}

/** Placeholder lines. The last one is short, the way real paragraphs end. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <span className={styles['skeletonStack']} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className={[styles['skeleton'], styles['skeletonText']].join(' ')}
          style={{ width: i === lines - 1 ? '55%' : '100%' }}
        />
      ))}
    </span>
  );
}

/**
 * Rows shaped like the table that is loading. `columns` takes flex weights,
 * so the placeholder columns line up with the real ones.
 */
export function SkeletonRows({
  rows = 5,
  columns = [3, 2, 2, 1],
}: {
  rows?: number;
  columns?: number[];
}) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className={styles['skeletonRow']} aria-hidden="true">
          {columns.map((weight, c) => (
            <span
              key={c}
              className={styles['skeleton']}
              style={{ flex: weight, height: '0.85em' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ========================================================================
 * Empty state
 * ==================================================================== */

/**
 * An empty list is not an error, and it is not nothing. It says what would
 * be here and what to do to put something here.
 */
export function EmptyState({
  title,
  children,
  icon,
  action,
  compact = false,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={[styles['empty'], compact ? styles['emptyCompact'] : '']
        .filter(Boolean)
        .join(' ')}
    >
      {icon && (
        <span className={styles['emptyIcon']} aria-hidden="true">
          {icon}
        </span>
      )}
      <p className={styles['emptyTitle']}>{title}</p>
      {children && <p className={styles['emptyText']}>{children}</p>}
      {action && <div className={styles['emptyAction']}>{action}</div>}
    </div>
  );
}

/* ========================================================================
 * Spinner
 * ==================================================================== */

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className={styles['spinner']}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

/** For a whole panel that has nothing to show a skeleton of yet. */
export function LoadingPanel({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles['centred']} role="status" aria-live="polite">
      <Spinner size={28} />
      <span>{label}</span>
    </div>
  );
}

/* ========================================================================
 * Error boundary
 * ==================================================================== */

interface BoundaryProps {
  children: ReactNode;
  /** Names the area, so the message can say what stopped working. */
  area?: string;
  /** Called on catch — wire this to logging when there is somewhere to log. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface BoundaryState {
  error: Error | null;
}

/**
 * Keeps one failure inside one region.
 *
 * With no boundary anywhere, a single throw in the wallet ledger blanked the
 * whole reception screen — including the queue a receptionist needed to keep
 * working from. Wrap each independent region, not the app.
 */
export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.area ?? 'unknown area', error, info);
    this.props.onError?.(error, info);
  }

  private reset = () => this.setState({ error: null });

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const area = this.props.area ? `The ${this.props.area}` : 'This part of the page';

    return (
      <div className={styles['crash']} role="alert">
        <p className={styles['crashTitle']}>{area} stopped working</p>
        <p className={styles['crashText']}>
          Nothing you entered elsewhere on this screen has been lost. Try again — if it
          keeps happening, reload the page and tell your administrator what you were
          doing at the time.
        </p>
        <pre className={styles['crashDetail']}>{error.message}</pre>
        <Button intent="secondary" size="sm" onClick={this.reset}>
          Try again
        </Button>
      </div>
    );
  }
}
