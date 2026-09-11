import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the public landing page.
 *
 * This is the only screen a stranger sees, and the only one that has to work
 * for two quite different arrivals: someone meeting the product for the first
 * time, and someone who already has a workspace and just wants back into it.
 * The second case is the one that was broken — in the desktop build it threw,
 * and on a phone the way back in was hidden by a media query.
 *
 * Written before the rebuild. See decision #28.
 */

const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push, prefetch: vi.fn() }),
}));

let authState: any;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));

import LandingScreen from './LandingScreen';

const signedOut = {
  user: null, profile: null, organization: null,
  session: null, loading: false, authReady: true, profileReady: true,
  signOut: vi.fn(), refreshOrg: vi.fn(),
};

const signedIn = {
  ...signedOut,
  user: { id: 'u1', email: 'a@b.c' },
  profile: { role: 'lab' },
  organization: { slug: 'kano-diagnostics' },
};

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  localStorage.clear();
  // The mode heuristic reads the hostname, and jsdom serves from localhost —
  // which a production build treats as a local hub. Be explicit.
  localStorage.setItem('amana_local_mode', 'false');
  authState = signedOut;
});

describe('The landing page', () => {
  it('leads with what the product does', () => {
    render(<LandingScreen />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/without internet/i);
  });

  it('offers both ways in to a stranger', () => {
    render(<LandingScreen />);

    expect(screen.getAllByRole('button', { name: /free trial/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /local hub/i }).length).toBeGreaterThan(0);
  });

  /**
   * Someone who already has a workspace is not a lead. They want the door, and
   * the door was behind `.mhide { display: none !important }` at 768px with no
   * menu to open in its place — so on a phone the page offered a returning user
   * a free trial and nothing else. jsdom does not evaluate the media query, so
   * this pins the fact the query keys off instead.
   */
  it('does not hide the way back in on a small screen', () => {
    const { container } = render(<LandingScreen />);

    const signIn = screen.getByRole('button', { name: /^sign in$/i });
    const hidden = Array.from(container.querySelectorAll('[data-mobile-hidden]'));

    // Non-vacuous: the page does drop some things on a narrow screen.
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden).not.toContain(signIn);
  });

  it('sends a signed-in visitor to their own workspace', () => {
    authState = signedIn;
    render(<LandingScreen />);

    // The nav and the hero both offer it; either will do.
    screen.getAllByRole('button', { name: /workspace/i })[0]!.click();
    expect(push).toHaveBeenCalledWith('/kano-diagnostics/lab');
  });

  /**
   * Every link in the footer pointed at `href="#"` — including Privacy Policy
   * and Terms of Service, on a page that collects an email address and a
   * facility name. A dead legal link is worse than no link: it says the
   * document exists.
   */
  it('has no links that go nowhere', () => {
    const { container } = render(<LandingScreen />);

    const dead = Array.from(container.querySelectorAll('a[href="#"], a[href=""]'));
    expect(dead.map((a) => a.textContent)).toEqual([]);
  });
});

/**
 * Local mode is the desktop build and the clinic's own hub — the landing page
 * is not wanted there at all, it should bounce straight through.
 */
describe('In local hub mode', () => {
  beforeEach(() => localStorage.setItem('amana_local_mode', 'true'));

  it('sends a signed-out visitor to the login screen', () => {
    render(<LandingScreen />);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  /**
   * This threw. `getDashboardUrl` is a `const` arrow declared *below* the
   * early return for local mode, so in local mode it is never initialised —
   * but the effect that calls it has already been registered. A signed-in user
   * opening the desktop app got a ReferenceError and sat on "Redirecting…"
   * for ever. Signed-out users took the other branch and never saw it.
   */
  it('sends a signed-in user to their workspace instead of throwing', () => {
    authState = signedIn;

    expect(() => render(<LandingScreen />)).not.toThrow();
    expect(replace).toHaveBeenCalledWith('/kano-diagnostics/lab');
  });

  it('does not paint the marketing page on the way through', () => {
    render(<LandingScreen />);
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});
