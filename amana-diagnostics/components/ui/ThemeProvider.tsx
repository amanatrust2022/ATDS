'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Theme and density, stored per device.
 *
 * Both are per-person, per-screen preferences rather than account settings:
 * the same technologist wants compact rows on the bench workstation and
 * comfortable ones on the tablet they carry. Storing them on the device is
 * the behaviour people expect, and it also means the choice survives a
 * clinic's shared login.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';
export type Density = 'compact' | 'standard' | 'comfortable';

const THEME_KEY = 'diagnosticos_theme';
const DENSITY_KEY = 'diagnosticos_density';

interface AppearanceValue {
  theme: ThemeChoice;
  density: Density;
  setTheme: (theme: ThemeChoice) => void;
  setDensity: (density: Density) => void;
}

const AppearanceContext = createContext<AppearanceValue>({
  theme: 'system',
  density: 'standard',
  setTheme: () => {},
  setDensity: () => {},
});

export const useAppearance = () => useContext(AppearanceContext);

/**
 * Runs before first paint, from app/layout.tsx.
 *
 * Without this the page renders light, then flips to dark once React
 * hydrates — the flash of the wrong theme. Reading localStorage in an effect
 * is always too late; it has to happen in a blocking script in <head>.
 *
 * "system" writes no attribute at all, so the media query in tokens.css
 * decides. Writing data-theme="light" for system users would beat their OS
 * setting, which is the opposite of what "system" means.
 */
export const appearanceBootScript = `
(function () {
  try {
    var t = localStorage.getItem(${JSON.stringify(THEME_KEY)});
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
    var d = localStorage.getItem(${JSON.stringify(DENSITY_KEY)});
    if (d === 'compact' || d === 'comfortable') {
      document.documentElement.setAttribute('data-density', d);
    }
  } catch (e) {
    /* Private browsing, or site data blocked. The defaults are fine. */
  }
})();
`;

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return allowed.includes(raw as T) ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  // Start at the defaults on both server and client so the first render
  // matches; the boot script has already put the real value on <html>, and
  // the effect below syncs React's copy of it.
  const [theme, setThemeState] = useState<ThemeChoice>('system');
  const [density, setDensityState] = useState<Density>('standard');

  useEffect(() => {
    setThemeState(readStored(THEME_KEY, ['light', 'dark', 'system'] as const, 'system'));
    setDensityState(
      readStored(DENSITY_KEY, ['compact', 'standard', 'comfortable'] as const, 'standard'),
    );
  }, []);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    const root = document.documentElement;
    if (next === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* Nothing to do — the choice just will not survive a reload. */
    }
  }, []);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    const root = document.documentElement;
    if (next === 'standard') root.removeAttribute('data-density');
    else root.setAttribute('data-density', next);
    try {
      localStorage.setItem(DENSITY_KEY, next);
    } catch {
      /* As above. */
    }
  }, []);

  return (
    <AppearanceContext.Provider value={{ theme, density, setTheme, setDensity }}>
      {children}
    </AppearanceContext.Provider>
  );
}
