import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Changing a password is the one profile action a wrong result on cannot be
 * undone by the person it happened to. So: the current password is checked
 * first, the two copies must agree, the hub's offline copy is refreshed, and
 * a hub with no internet says so instead of failing after the fact.
 */

let authState: any;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));

let mode: 'local' | 'cloud' = 'cloud';
vi.mock('@/lib/runtimeMode', () => ({ getRuntimeMode: () => mode }));

let syncState: any = null;
vi.mock('@/lib/sync/useSyncState', async () => {
  const actual = await vi.importActual<typeof import('@/lib/sync/useSyncState')>('@/lib/sync/useSyncState');
  return { ...actual, useSyncState: () => syncState };
});

const signInWithPassword = vi.fn<(...a: any[]) => any>();
const updateUser = vi.fn<(...a: any[]) => any>();
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ auth: { signInWithPassword, updateUser } }),
}));

const sendPasswordReset = vi.fn<(...a: any[]) => any>();
vi.mock('@/lib/passwordReset', () => ({ sendPasswordReset: (...a: any[]) => sendPasswordReset(...a) }));

import { PasswordSettings, MIN_PASSWORD_LENGTH } from './PasswordSettings';

const fill = (current: string, next: string, again: string) => {
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: current } });
  fireEvent.change(screen.getAllByLabelText(/new password/i)[0], { target: { value: next } });
  fireEvent.change(screen.getAllByLabelText(/new password/i)[1], { target: { value: again } });
};

beforeEach(() => {
  mode = 'cloud';
  syncState = null;
  authState = { user: { id: 'u1', email: 'aisha@clinic.ng' }, organization: { id: 'org-1' }, session: { access_token: 't' } };
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  updateUser.mockReset().mockResolvedValue({ error: null });
  sendPasswordReset.mockReset().mockResolvedValue({ error: null });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
});

describe('PasswordSettings', () => {
  it('checks the current password before changing anything', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials', status: 400 } });
    render(<PasswordSettings />);
    fill('wrong', 'longer-secret-1', 'longer-secret-1');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await screen.findByText(/current password is not right/i);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('refuses two copies that differ, and a password that is too short', async () => {
    render(<PasswordSettings />);
    fill('old-secret', 'longer-secret-1', 'longer-secret-2');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    await screen.findByText(/do not match/i);

    fill('old-secret', 'short', 'short');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    await screen.findByText(new RegExp(`use at least ${MIN_PASSWORD_LENGTH}`, 'i'));
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('changes the password and says so', async () => {
    render(<PasswordSettings />);
    fill('old-secret', 'longer-secret-1', 'longer-secret-1');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await screen.findByText(/password changed/i);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'aisha@clinic.ng', password: 'old-secret' });
    expect(updateUser).toHaveBeenCalledWith({ password: 'longer-secret-1' });
    // Cloud mode: the hub's cache is not involved.
    expect(fetch).not.toHaveBeenCalled();
  });

  it('on a hub, also refreshes the copy used for signing in without internet', async () => {
    mode = 'local';
    render(<PasswordSettings />);
    fill('old-secret', 'longer-secret-1', 'longer-secret-1');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await screen.findByText(/password changed/i);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/auth/save-credentials', expect.anything()));
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body).toEqual({ email: 'aisha@clinic.ng', password: 'longer-secret-1', userId: 'u1' });
  });

  it('on an offline hub, says so and does not offer a form that cannot work', () => {
    mode = 'local';
    syncState = { enabled: true, connectivity: 'offline', status: 'offline' };
    render(<PasswordSettings />);

    expect(screen.getByText(/the hub is offline/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /change password/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('emails a reset link to the signed-in address', async () => {
    render(<PasswordSettings />);
    fireEvent.click(screen.getByRole('button', { name: /reset link/i }));

    await screen.findByText(/on its way to aisha@clinic.ng/i);
    expect(sendPasswordReset).toHaveBeenCalledWith('aisha@clinic.ng');
  });

  it('explains a network failure as one, not as a wrong password', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'fetch failed', status: 0 } });
    render(<PasswordSettings />);
    fill('old-secret', 'longer-secret-1', 'longer-secret-1');
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));

    await screen.findByText(/could not be reached/i);
  });
});
