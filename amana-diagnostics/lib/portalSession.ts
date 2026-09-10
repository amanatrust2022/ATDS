/**
 * The patient's side of the door.
 *
 * A portal session is a signed token from /api/portal/otp kept in
 * localStorage — deliberately not the staff Supabase session, which the rest
 * of the app uses. The two never mix: a patient has no row in `profiles` and
 * no organisation membership.
 *
 * This module exists because the read-token / read-email / redirect-to-login
 * sequence was written out three times, once per portal screen, and each copy
 * cleared a slightly different set of keys on the way out. One of them left
 * `portal_email` behind, so a signed-out patient's address stayed on the
 * machine until the next successful sign-in overwrote it.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const TOKEN_KEY = 'portal_token';
const EMAIL_KEY = 'portal_email';

/** Whose portal this is. The API answers with it; the screens never guess. */
export interface PortalOrg {
  name: string;
  email: string | null;
  phone: string | null;
  address?: string | null;
}

export function readPortalSession(): { token: string; email: string } | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const email = localStorage.getItem(EMAIL_KEY);
  return token && email ? { token, email } : null;
}

export function startPortalSession(token: string, email: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
}

export function endPortalSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

/**
 * The session for a screen that requires one.
 *
 * `null` means the check has not run yet — on the server, and for the first
 * client render, since localStorage does not exist during hydration. A screen
 * must not decide it is signed out from that: it returns `ready: false` until
 * the effect has looked.
 */
export function usePortalSession() {
  const router = useRouter();
  const [session, setSession] = useState<{ token: string; email: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const found = readPortalSession();
    if (!found) {
      router.replace('/portal/login');
      return;
    }
    setSession(found);
    setReady(true);
  }, [router]);

  /** Also used when the API rejects the token, which is a session that expired. */
  const signOut = useCallback(() => {
    endPortalSession();
    router.replace('/portal/login');
  }, [router]);

  return { session, ready, signOut };
}
