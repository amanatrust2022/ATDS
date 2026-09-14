/**
 * Which back end this code talks to. The ONE definition.
 *
 * Two words that used to be used interchangeably, and must not be:
 *
 *   - **Mode** (`local` | `cloud`) is *where the data lives for this screen*.
 *     `local` means the browser is talking to an on-premise hub — this app's
 *     own API routes in front of a SQLite file — and `cloud` means it is
 *     talking to Supabase directly. Mode is decided once per page load and
 *     does not change while the page is open.
 *
 *   - **Connectivity** (`online` | `offline` | `signed_out`) is *whether the
 *     hub can reach the cloud right now*. It changes minute to minute, it is
 *     owned by the hub's sync engine (lib/sync/engine.ts), and it is read
 *     through `useSyncState()` (lib/sync/useSyncState.ts).
 *
 * A hub on a clinic LAN is in local mode all day and online most of it. Every
 * screen that used "local mode" to mean "there is no internet" — skipping a
 * cloud call, swallowing its failure, telling the user their change was
 * "saved locally" — was wrong on both counts: it skipped work the hub could
 * have done, and it never queued the work for the moment the hub could.
 *
 * This module used to be copied, with variations, into eight components.
 * `lib/runtimeMode.guard.test.ts` fails the suite if another copy appears.
 * Import from here — or, in a component, `useRuntimeMode` from
 * `lib/useRuntimeMode.ts`, which is this module's React hook and lives apart
 * only because this one is imported by server code too.
 */
export type RuntimeMode = 'local' | 'cloud';

/**
 * The browser-side override. Written only by `rememberRuntimeMode`, which the
 * shell calls after asking the server which mode it is serving (`/api/config`).
 */
export const LOCAL_MODE_STORAGE_KEY = 'amana_local_mode';

/**
 * Whether a hostname can only be a machine on this LAN: the loopback
 * addresses, the three RFC 1918 private ranges (172.16/12 is a /12, not
 * "anything starting with 172."), mDNS names, and the Tauri shell.
 *
 * Exported so it can be tested against strings rather than only through
 * whatever `window` happens to be.
 */
export function isPrivateHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1') return true;
  if (h.endsWith('.local')) return true;
  if (h.startsWith('192.168.') || h.startsWith('10.')) return true;
  const m = /^172\.(\d{1,3})\./.exec(h);
  if (m) {
    const second = Number(m[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

/** The pieces of the environment the decision reads, so it can be tested. */
export interface ModeEnvironment {
  hostname?: string;
  storedFlag?: string | null;
  isTauri?: boolean;
  serverLocal?: boolean;
}

function readEnvironment(): ModeEnvironment {
  if (typeof window === 'undefined') {
    return { serverLocal: isHubServer() };
  }
  let storedFlag: string | null = null;
  try {
    storedFlag = window.localStorage.getItem(LOCAL_MODE_STORAGE_KEY);
  } catch {
    // Storage disabled or full; fall through to the hostname.
  }
  const w = window as unknown as Record<string, unknown>;
  return {
    hostname: window.location.hostname,
    storedFlag,
    isTauri: w['__TAURI_INTERNALS__'] !== undefined || w['__TAURI__'] !== undefined,
    serverLocal: process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true',
  };
}

/**
 * Decides the mode from an environment. Pure, so the rule has tests.
 *
 * Order of authority:
 *   1. The stored flag — the server was asked and answered (`/api/config`).
 *      Except that a flag saying "hub" on a public hostname is stale: the
 *      same browser was pointed at the hub yesterday and at the web app
 *      today. A public host is never a hub.
 *   2. The Tauri shell, which always embeds a hub.
 *   3. The hostname: a private address is a hub, anything else is the cloud.
 *   4. On the server, the process's own environment.
 */
export function decideRuntimeMode(env: ModeEnvironment): RuntimeMode {
  const onPrivateHost = env.hostname !== undefined && isPrivateHostname(env.hostname);
  if (env.storedFlag === 'true') return onPrivateHost || env.isTauri || env.hostname === undefined ? 'local' : 'cloud';
  if (env.storedFlag === 'false') return 'cloud';
  if (env.isTauri) return 'local';
  if (env.hostname !== undefined) return isPrivateHostname(env.hostname) ? 'local' : 'cloud';
  return env.serverLocal ? 'local' : 'cloud';
}

/** The mode right now. Cheap; safe to call on every render or request. */
export function getRuntimeMode(): RuntimeMode {
  return decideRuntimeMode(readEnvironment());
}

/**
 * Snapshot at module load, kept for the repositories, whose default parameter
 * was written against it. New code should call `getRuntimeMode()`.
 */
export const RUNTIME_MODE: RuntimeMode = getRuntimeMode();

export const isLocalMode = (): boolean => getRuntimeMode() === 'local';

/**
 * Records what the server said it is serving. The shell calls this after
 * `/api/config`; nothing else should write the flag. Returns whether the
 * answer differs from what this page load decided, in which case the caller
 * reloads so every module-load snapshot agrees.
 */
export function rememberRuntimeMode(mode: RuntimeMode): boolean {
  if (typeof window === 'undefined') return false;
  const before = getRuntimeMode();
  try {
    window.localStorage.setItem(LOCAL_MODE_STORAGE_KEY, mode === 'local' ? 'true' : 'false');
  } catch {
    return false;
  }
  return before !== mode;
}

/**
 * The mode the server rendered with, which is the only thing a component
 * may assume before mount. Used as the starting value of `useRuntimeMode`
 * so the first client render matches the server's markup.
 */
export function serverDefaultMode(): RuntimeMode {
  return process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true' ? 'local' : 'cloud';
}

/* ── Server side ───────────────────────────────────────────────────────────── */

/**
 * Whether this Node process is a hub — has a SQLite file, serves the LAN,
 * runs the sync engine. The launcher and the Tauri shell both set
 * `IS_LOCAL_HUB`; `next dev` on a developer's machine counts too, so the
 * hub code paths are exercised without a build.
 */
export function isHubServer(): boolean {
  return (
    process.env.IS_LOCAL_HUB === 'true' ||
    process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true' ||
    process.env.NODE_ENV === 'development'
  );
}
