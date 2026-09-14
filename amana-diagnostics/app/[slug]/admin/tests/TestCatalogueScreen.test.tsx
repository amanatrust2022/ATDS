import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the test catalogue screen — the frame around
 * TestManager and, since the catalogue/price-list merge, the price list too.
 */

let authState: any;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));
vi.mock('@/components/RequireRole', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/TestManager', () => ({
  default: ({ organizationId, onPricesChanged }: { organizationId: string; onPricesChanged?: () => void }) => (
    <div data-testid="test-manager">
      {organizationId}
      <button onClick={onPricesChanged}>trigger price change</button>
    </div>
  ),
}));

const { storeFns } = vi.hoisted(() => ({
  storeFns: {
    fetchTestPrices: vi.fn(async () => [
      { organization_id: 'org-1', test_id: 'fbc', test_name: 'Full Blood Count', price: 3000, commission_type: 'percentage' as const, commission_value: 10 },
    ]),
    fetchCustomTests: vi.fn(async () => []),
  },
}));
vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<any>('@/lib/store');
  return { ...actual, ...storeFns };
});

import TestCatalogueScreen from './TestCatalogueScreen';

beforeEach(() => {
  vi.clearAllMocks();
  storeFns.fetchTestPrices.mockResolvedValue([
    { organization_id: 'org-1', test_id: 'fbc', test_name: 'Full Blood Count', price: 3000, commission_type: 'percentage', commission_value: 10 },
  ]);
  storeFns.fetchCustomTests.mockResolvedValue([]);
  window.history.replaceState(null, '', '/kano/admin/tests');
});

describe('Test catalogue screen', () => {
  it('does not draw its own page heading (decision #30)', () => {
    authState = { organization: { id: 'org-1', name: 'Kano Diagnostics' } };
    render(<TestCatalogueScreen />);

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('announces that it is still waiting for the workspace', () => {
    authState = { organization: null };
    render(<TestCatalogueScreen />);

    expect(screen.getByRole('status')).toHaveTextContent(/workspace/i);
  });

  it('hands the workspace to the catalogue editor', () => {
    authState = { organization: { id: 'org-1', name: 'Kano Diagnostics' } };
    render(<TestCatalogueScreen />);

    expect(screen.getByTestId('test-manager')).toHaveTextContent('org-1');
  });

  it('opens on the investigations tab by default, with a tab for prices', async () => {
    authState = { organization: { id: 'org-1', name: 'Kano Diagnostics' } };
    render(<TestCatalogueScreen />);

    expect(screen.getByRole('tab', { name: /investigations/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /price list/i })).toBeInTheDocument();
    await screen.findByText('Full Blood Count');
  });

  it('opens on the price list when the url asks for it', async () => {
    window.history.replaceState(null, '', '/kano/admin/tests?tab=prices');
    authState = { organization: { id: 'org-1', name: 'Kano Diagnostics' } };
    render(<TestCatalogueScreen />);

    expect(screen.getByRole('tab', { name: /price list/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('shares one set of prices between the two tabs, so a change in one shows in the other', async () => {
    authState = { organization: { id: 'org-1', name: 'Kano Diagnostics' } };
    render(<TestCatalogueScreen />);
    await screen.findByText('Full Blood Count');

    storeFns.fetchTestPrices.mockResolvedValueOnce([
      { organization_id: 'org-1', test_id: 'fbc', test_name: 'Full Blood Count', price: 5000, commission_type: 'percentage', commission_value: 10 },
    ]);
    fireEvent.click(screen.getByText('trigger price change'));

    await waitFor(
      () =>
        expect((screen.getByLabelText(/price.*Full Blood Count/i) as HTMLInputElement).value).toBe('5000'),
      { timeout: 5000 },
    );
  });
});
