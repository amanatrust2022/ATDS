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

import NewPasswordScreen from './NewPasswordScreen';

beforeEach(() => {
  push.mockClear();
  updateUser.mockClear();
  updateUser.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

const fill = (pw: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: pw } });
  fireEvent.change(screen.getByLabelText(/^confirm new password$/i), { target: { value: confirm } });
};

describe('Set new password', () => {
  it('names both password fields', () => {
    render(<NewPasswordScreen />);
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^confirm new password$/i)).toBeInTheDocument();
  });

  it('names the two reveal buttons', () => {
    render(<NewPasswordScreen />);
    expect(screen.getAllByRole('button', { name: /show password/i })).toHaveLength(2);
  });

  it('tells the browser both are new credentials', () => {
    render(<NewPasswordScreen />);
    expect(screen.getByLabelText(/^new password$/i)).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText(/^confirm new password$/i)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('announces a mismatch as an alert', async () => {
    render(<NewPasswordScreen />);
    fill('longenough1', 'different1');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('announces a too-short password as an alert', async () => {
    render(<NewPasswordScreen />);
    fill('short', 'short');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8/i);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('updates the password and announces success', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<NewPasswordScreen />);
    fill('longenough1', 'longenough1');
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'longenough1' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/updated/i);

    // The confirmation redirects to sign in after a beat.
    await vi.advanceTimersByTimeAsync(2600);
    expect(push).toHaveBeenCalledWith('/login');
  });
});
