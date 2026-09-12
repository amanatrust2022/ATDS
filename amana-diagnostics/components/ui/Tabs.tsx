'use client';

import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import styles from './Tabs.module.css';

/**
 * Tabs, with the keyboard behaviour the hand-rolled versions never had:
 * arrow keys move between tabs, Home and End jump to the ends, and only the
 * selected tab is in the tab order, so Tab moves out of the strip and into
 * the panel rather than through every tab in turn.
 *
 * Declared as data rather than as children, because every tab strip in this
 * app is a fixed list with a count on it:
 *
 *   <Tabs value={tab} onValueChange={setTab} items={[
 *     { value: 'queue', label: 'Queue', count: waiting },
 *     { value: 'results', label: 'Results' },
 *   ]}>
 *     <TabPanel value="queue">...</TabPanel>
 *   </Tabs>
 */

export interface TabItem {
  value: string;
  label: string;
  /** Shown as a pill after the label. Zero is rendered, not hidden. */
  count?: number;
  /** Renders the count as critical — something here is waiting on someone. */
  alert?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
}

export function Tabs({
  value,
  onValueChange,
  items,
  children,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  children: ReactNode;
  /** Names the strip for screen readers, e.g. "Reception sections". */
  ariaLabel: string;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange}>
      <RadixTabs.List className={styles['list']} aria-label={ariaLabel}>
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={styles['trigger']}
          >
            {item.icon && <span aria-hidden="true">{item.icon}</span>}
            {item.label}
            {item.count !== undefined && (
              <span
                className={[styles['count'], item.alert ? styles['countAlert'] : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {item.count}
                {/* The number alone is ambiguous read aloud after a label. */}
                <span className="sr-only"> {item.alert ? 'needing attention' : 'items'}</span>
              </span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  return (
    <RadixTabs.Content value={value} className={styles['panel']}>
      {children}
    </RadixTabs.Content>
  );
}

/**
 * The same choice as a compact control rather than a page-level strip. Use
 * it for view switches inside a panel — "Table / Cards", "Day / Week" —
 * where full tabs would claim more importance than the choice deserves.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  ariaLabel: string;
}) {
  return (
    <div className={styles['segmented']} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles['segment']}
          data-state={value === option.value ? 'active' : undefined}
          aria-pressed={value === option.value}
          onClick={() => onValueChange(option.value)}
        >
          {option.icon && <span aria-hidden="true">{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  );
}
