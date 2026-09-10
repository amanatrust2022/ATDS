'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import type { PatientContext } from './AppShell';
import type { Command } from './CommandPalette';

/**
 * How a screen contributes to the shell now that the shell is above it.
 *
 * AppShell used to be rendered *inside* each page, which meant the rail, the
 * header, the breadcrumbs, the clock and the command palette were destroyed
 * and rebuilt on every navigation. Moving between Reception and the bench
 * blanked the whole window and drew it again, and the rail's collapsed state
 * had to be read back out of localStorage each time.
 *
 * It lives in app/[slug]/layout.tsx instead, so it survives navigation and
 * only <main> changes. That leaves the per-screen parts of the header — the
 * subtitle, the screen's own actions, the open patient, any commands it wants
 * in the palette — with no call site to arrive from. This is that call site.
 *
 * Anything not set falls back to what the shell can work out for itself: the
 * heading from the nav table, the subtitle from the workspace name.
 */
export interface ShellSlotValue {
  subtitle?: string;
  actions?: ReactNode;
  patient?: PatientContext | null;
  commands?: Command[];
  onCommandQueryChange?: (query: string) => void;
  commandsLoading?: boolean;
}

interface ShellSlotStore extends ShellSlotValue {
  set: (value: ShellSlotValue) => void;
  clear: () => void;
}

const ShellSlotContext = createContext<ShellSlotStore | null>(null);

export function ShellSlotProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<ShellSlotValue>({});

  const store = useMemo<ShellSlotStore>(
    () => ({
      ...value,
      set: setValue,
      clear: () => setValue({}),
    }),
    [value],
  );

  return (
    <ShellSlotContext.Provider value={store}>{children}</ShellSlotContext.Provider>
  );
}

/** Read the current slot. Only the shell needs this. */
export function useShellSlotValue(): ShellSlotValue {
  return useContext(ShellSlotContext) ?? {};
}

/**
 * Contribute to the shell's header from a screen.
 *
 * Call it with whatever this screen wants in the header; it is cleared when
 * the screen unmounts, so a value cannot outlive the page that set it and
 * appear over the next one.
 *
 * The dependency list is yours to give, for the same reason it is on
 * useEffect: `actions` is usually a fresh element every render.
 */
export function useShellSlot(value: ShellSlotValue, deps: unknown[] = []) {
  const store = useContext(ShellSlotContext);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (!store) return;
    store.set(latest.current);
    return () => store.clear();
    // The caller decides what counts as a change; `store` is stable enough
    // that including it would re-run this on every header repaint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
