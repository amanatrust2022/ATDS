import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the admin overview.
 *
 * A dashboard the admin lands on: three counts and a nudge to the day's
 * queues. The defect under the styling is decision #30 — it drew its own page
 * heading under the shell's, so a screen reader met two <h1>s and the page
 * announced "Workspace Overview" twice.
 *
 * Written before the rebuild. See decision #28.
 */

// Decide cloud (not local) mode before the module loads, so stats come from the
// mocked Supabase counts rather than a /api/profiles fetch.
vi.hoisted(() => localStorage.setItem('amana_local_mode', 'false'));

let authState: any;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));
vi.mock('@/components/RequireRole', () => ({ default: ({ children }: any) => <>{children}</> }));

const counts: Record<string, number> = { profiles: 7, invitations: 3 };
const query = (table: string) => {
  const result = { count: counts[table] ?? 0, error: null };
  const q: any = {
    select: () => q,
    eq: () => q,
    is: () => q,
    then: (onOk: (v: any) => unknown) => Promise.resolve(result).then(onOk),
  };
  return q;
};
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({ from: (table: string) => query(table) }),
}));

import AdminOverviewScreen from './AdminOverviewScreen';

beforeEach(() => {
  localStorage.setItem('amana_local_mode', 'false');
  authState = { organization: { id: 'org-1', name: 'Kano Diagnostics', slug: 'kano-diagnostics' } };
});

describe('Admin overview', () => {
  it('does not draw its own page heading (decision #30)', () => {
    render(<AdminOverviewScreen />);
    // The shell owns the <h1>; the screen must not add a second one.
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  // The next two passed against the old screen too — its figures were already
  // labelled and its counts already loaded. Kept as behaviour guards so the
  // rebuild does not lose them, not as defect findings.
  it('names the three figures', () => {
    render(<AdminOverviewScreen />);
    expect(screen.getByText(/active staff/i)).toBeInTheDocument();
    expect(screen.getByText(/pending invites/i)).toBeInTheDocument();
    expect(screen.getByText(/workspace id/i)).toBeInTheDocument();
    expect(screen.getByText('kano-diagnostics')).toBeInTheDocument();
  });

  it('shows the staff and invitation counts once loaded', async () => {
    render(<AdminOverviewScreen />);
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(await screen.findByText('3')).toBeInTheDocument();
  });
});
