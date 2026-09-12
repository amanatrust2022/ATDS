import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the referrals & pricing overview.
 *
 * Four tiles, each a count and a link into the area it counts. Written before
 * the rebuild (decision #28), so the defects show themselves as failures.
 */

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ organization: { id: 'org-1', name: 'Kano Diagnostics', slug: 'kano' } }),
}));
vi.mock('@/components/RequireRole', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'kano' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Each fetch resolves from a promise this file hands out, so a test can hold
// the screen in its loading state or fail one of the four on purpose.
let facilities: Promise<unknown>;
let doctors: Promise<unknown>;
let prices: Promise<unknown>;
let commissions: Promise<unknown>;

vi.mock('@/lib/store', () => ({
  fetchReferringFacilities: () => facilities,
  fetchReferringDoctors: () => doctors,
  fetchTestPrices: () => prices,
  fetchCommissionReport: () => commissions,
}));

import ReferralsOverviewScreen from './ReferralsOverviewScreen';

beforeEach(() => {
  facilities = Promise.resolve([{ id: 'f1' }, { id: 'f2' }]);
  doctors = Promise.resolve([{ id: 'd1' }]);
  prices = Promise.resolve([{ testId: 't1', price: 500 }, { testId: 't2', price: 0 }]);
  commissions = Promise.resolve([{ commissionAmount: 1200 }]);
});

describe('Referrals overview', () => {
  /**
   * Decision #30. The screen drew its own <h1> under the shell's, so a screen
   * reader met two page headings on one page.
   */
  it('does not draw its own page heading (decision #30)', async () => {
    render(<ReferralsOverviewScreen />);
    expect(await screen.findByText(/referring facilities/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  /**
   * While the four counts were in flight every figure read "—" and every unit
   * read "…". Sighted or not, nobody could tell a screen still loading from a
   * referral network with nothing in it, and a screen reader announced an
   * em dash.
   */
  it('says the figures are loading rather than showing a dash', async () => {
    // Held open for the length of the test: the counts never arrive.
    facilities = new Promise(() => {});

    render(<ReferralsOverviewScreen />);

    expect(await screen.findByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  /**
   * Nothing caught a failed load. The promise rejected into the void, `loading`
   * stayed true, and the admin was left looking at four dashes with no way to
   * know the counts were never coming.
   */
  it('tells the admin when the figures cannot be loaded', async () => {
    commissions = Promise.reject(new Error('Network unreachable'));

    render(<ReferralsOverviewScreen />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/could not|unable|failed/i);
  });

  // A behaviour guard: the four areas and their links held on the old screen
  // too. Kept so the rebuild does not lose a destination.
  it('links to each of the four referral areas', async () => {
    render(<ReferralsOverviewScreen />);

    for (const [name, href] of [
      [/referring facilities/i, '/kano/admin/referrals/facilities'],
      [/referring doctors/i, '/kano/admin/referrals/doctors'],
      [/test price list/i, '/kano/admin/referrals/pricing'],
      [/commissions due/i, '/kano/admin/referrals/commissions'],
    ] as const) {
      expect(await screen.findByRole('link', { name })).toHaveAttribute('href', href);
    }
  });
});
