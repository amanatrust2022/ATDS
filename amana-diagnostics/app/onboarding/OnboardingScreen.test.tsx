import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the onboarding screen.
 *
 * It has three faces: a spinner while the workspace is being created from the
 * details sign-up stored, a manual facility form when those details did not
 * survive the round trip, and a welcome once the workspace exists. A clinic
 * that reaches the manual form has already paid with an email confirmation, so
 * it must be reachable by name and its failures said out loud.
 *
 * Written before the rebuild. See decision #28.
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

const refreshOrg = vi.fn(async () => {});
const auth: {
  user: any; profile: any; organization: any; loading: boolean;
  refreshOrg: () => Promise<void>;
} = { user: null, profile: null, organization: null, loading: false, refreshOrg };
vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => auth,
}));

vi.mock('@/lib/supabase', () => ({ createClient: () => ({}) }));

const createOrganizationWithFallback = vi.fn<(...a: any[]) => any>();
vi.mock('@/lib/workspace', () => ({
  createOrganizationWithFallback: (...a: any[]) => createOrganizationWithFallback(...a),
}));

import OnboardingScreen from './OnboardingScreen';

beforeEach(() => {
  push.mockClear();
  refreshOrg.mockClear();
  createOrganizationWithFallback.mockReset();
  createOrganizationWithFallback.mockResolvedValue({ organization: { id: 'org-new' } });
  localStorage.clear();
  auth.user = { id: 'u1', user_metadata: {} };
  auth.profile = { full_name: 'Aisha Bello', organization_id: null };
  auth.organization = null;
  auth.loading = false;
});

describe('Onboarding — manual facility form', () => {
  it('names every field', async () => {
    render(<OnboardingScreen />);
    await screen.findByRole('textbox', { name: /facility.*name/i });

    expect(screen.getByRole('textbox', { name: /facility.*name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /letterhead/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /workspace id/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /address/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /phone/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
  });

  it('derives the workspace id from the facility name', async () => {
    render(<OnboardingScreen />);
    const name = await screen.findByRole('textbox', { name: /facility.*name/i });
    fireEvent.change(name, { target: { value: 'Northgate Diagnostics' } });
    expect(screen.getByRole('textbox', { name: /workspace id/i })).toHaveValue('northgate-diagnostics');
  });

  it('announces a failed workspace creation as an alert', async () => {
    createOrganizationWithFallback.mockRejectedValue(new Error('Workspace name is already taken.'));
    render(<OnboardingScreen />);
    const name = await screen.findByRole('textbox', { name: /facility.*name/i });
    fireEvent.change(name, { target: { value: 'Northgate Diagnostics' } });
    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already taken/i);
  });

  it('creates the workspace from the typed details', async () => {
    render(<OnboardingScreen />);
    const name = await screen.findByRole('textbox', { name: /facility.*name/i });
    fireEvent.change(name, { target: { value: 'Northgate Diagnostics' } });
    fireEvent.click(screen.getByRole('button', { name: /create workspace/i }));

    await waitFor(() => expect(createOrganizationWithFallback).toHaveBeenCalled());
    expect(createOrganizationWithFallback.mock.calls[0][1]).toMatchObject({ name: 'Northgate Diagnostics' });
  });
});

describe('Onboarding — welcome', () => {
  // This one passed against the old screen too: the welcome already rendered a
  // real <h1> and real <button>s. Kept as a behaviour guard so the rebuild
  // keeps the two ways forward, not as a defect finding.
  it('greets the admin and offers both ways into the workspace', () => {
    auth.organization = { id: 'o1', name: 'Northgate Diagnostics', slug: 'northgate' };
    render(<OnboardingScreen />);

    expect(screen.getByRole('heading', { name: /welcome/i })).toBeInTheDocument();
    expect(screen.getByText(/northgate diagnostics/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /invite staff/i }));
    expect(push).toHaveBeenCalledWith('/northgate/admin/staff');

    fireEvent.click(screen.getByRole('button', { name: /skip.*reception/i }));
    expect(push).toHaveBeenCalledWith('/northgate/reception');
  });
});
