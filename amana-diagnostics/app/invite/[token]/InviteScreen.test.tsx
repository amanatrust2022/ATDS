import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Characterisation tests for the invite-acceptance screen.
 *
 * The front door for invited staff: an invited colleague lands here from an
 * emailed link, fills in their name and a password, and is signed in. If they
 * cannot get through it they never join the workspace, so what matters is that
 * every field can be found by name, that a mistake is said out loud, and that a
 * slow-but-successful lookup does not leave a stale warning over a form that
 * loaded fine.
 *
 * Written before the rebuild. See decision #28.
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'tok-123' }),
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

const upload = vi.fn(async () => ({ data: { path: 'p' }, error: null }));
const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://x/sig.png' } }));
const signInWithPassword = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    storage: { from: () => ({ upload, getPublicUrl }) },
    auth: { signInWithPassword },
  }),
}));

vi.mock('@/lib/cloudOrigin', () => ({ apiBase: () => '' }));

import InviteScreen from './InviteScreen';

const fetchMock = vi.fn();

const invitePayload = {
  id: 'inv-1',
  email: 'aisha@clinic.test',
  role: 'lab',
  organizationName: 'Northgate Diagnostics',
};

beforeEach(() => {
  push.mockClear();
  signInWithPassword.mockClear();
  upload.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // Default: the lookup succeeds, then the accept succeeds.
  fetchMock.mockImplementation((url: string) => {
    if (String(url).includes('/api/invite/lookup')) {
      return Promise.resolve({ ok: true, json: async () => invitePayload });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Load the screen and wait for the invite form to appear. */
const loaded = async () => {
  render(<InviteScreen />);
  await screen.findByRole('combobox', { name: /title/i });
};

describe('Invite acceptance', () => {
  it('names every field', async () => {
    await loaded();

    expect(screen.getByRole('combobox', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /surname/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /first name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /last name/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/create password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('names the two password-reveal buttons', async () => {
    await loaded();
    expect(screen.getAllByRole('button', { name: /show password/i })).toHaveLength(2);
  });

  it('tells the browser the password is a new credential', async () => {
    await loaded();
    expect(screen.getByLabelText(/create password/i)).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText(/confirm password/i)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('says who the workspace is and the role being joined', async () => {
    await loaded();
    expect(screen.getByText(/northgate diagnostics/i)).toBeInTheDocument();
    expect(screen.getByText(/lab scientist/i)).toBeInTheDocument();
    expect(screen.getByText(/aisha@clinic\.test/i)).toBeInTheDocument();
  });

  it('announces a password mismatch as an alert', async () => {
    await loaded();
    fireEvent.change(screen.getByRole('textbox', { name: /surname/i }), { target: { value: 'Bello' } });
    fireEvent.change(screen.getByRole('textbox', { name: /first name/i }), { target: { value: 'Aisha' } });
    fireEvent.change(screen.getByLabelText(/create password/i), { target: { value: 'longenough1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different1' } });
    fireEvent.click(screen.getByRole('button', { name: /accept invite/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('announces a too-short password as an alert', async () => {
    await loaded();
    fireEvent.change(screen.getByRole('textbox', { name: /surname/i }), { target: { value: 'Bello' } });
    fireEvent.change(screen.getByRole('textbox', { name: /first name/i }), { target: { value: 'Aisha' } });
    fireEvent.change(screen.getByLabelText(/create password/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /accept invite/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8/i);
  });

  /**
   * The defect. The lookup wraps its fetch in withTimeout, and after ten
   * seconds writes "Slow network connection detected" into the same `error`
   * state a real failure uses. A success afterwards never cleared it, so a
   * form that loaded fine opened under a red slow-network warning.
   */
  it('does not leave a slow-network warning over a form that loaded', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolveLookup!: (v: unknown) => void;
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/api/invite/lookup')) {
        return new Promise((r) => { resolveLookup = r; });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    // The lookup is slow enough to trip the ten-second warning, and then it
    // succeeds. (The warning is not visible during the "Verifying…" state; what
    // matters is that it is gone once the form appears.)
    render(<InviteScreen />);
    await vi.advanceTimersByTimeAsync(10_500);
    resolveLookup({ ok: true, json: async () => invitePayload });
    await screen.findByRole('combobox', { name: /title/i });

    // The old screen never cleared the warning on success, so the form opened
    // with a red "slow network" message about a check that had already passed.
    expect(screen.queryByText(/slow network/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  // This one passed against the old screen too: its invalid-link state already
  // rendered a real <a href="/login">. Kept as a behaviour guard so the rebuild
  // does not lose the only way out of a dead link, not as a defect finding.
  it('shows a way back to sign in when the link is invalid', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/api/invite/lookup')) {
        return Promise.resolve({ ok: false, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    render(<InviteScreen />);
    const back = await screen.findByRole('link', { name: /sign in/i });
    expect(back).toHaveAttribute('href', '/login');
  });

  it('accepts the invite and signs the new colleague in', async () => {
    await loaded();
    fireEvent.change(screen.getByRole('textbox', { name: /surname/i }), { target: { value: 'Bello' } });
    fireEvent.change(screen.getByRole('textbox', { name: /first name/i }), { target: { value: 'Aisha' } });
    fireEvent.change(screen.getByLabelText(/create password/i), { target: { value: 'longenough1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /accept invite/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/invite/accept'),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });
});
