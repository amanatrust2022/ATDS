/**
 * Password reset by email, end to end.
 *
 * Why this exists: the reset link never worked. Three separate reasons, all
 * of which are now handled here rather than in whichever screen sent the
 * email.
 *
 * 1. The browser client (@supabase/ssr) uses the PKCE flow, which stores a
 *    one-time secret in the browser that *asked* for the reset and needs it
 *    back when the link is opened. Open the emailed link anywhere else — on
 *    a phone, in a different browser, on a bench after the tab was closed —
 *    and the secret is not there. The link fails silently. So the reset
 *    request goes through a one-off client on the implicit flow: the link
 *    then carries the session itself, and works on any device.
 *
 * 2. A hub's own address (localhost, a LAN IP) was used as the return
 *    address. Supabase will not redirect to an address it has not been told
 *    about, and falls back to the site URL — which sent people to the front
 *    page with no password form. The return address is now always the cloud
 *    deployment's /update-password, which is also what any other device can
 *    open.
 *
 * 3. The set-new-password screen assumed a session had already arrived. When
 *    it had not (an expired link, a used link, reason 1) the screen still
 *    showed the form and only failed on submit. It now reads the link
 *    itself, and says what is wrong when something is.
 */

import { createClient as createBareClient } from '@supabase/supabase-js';
import { createClient, supabaseConfig } from '@/lib/supabase';
import { CLOUD_ORIGIN, isDetachedOrigin } from '@/lib/cloudOrigin';
import { getRuntimeMode } from '@/lib/runtimeMode';

export const RESET_PATH = '/update-password';

/**
 * Where the emailed link should bring the person. A hub's or the desktop
 * app's own address means nothing to another device and is not one
 * Supabase would redirect to; the cloud deployment is both.
 */
export function passwordResetRedirect(): string {
  if (typeof window === 'undefined') return `${CLOUD_ORIGIN}${RESET_PATH}`;
  const own = window.location.origin;
  const useCloud = isDetachedOrigin(own) || getRuntimeMode() === 'local';
  return `${useCloud ? CLOUD_ORIGIN : own}${RESET_PATH}`;
}

/** Sends the reset email. The link it carries works on any device. */
export async function sendPasswordReset(email: string): Promise<{ error: { message: string; status?: number } | null }> {
  const { url, anonKey } = supabaseConfig();
  // Implicit flow, nothing persisted: this client exists only to ask.
  const bare = createBareClient(url, anonKey, {
    auth: {
      flowType: 'implicit',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'amana-password-reset',
    },
  });
  const { error } = await bare.auth.resetPasswordForEmail(email.trim(), { redirectTo: passwordResetRedirect() });
  return { error: error ? { message: error.message, status: error.status } : null };
}

export type RecoveryLink =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string; code: string }
  | { kind: 'none' };

/** Reads what an emailed link left in the address bar, without touching it. */
export function readRecoveryLink(href: string): RecoveryLink {
  let url: URL;
  try { url = new URL(href); } catch { return { kind: 'none' }; }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const query = url.searchParams;

  const errorDescription = hash.get('error_description') ?? query.get('error_description');
  const errorCode = hash.get('error_code') ?? query.get('error_code');
  if (errorDescription || errorCode) {
    return { kind: 'error', message: errorDescription ?? 'The link could not be used.', code: errorCode ?? 'unknown' };
  }

  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'tokens', accessToken, refreshToken };

  const code = query.get('code');
  if (code) return { kind: 'code', code };

  return { kind: 'none' };
}

/** True when a link that arrived somewhere other than the reset screen is a recovery link. */
export function isRecoveryLink(href: string): boolean {
  try {
    const url = new URL(href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    return hash.get('type') === 'recovery' || (hash.get('error_code') ?? '').includes('otp');
  } catch {
    return false;
  }
}

export type RecoveryOutcome =
  | { ok: true }
  | { ok: false; reason: 'expired' | 'wrong_device' | 'no_link' | 'failed'; message: string };

/**
 * Turns the emailed link into a signed-in session, so the new password can
 * be set. Handles both the implicit link this module sends and the PKCE
 * link older emails carried. Clears the tokens from the address bar.
 */
export async function claimRecoveryLink(href: string): Promise<RecoveryOutcome> {
  const supabase = createClient();
  const link = readRecoveryLink(href);
  const clearAddressBar = () => {
    try { window.history.replaceState(null, '', RESET_PATH); } catch { /* not in a browser */ }
  };

  if (link.kind === 'error') {
    clearAddressBar();
    const expired = /expired|invalid/i.test(link.message) || /otp_expired|access_denied/.test(link.code);
    return {
      ok: false,
      reason: expired ? 'expired' : 'failed',
      message: expired ? 'This link has expired or was already used.' : link.message,
    };
  }

  if (link.kind === 'tokens') {
    const { error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
    clearAddressBar();
    if (error) return { ok: false, reason: 'expired', message: 'This link has expired or was already used.' };
    return { ok: true };
  }

  if (link.kind === 'code') {
    const { error } = await supabase.auth.exchangeCodeForSession(link.code);
    clearAddressBar();
    if (error) {
      const wrongDevice = /verifier|code_verifier/i.test(error.message);
      return {
        ok: false,
        reason: wrongDevice ? 'wrong_device' : 'expired',
        message: wrongDevice
          ? 'This link only works in the browser that asked for it. Ask for a new one below; the new link works anywhere.'
          : 'This link has expired or was already used.',
      };
    }
    return { ok: true };
  }

  // No link in the address bar: fine if a session is already here (the
  // link was consumed on a previous load, or someone signed in wants to
  // change a password they know); otherwise there is nothing to do.
  const { data } = await supabase.auth.getSession();
  if (data.session) return { ok: true };
  return { ok: false, reason: 'no_link', message: 'Open this page from the link in the reset email.' };
}
