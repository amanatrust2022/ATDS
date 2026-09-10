'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { RiSearchLine } from '@remixicon/react';
import dialogStyles from '../ui/Dialog.module.css';
import styles from './Shell.module.css';

/**
 * Reach anything in two keystrokes.
 *
 * For a front desk registering forty patients a shift, this is the largest
 * throughput win available in the interface: no menu hunting, no back button,
 * no remembering which tab the wallet lives behind.
 *
 * Focus stays in the text field the whole time and the highlighted row is
 * tracked with aria-activedescendant. Moving real focus into the list would
 * mean every arrow key press stole the keystroke from the query.
 */

export interface Command {
  id: string;
  label: string;
  /** Second line — a patient's ID, the section a command belongs to. */
  meta?: string;
  /** Grouping heading. Items are shown in group order. */
  group: string;
  icon?: ReactNode;
  /** Extra words to match on that are not shown. */
  keywords?: string[];
  /** Either navigate, or run something. */
  href?: string;
  run?: () => void;
}

/** Subsequence match, so "recpt" finds "Reception" and "am bel" finds a name. */
function score(query: string, haystack: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const h = haystack.toLowerCase();

  const direct = h.indexOf(q);
  if (direct === 0) return 1000;
  if (direct > 0) return 500 - direct;

  let qi = 0;
  let last = -1;
  let gaps = 0;
  for (let hi = 0; hi < h.length && qi < q.length; hi++) {
    if (h[hi] === q[qi]) {
      if (last >= 0) gaps += hi - last - 1;
      last = hi;
      qi++;
    }
  }
  return qi === q.length ? Math.max(1, 200 - gaps) : 0;
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  /** Called as the query changes, so the caller can search the database. */
  onQueryChange,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
  onQueryChange?: (query: string) => void;
  loading?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // A stale query from last time is worse than an empty one: the first thing
  // typed would filter against someone else's search.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);

  const matches = useMemo(() => {
    const scored = commands
      .map((command) => {
        const hay = [command.label, command.meta ?? '', ...(command.keywords ?? [])].join(' ');
        return { command, score: score(query, hay) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);

    // Group, keeping each group's best match first.
    const groups = new Map<string, Command[]>();
    for (const { command } of scored) {
      const list = groups.get(command.group) ?? [];
      list.push(command);
      groups.set(command.group, list);
    }
    return groups;
  }, [commands, query]);

  const flat = useMemo(() => [...matches.values()].flat(), [matches]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the highlighted row in view as the arrows move past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const choose = (command: Command | undefined) => {
    if (!command) return;
    onOpenChange(false);
    if (command.run) command.run();
    else if (command.href) router.push(command.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(flat[activeIndex]);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(0, flat.length - 1));
    }
  };

  let runningIndex = -1;

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={dialogStyles['overlay']} />
        <RadixDialog.Content
          className={[dialogStyles['content'], dialogStyles['md']].join(' ')}
          aria-label="Search and commands"
          style={{ top: '12vh', transform: 'translateX(-50%)' }}
        >
          <RadixDialog.Title className="sr-only">Search and commands</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">
            Type to find a patient, a screen or an action. Use the arrow keys to move
            through results and Enter to open one.
          </RadixDialog.Description>

          <div className={styles['paletteInputWrap']}>
            <RiSearchLine size={18} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.5 }} />
            <input
              className={styles['paletteInput']}
              placeholder="Search patients, screens and actions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              autoFocus
              role="combobox"
              aria-expanded="true"
              aria-controls="command-palette-list"
              aria-activedescendant={
                flat.length ? `command-option-${activeIndex}` : undefined
              }
              aria-autocomplete="list"
            />
          </div>

          <ul
            ref={listRef}
            id="command-palette-list"
            className={styles['paletteList']}
            role="listbox"
            aria-label="Results"
          >
            {flat.length === 0 && (
              <li className={styles['paletteEmpty']}>
                {loading ? 'Searching…' : `Nothing matches "${query}".`}
              </li>
            )}

            {[...matches.entries()].map(([group, items]) => (
              <li key={group} role="presentation">
                <p className={styles['paletteGroup']} role="presentation">
                  {group}
                </p>
                <ul role="presentation" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {items.map((command) => {
                    runningIndex += 1;
                    const index = runningIndex;
                    const active = index === activeIndex;
                    return (
                      <li key={command.id} role="presentation">
                        <button
                          type="button"
                          id={`command-option-${index}`}
                          data-index={index}
                          role="option"
                          aria-selected={active}
                          tabIndex={-1}
                          className={[
                            styles['paletteItem'],
                            active ? styles['paletteItemActive'] : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          // Pointer move rather than enter: a mouse resting on
                          // the list should not fight the arrow keys.
                          onPointerMove={() => setActiveIndex(index)}
                          onClick={() => choose(command)}
                        >
                          {command.icon && (
                            <span className={styles['paletteItemIcon']} aria-hidden="true">
                              {command.icon}
                            </span>
                          )}
                          <span className={styles['paletteItemBody']}>
                            <span className={styles['paletteItemLabel']}>{command.label}</span>
                            {command.meta && (
                              <span className={styles['paletteItemMeta']}>{command.meta}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>

          <div className={styles['paletteHint']}>
            <span>
              <span className={styles['kbd']}>↑</span> <span className={styles['kbd']}>↓</span>{' '}
              move
            </span>
            <span>
              <span className={styles['kbd']}>Enter</span> open
            </span>
            <span>
              <span className={styles['kbd']}>Esc</span> close
            </span>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * Opens the palette on Ctrl-K / Cmd-K, and on "/" when the user is not
 * already typing into something.
 */
export function useCommandPaletteHotkey(onOpen: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const inField =
        event.target instanceof HTMLElement &&
        (event.target.tagName === 'INPUT' ||
          event.target.tagName === 'TEXTAREA' ||
          event.target.tagName === 'SELECT' ||
          event.target.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        onOpen();
      } else if (key === '/' && !inField && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}
