import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * The patient portal.
 *
 * These exist because of what the portal got wrong for a long time, and what
 * no type or build check would have caught: it showed one particular clinic's
 * logo and name to every clinic's patients, and it opened a visit from a
 * `<div onClick>`, which a keyboard user cannot use at all. Both are the kind
 * of regression that reappears the moment someone adds a screen by copying an
 * existing one, so they are asserted here rather than left to a click-through.
 */

const replace = vi.fn();
const push = vi.fn();

// One router object for the whole file, not one per render. Next's own
// useRouter is stable, and a fresh object here would change the identity of
// every useCallback that depends on it — which turns the screens' load effect
// into a loop that never settles.
const router = { replace, push, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useParams: () => ({ patientId: 'p1' }),
}));

import { initialsOf, PortalChrome } from './PortalChrome';
import PortalDashboardScreen from './dashboard/PortalDashboardScreen';
import { readPortalSession, startPortalSession, endPortalSession } from '@/lib/portalSession';

const CLINIC = { name: 'Riverside Medical Diagnostics', email: 'care@riverside.example', phone: '0803 000 0000' };

/** One patient, one visit, two tests — one back, one still with the lab. */
const HISTORY = {
  patients: [
    {
      id: 'p1',
      slip_number: '00412',
      first_name: 'Ada',
      middle_name: '',
      surname: 'Okoye',
      registered_at: '2026-09-02T09:15:00.000Z',
    },
  ],
  tests: {
    p1: [
      { id: 't1', patient_id: 'p1', test_name: 'Full Blood Count', department: 'lab', status: 'completed', completed_at: '2026-09-02T14:00:00.000Z' },
      { id: 't2', patient_id: 'p1', test_name: 'Abdominal Ultrasound', department: 'radiology', status: 'processing', completed_at: null },
    ],
  },
  organization: CLINIC,
};

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  localStorage.clear();
  startPortalSession('token-abc', 'ada@example.com');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(HISTORY), { status: 200 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the tenant mark', () => {
  it('is the clinic own initials, at most two', () => {
    expect(initialsOf('Riverside Medical Diagnostics')).toBe('RM');
    expect(initialsOf('Amana')).toBe('A');
  });

  it('survives a name that is punctuation, rather than rendering nothing', () => {
    expect(initialsOf('   ')).toBe('·');
    expect(initialsOf('—')).toBe('·');
  });
});

describe('the portal frame', () => {
  it('names the clinic it belongs to, and offers its contact details', () => {
    render(
      <PortalChrome org={CLINIC}>
        <p>body</p>
      </PortalChrome>,
    );

    // Twice: the header brand, and the footer copyright.
    expect(screen.getAllByText(CLINIC.name).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: CLINIC.email })).toHaveAttribute(
      'href',
      `mailto:${CLINIC.email}`,
    );
  });

  it('says nothing about a clinic whose contact details are not on file', () => {
    render(
      <PortalChrome org={{ name: 'Clinic', email: null, phone: null }}>
        <p>body</p>
      </PortalChrome>,
    );
    expect(screen.queryByText(/Questions about a result/)).toBeNull();
  });
});

describe('the visit list', () => {
  it('shows the clinic from the API rather than one written into the page', async () => {
    render(<PortalDashboardScreen />);
    await waitFor(() => expect(screen.getAllByText(CLINIC.name).length).toBeGreaterThan(0));
    expect(screen.queryByText(/Amana/i)).toBeNull();
  });

  it('opens a visit from a button that reports whether it is open', async () => {
    render(<PortalDashboardScreen />);

    const toggle = await screen.findByRole('button', { name: /Slip #00412/ });
    // The most recent visit opens on arrival — it is what the patient came for.
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('offers the report when only some results are back, and says how many', async () => {
    render(<PortalDashboardScreen />);
    expect(await screen.findByRole('button', { name: 'View 1 of 2 results' })).toBeTruthy();
    expect(screen.getByText('Some results ready')).toBeTruthy();
  });

  it('sends a patient with no session to sign in instead of calling the API', async () => {
    endPortalSession();
    render(<PortalDashboardScreen />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/portal/login'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('signs a patient out when the token is no longer accepted', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    render(<PortalDashboardScreen />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/portal/login'));
    expect(readPortalSession()).toBeNull();
  });
});

describe('signing out', () => {
  it('clears both keys, not just the token', () => {
    expect(readPortalSession()).toEqual({ token: 'token-abc', email: 'ada@example.com' });
    endPortalSession();
    expect(localStorage.getItem('portal_token')).toBeNull();
    expect(localStorage.getItem('portal_email')).toBeNull();
  });
});
