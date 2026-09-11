import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the personal profile screen.
 *
 * This is where a technologist sets the name and signature that go on the
 * reports they authorise, so the fields must be reachable by name and the
 * result of pressing Save must be said out loud — a signature stamped under the
 * wrong name is a clinical-record problem, not a cosmetic one.
 *
 * Written before the rebuild. See decision #28.
 */

let authState: any;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));

vi.mock('@/components/RequireRole', () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/components/features/settings/AppearanceSettings', () => ({
  AppearanceSettings: () => <div data-testid="appearance" />,
}));

const eq = vi.fn<(...a: any[]) => any>(async () => ({ error: null }));
const update = vi.fn<(...a: any[]) => any>(() => ({ eq }));
const updateUser = vi.fn(async () => ({ error: null }));
const uploadStore = vi.fn(async () => ({ error: null }));
const getPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://x/sig.png' } }));
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({ update }),
    auth: { updateUser },
    storage: { from: () => ({ upload: uploadStore, getPublicUrl }) },
  }),
}));

import ProfileScreen from './ProfileScreen';

const profile = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  title: 'Dr.',
  first_name: 'Aisha',
  last_name: '',
  surname: 'Bello',
  full_name: 'Dr. Aisha Bello',
  role: 'lab',
  signature_url: null,
  ...over,
});

beforeEach(() => {
  update.mockClear();
  eq.mockClear();
  updateUser.mockClear();
  eq.mockResolvedValue({ error: null });
  authState = {
    profile: profile(),
    user: { id: 'u1' },
    organization: { name: 'Northgate Diagnostics' },
  };
});

describe('Profile settings', () => {
  it('names every field', () => {
    render(<ProfileScreen />);

    expect(screen.getByRole('combobox', { name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /surname/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /first name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /last name/i })).toBeInTheDocument();
  });

  it('loads the profile on file into the fields', () => {
    render(<ProfileScreen />);

    expect(screen.getByRole('textbox', { name: /surname/i })).toHaveValue('Bello');
    expect(screen.getByRole('textbox', { name: /first name/i })).toHaveValue('Aisha');
    expect(screen.getByRole('combobox', { name: /title/i })).toHaveValue('Dr.');
  });

  it('announces a successful save as a status', async () => {
    render(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const note = await screen.findByRole('status');
    expect(note).toHaveTextContent(/updated/i);
  });

  it('announces a failed save as an alert', async () => {
    eq.mockResolvedValue({ error: { message: 'Network unreachable. Try again.' } });
    render(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/network unreachable/i);
  });

  it('saves the edited name back to the profile', async () => {
    render(<ProfileScreen />);
    fireEvent.change(screen.getByRole('textbox', { name: /surname/i }), { target: { value: 'Bello-Sani' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0]).toMatchObject({ surname: 'Bello-Sani' });
    await waitFor(() => expect(updateUser).toHaveBeenCalled());
  });
});
