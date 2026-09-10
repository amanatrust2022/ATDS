'use client';

import type { ReactNode } from 'react';
import styles from './Surface.module.css';

/**
 * Containers: cards, description lists and tables.
 *
 * Not everything is a card. Border, fill and shadow each say "separate
 * object", so `raised` is for the one panel that needs lifting out of a set
 * rather than the default for all of them.
 */

/* ========================================================================
 * Card
 * ==================================================================== */

export function Card({
  children,
  raised = false,
  className,
  as: Tag = 'section',
  ...rest
}: {
  children: ReactNode;
  raised?: boolean;
  className?: string;
  as?: 'section' | 'div' | 'article';
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  return (
    <Tag
      className={[styles['card'], raised ? styles['raised'] : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  id,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <header className={styles['cardHeader']}>
      <div>
        <h2 className={styles['cardTitle']} id={id}>
          {title}
        </h2>
        {subtitle && <p className={styles['cardSubtitle']}>{subtitle}</p>}
      </div>
      {actions && <div className={styles['cardActions']}>{actions}</div>}
    </header>
  );
}

export function CardBody({
  children,
  flush = false,
}: {
  children: ReactNode;
  /** Drops the padding — for a table or list that runs edge to edge. */
  flush?: boolean;
}) {
  return (
    <div className={flush ? styles['cardBodyFlush'] : styles['cardBody']}>{children}</div>
  );
}

export function CardFooter({ children }: { children: ReactNode }) {
  return <footer className={styles['cardFooter']}>{children}</footer>;
}

/* ========================================================================
 * Description list
 * ==================================================================== */

export interface DescriptionItem {
  label: string;
  value: ReactNode;
}

/**
 * Label/value pairs — patient details, an invoice summary. A real <dl>, so
 * the pairing is in the markup rather than only in the visual alignment.
 */
export function DescriptionList({ items }: { items: DescriptionItem[] }) {
  return (
    <dl className={styles['dl']}>
      {items.map((item) => (
        <div key={item.label} style={contents}>
          <dt className={styles['dt']}>{item.label}</dt>
          <dd className={styles['dd']}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* `display: contents` lets the wrapper group each pair for React's key
 * without breaking the grid the dl lays its columns out on. */
const contents = { display: 'contents' } as const;

/* ========================================================================
 * Table
 * ==================================================================== */

export type SortDirection = 'asc' | 'desc';

export interface TableColumn<Row> {
  /** Stable key. Also the sort key when the column is sortable. */
  key: string;
  header: ReactNode;
  render: (row: Row, index: number) => ReactNode;
  /** Right-aligns and tabularises. Use for money, counts and dates. */
  numeric?: boolean;
  /** Pins to the right and shrinks to content — for a row's buttons. */
  actions?: boolean;
  sortable?: boolean;
  /** Announced instead of `header` when the header is an icon or a symbol. */
  headerLabel?: string;
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  /** Names the table for screen readers, and shows above it if `showCaption`. */
  caption: string;
  showCaption?: boolean;
  onRowClick?: (row: Row) => void;
  /** Marks a row as chosen — an inset edge plus a tint, not a tint alone. */
  isRowSelected?: (row: Row) => boolean;
  /** Marks a row as needing attention, with its own edge colour. */
  isRowCritical?: (row: Row) => boolean;
  sort?: { key: string; direction: SortDirection } | null;
  onSortChange?: (key: string, direction: SortDirection) => void;
  /** Shown in place of the body when there are no rows. */
  empty?: ReactNode;
  /** Caps the height and lets the sticky header do its job. */
  maxHeight?: number | string;
}

export function Table<Row>({
  columns,
  rows,
  rowKey,
  caption,
  showCaption = false,
  onRowClick,
  isRowSelected,
  isRowCritical,
  sort,
  onSortChange,
  empty,
  maxHeight,
}: TableProps<Row>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      className={styles['tableWrap']}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className={styles['table']}>
        <caption className={showCaption ? undefined : 'sr-only'}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key;
              // aria-sort belongs on the cell, not the button inside it.
              const ariaSort = active
                ? sort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : column.sortable
                  ? 'none'
                  : undefined;

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={[
                    column.numeric ? styles['numeric'] : '',
                    column.actions ? styles['actions'] : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      className={styles['sortButton']}
                      onClick={() =>
                        onSortChange(
                          column.key,
                          active && sort.direction === 'asc' ? 'desc' : 'asc',
                        )
                      }
                    >
                      {column.header}
                      <span
                        className={[
                          styles['sortMark'],
                          active ? styles['sortMarkActive'] : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-hidden="true"
                      >
                        {active ? (sort.direction === 'asc' ? '▲' : '▼') : '▲▼'}
                      </span>
                    </button>
                  ) : (
                    <>
                      {column.header}
                      {column.headerLabel && (
                        <span className="sr-only">{column.headerLabel}</span>
                      )}
                    </>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const selected = isRowSelected?.(row) ?? false;
            const critical = isRowCritical?.(row) ?? false;
            const clickable = Boolean(onRowClick);

            return (
              <tr
                key={rowKey(row, index)}
                className={[
                  selected ? styles['rowSelected'] : '',
                  critical ? styles['rowCritical'] : '',
                  clickable ? styles['rowClickable'] : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-selected={isRowSelected ? selected : undefined}
                // A clickable row is reachable and operable from the keyboard,
                // which a plain onClick on a <tr> never is.
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onRowClick?.(row) : undefined}
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onRowClick?.(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={[
                      column.numeric ? styles['numeric'] : '',
                      column.actions ? styles['actions'] : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {column.render(row, index)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The strip above a table: filters on the left, count and actions right. */
export function TableToolbar({
  children,
  count,
  actions,
}: {
  children?: ReactNode;
  /** "12 of 340 patients" — say what the number counts. */
  count?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={styles['toolbar']}>
      {children}
      <div className={styles['toolbarSpacer']} />
      {count && (
        <span className={styles['count']} aria-live="polite">
          {count}
        </span>
      )}
      {actions}
    </div>
  );
}
