import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the sign-up screen.
 *
 * Two steps: the facility, then the admin who runs it. A clinic that cannot
 * get through this never becomes a customer, so what matters is that every
 * field can be found by name, that a mistake is said out loud, and that a
 * slow connection does not leave a stale warning on the next step.
 *
 * Written before the rebuild. See decision #28.
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

const signUp = vi.fn();
const rpc = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ auth: { signUp }, rpc }),
}));

const createOrganizationWithFallback = vi.fn<(...a: any[]) => any>();
const upsertProfileForUser = vi.fn<(...a: any[]) => Promise<void>>(async () => {});
vi.mock('@/lib/workspace', () => ({
  createOrganizationWithFallback: (...a: any[]) => createOrganizationWithFallback(...a),
  upsertProfileForUser: (...a: any[]) => upsertProfileForUser(...a),
}));

import SignUpScreen from './SignUpScreen';

const fetchMock = vi.fn();

beforeEach(() => {
  push.mockClear();
  signUp.mockReset();
  createOrganizationWithFallback.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ available: true }) });
  createOrganizationWithFallback.mockResolvedValue({ organization: { id: 'org-new' } });
  signUp.mockResolvedValue({
    data: { user: { id: 'u1', identities: [{}] }, session: null },
    error: null,
  });
});

const fillFacility = () => {
  fireEvent.change(screen.getByRole('textbox', { name: /facility.*name/i }), {
    target: { value: 'Northgate Diagnostics' },
  });
};

const toStep2 = async () => {
  fillFacility();
  fireEvent.click(screen.getByRole('button', { name: /continue/i }));
  await screen.findByRole('textbox', { name: /your full name/i });
};

describe('Sign-up, step one', () => {
  it('names every field', () => {
    render(<SignUpScreen />);

    expect(screen.getByRole('textbox', { name: /facility.*name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /letterhead/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /workspace id/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /address/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /phone/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /facility email/i })).toBeInTheDocument();
  });

  it('derives the workspace id from the name', () => {
    render(<SignUpScreen />);
    fillFacility();
    expect(screen.getByRole('textbox', { name: /workspace id/i })).toHaveValue('northgate-diagnostics');
  });

  it('says out loud when the id is taken', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ available: false, adoptable: false }) });
    render(<SignUpScreen />);
    fillFacility();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    const note = await screen.findByRole('alert');
    expect(note).toHaveTextContent(/already taken/i);
  });

  /**
   * On a slow connection the ten-second warning was written into the same
   * `error` state as a real failure, and a success afterwards moved to step
   * two without clearing it — so the admin form opened under a red "slow
   * network" message about a check that had already passed.
   */
  it('does not carry a slow-network warning onto the next step', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let resolve!: (v: unknown) => void;
    fetchMock.mockReturnValue(new Promise((r) => { resolve = r; }));

    render(<SignUpScreen />);
    fillFacility();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await vi.advanceTimersByTimeAsync(10_500);
    expect(screen.getByRole('alert')).toHaveTextContent(/slow network/i);

    resolve({ ok: true, json: async () => ({ available: true }) });
    await screen.findByRole('textbox', { name: /your full name/i });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('Sign-up, step two', () => {
  it('names the admin fields and the reveal buttons', async () => {
    render(<SignUpScreen />);
    await toStep2();

    expect(screen.getByRole('textbox', { name: /email address/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /show password/i })).toHaveLength(2);
  });

  it('tells the browser these are new credentials', async () => {
    render(<SignUpScreen />);
    await toStep2();

    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('textbox', { name: /email address/i })).toHaveAttribute('autocomplete', 'email');
  });

  it('refuses mismatched passwords out loud', async () => {
    render(<SignUpScreen />);
    await toStep2();

    fireEvent.change(screen.getByRole('textbox', { name: /your full name/i }), { target: { value: 'A. Bello' } });
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'longenough1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different1' } });
    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('creates the workspace, then the account, then asks them to check email', async () => {
    render(<SignUpScreen />);
    await toStep2();

    fireEvent.change(screen.getByRole('textbox', { name: /your full name/i }), { target: { value: 'A. Bello' } });
    fireEvent.change(screen.getByRole('textbox', { name: /email address/i }), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'longenough1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    await waitFor(() => expect(signUp).toHaveBeenCalled());
    expect(createOrganizationWithFallback).toHaveBeenCalledBefore(signUp as any);
    expect(await screen.findByRole('heading', { name: /check your email/i })).toBeInTheDocument();
  });

  it('can go back to the facility details', async () => {
    render(<SignUpScreen />);
    await toStep2();

    fireEvent.click(screen.getByRole('button', { name: /back to facility/i }));
    expect(screen.getByRole('textbox', { name: /facility.*name/i })).toHaveValue('Northgate Diagnostics');
  });
});
