/**
 * Which origin a link or an API call has to use to actually be reachable.
 *
 * Most of the time that is simply the page's own origin. Two builds are the
 * exception: the Tauri desktop app, where `window.location.origin` is
 * `tauri://localhost`, and the dev shell on port 1420. A link to either is
 * meaningless to anyone but the machine that produced it, so an invite emailed
 * from the desktop app has to point at the cloud deployment instead.
 *
 * This existed as `'https://amanadiagnostics.com'` written into seven places
 * across the staff and invite screens, behind three different conditions:
 *
 *   - `origin.includes('tauri://') || origin.includes('localhost:1420')`
 *   - `origin.includes('localhost:1420')` alone — so the real desktop build,
 *     whose origin is `tauri://localhost`, fell through to a relative
 *     `/api/staff/update` that does not exist there. Changing a colleague's
 *     role from the desktop app failed.
 *   - `origin.includes('localhost') ? origin : CLOUD` — the inverse test, used
 *     for the copy-link beside a pending invite. On any cloud deployment not
 *     served from that one domain, every pending invite showed a link to the
 *     wrong host.
 *
 * One rule now, in one place, and the domain is an environment variable so a
 * deployment is not a code change.
 */

/** The deployment a detached build has to fall back to. */
export const CLOUD_ORIGIN =
  process.env['NEXT_PUBLIC_CLOUD_ORIGIN'] || 'https://amanadiagnostics.com';

/**
 * True when this build's own origin is not something another machine can open.
 *
 * Exported separately so it can be tested against origin strings directly,
 * rather than only through whatever `window` happens to be.
 */
export function isDetachedOrigin(origin: string): boolean {
  return origin.startsWith('tauri://') || origin.includes('localhost:1420');
}

/** The origin to build a shareable link from — an invite, a report link. */
export function reachableOrigin(): string {
  if (typeof window === 'undefined') return CLOUD_ORIGIN;
  const own = window.location.origin;
  return isDetachedOrigin(own) ? CLOUD_ORIGIN : own;
}

/**
 * What to put in front of an API path.
 *
 * Empty when the page's own server serves the route, which is the normal case
 * and keeps the request same-origin. Only a detached build reaches across to
 * the cloud deployment.
 */
export function apiBase(): string {
  if (typeof window === 'undefined') return '';
  return isDetachedOrigin(window.location.origin) ? CLOUD_ORIGIN : '';
}
