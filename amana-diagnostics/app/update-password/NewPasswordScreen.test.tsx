import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Characterisation tests for the set-new-password screen.
 *
 * The last step of a password reset: someone locked out lands here from an
 * emailed link and chooses a new password. Both fields must be reachable by
 * name, a mistake must be said out loud, and the success that redirects them
 * to sign in must be announced rather than left to a colour.
 *
 * Written before the rebuild. See decision #28.
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

const updateUser = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ auth: { updateUser } }),
}));

const claimRecoveryLink = vi.fn<(...a: any[]) => any>();
const sendPasswordReset = vi.fn<(...a: any[]) => any>();
vi.mock('@/lib/passwordReset', () => ({
  claimRecoveryLink: (...a: any[]) => claimRecoveryLink(...a),
  sendPasswordReset: (...a: any[]) => sendPasswordReset(...a),
}));

import NewPasswordScreen from './NewPasswordScreen';

beforeEach(() => {
  push.mockClear();
  updateUser.mockClear();
  updateUser.mockResolvedValue({ error: null });
  claimRecoveryLink.mockReset().mockResolvedValue({ ok: true });
  sendPasswordReset.mockReset().mockResolvedValue({ error: null });
});

/** The form only appears once the link has been claimed. */
const renderReady = async () => {
  render(<NewPasswordScreen />);
  await screen.findByLabelText(/^new password$/i);
};

afterEach(() => {
  vi.useRealTimers();
});

const fill = (pw: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: pw } });
  fireEvent.change(screen.getByLabelText(/^confirm new password$/i), { target: { value: confirm } });
};

describe('Set new password', () => {
  it('names both password fields', async () => {
    await renderReady();
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm new password$/i)).toBeInTheDocument();
  });

  it('names the two reveal buttons', async () => {
    await renderReady();
    expect(screen.getAllByRole('button', { name: /show password/i })).toHaveLength(2);
  });

  it('tells the browser both are new credentials', async () => {
    await renderReady();
    expect(screen.getByLabelText(/^new password$/i)).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText(/^confirm new password$/i)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('announces a mismatch as an alert', async () => {
    await renderReady();
    fill('longenough1', 'different1');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('announces a too-short password as an alert', async () => {
    await renderReady();
    fill('short', 'short');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8/i);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('updates the password and announces success', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderReady();
    fill('longenough1', 'longenough1');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'longenough1' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/updated/i);

    // The confirmation redirects to sign in after a beat.
    await vi.advanceTimersByTimeAsync(2600);
    expect(push).toHaveBeenCalledWith('/login');
  });

  it('says when the link is expired, and sends a new one from right here', async () => {
    claimRecoveryLink.mockResolvedValue({ ok: false, reason: 'expired', message: 'This link has expired or was already used.' });
    render(<NewPasswordScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/expired or was already used/i);
    expect(screen.queryByLabelText(/^new password$/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'aisha@clinic.ng' } });
    fireEvent.click(screen.getByRole('button', { name: /send me a new link/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/new link sent/i);
    expect(sendPasswordReset).toHaveBeenCalledWith('aisha@clinic.ng');
  });

  it('hands the address bar to the link reader, tokens and all', async () => {
    render(<NewPasswordScreen />);
    await waitFor(() => expect(claimRecoveryLink).toHaveBeenCalledWith(window.location.href));
  });
});
