import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The rule that keeps "which back end" and "is there internet" from being
 * re-copied and re-confused.
 *
 * Mode detection was copied into eight components, each slightly
 * differently, and half of them used it to mean "offline". Both decisions
 * now have one home each — lib/runtimeMode.ts for the mode, the sync
 * engine (read through lib/sync/useSyncState.ts) for connectivity — and
 * this test fails the suite if a component grows its own copy again.
 *
 * If you are here because this failed: import `getRuntimeMode` or
 * `isHubServer` from '@/lib/runtimeMode', `useRuntimeMode` from
 * '@/lib/useRuntimeMode', or `useSyncState` from '@/lib/sync/useSyncState'. Do not add to the
 * allow-list below unless you are changing those modules themselves.
 */

const root = join(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'lib', 'pages'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.open-next', 'src-tauri']);

/** The only files allowed to know how the mode is decided. */
const ALLOWED = new Set(['lib/runtimeMode.ts', 'lib/useRuntimeMode.ts', 'lib/runtimeMode.test.ts', 'lib/runtimeMode.guard.test.ts']);

const FORBIDDEN: Array<{ pattern: RegExp; why: string; allow?: Set<string>; allowTests?: boolean }> = [
  {
    pattern: /localStorage\.(getItem|setItem)\(\s*['"]amana_local_mode['"]/,
    why: 'reads or writes the mode flag directly',
    // A test may set the flag to stage the environment it is testing.
    allowTests: true,
  },
  {
    pattern: /hostname[^\n]*startsWith\(\s*['"](192\.168\.|10\.|172\.)/,
    why: 'decides the mode from the hostname',
  },
  {
    pattern: /NEXT_PUBLIC_LOCAL_SERVER_MODE\s*===\s*['"]true['"]/,
    why: 'decides the mode from the environment',
    // The hub launcher and the desktop shell set this; the hook's SSR
    // starting value reads it so the first client render matches the server.
    allow: new Set(['lib/runtimeMode.ts']),
  },
  {
    pattern: /IS_LOCAL_HUB\s*===\s*['"]true['"]/,
    why: 'decides whether this is a hub from the environment',
    // localDb uses the flag for where the database file lives, not for what mode it is in.
    allow: new Set(['lib/runtimeMode.ts', 'lib/localDb.ts']),
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('mode and connectivity have one definition each', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(root, d)));

  it('no component re-implements mode detection', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(root, file).split(sep).join('/');
      if (ALLOWED.has(rel)) continue;
      const src = readFileSync(file, 'utf8');
      for (const rule of FORBIDDEN) {
        if (rule.allow?.has(rel)) continue;
        if (rule.allowTests && /\.test\.tsx?$/.test(rel)) continue;
        if (rule.pattern.test(src)) offenders.push(`${rel}: ${rule.why}`);
      }
    }
    expect(offenders, 'import from @/lib/runtimeMode instead').toEqual([]);
  });

  it('no component treats local mode as offline', () => {
    // A screen that skips a cloud call *because* it is in local mode is the
    // bug this whole module exists to prevent. The words below are the ones
    // those branches used.
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(root, file).split(sep).join('/');
      if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;
      const src = readFileSync(file, 'utf8');
      if (/if\s*\(\s*(is|IS_)LOCAL_?MODE\s*\)\s*return\s*['"]skipped['"]/i.test(src)) {
        offenders.push(`${rel}: skips a cloud call because the mode is local`);
      }
      if (/\(offline fallback\)/.test(src)) {
        offenders.push(`${rel}: calls a local-mode branch an "offline fallback"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
