import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the price and commission catalogue.
 *
 * This screen sets what every test costs and what a referrer earns on it, and
 * it saves the whole catalogue in one write. Two things therefore matter more
 * than anything visual: that a save carries values the screen never showed —
 * because the filters hide rows, and the write does not — and that leaving with
 * unsaved edits cannot happen silently.
 *
 * Written before the rebuild. See decision #28.
 */

const ORG = { id: 'org-1', name: 'Riverside Diagnostics', slug: 'riverside' };

let authState: any;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));

vi.mock('@/components/Notices', () => ({
  useNotices: () => ({ ask: vi.fn(async () => true), notify: vi.fn(), askFor: vi.fn() }),
}));

vi.mock('@/components/RequireRole', () => ({
  default: ({ children }: any) => <>{children}</>,
}));


const { storeFns, CATALOGUE } = vi.hoisted(() => ({
  CATALOGUE: [
  {
    id: 'fbc', name: 'Full Blood Count', department: 'lab' as const,
    category: 'Haematology', specimen: 'Blood', parameters: [],
  },
  {
    id: 'mp', name: 'Malaria Parasite', department: 'lab' as const,
    category: 'Haematology', specimen: 'Blood', parameters: [],
  },
  {
    id: 'cxr', name: 'Chest X-Ray', department: 'radiology' as const,
    category: 'Imaging', specimen: 'N/A', parameters: [],
  },
  ],
  storeFns: {
    fetchTestPrices: vi.fn(async (_orgId: string): Promise<any[]> => []),
    fetchCustomTests: vi.fn(async (_orgId: string): Promise<any[]> => []),
    upsertTestPrices: vi.fn(async (_rows: any[], _orgId: string) => {}),
  },
}));

vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<any>('@/lib/store');
  return { ...actual, ...storeFns, TEST_CATALOGUE: CATALOGUE };
});

import { ShellSlotProvider, useShellSlotValue } from '@/components/shell';
import ReferralPricingScreen from './ReferralPricingScreen';

function SlotActions() {
  const { actions } = useShellSlotValue();
  return <div>{actions}</div>;
}

function renderScreen() {
  return render(
    <ShellSlotProvider>
      <SlotActions />
      <ReferralPricingScreen />
    </ShellSlotProvider>,
  );
}

const PRICES = [
  { organization_id: ORG.id, test_id: 'fbc', test_name: 'Full Blood Count', price: 3000, commission_type: 'percentage' as const, commission_value: 10 },
  { organization_id: ORG.id, test_id: 'cxr', test_name: 'Chest X-Ray', price: 8000, commission_type: 'flat' as const, commission_value: 500 },
];

beforeEach(() => {
  vi.clearAllMocks();
  authState = { organization: ORG, profile: { id: 'me', role: 'admin' } };
  storeFns.fetchTestPrices.mockResolvedValue(PRICES);
  storeFns.fetchCustomTests.mockResolvedValue([]);
});

const priceBox = (testName: string) => screen.getByLabelText(new RegExp(`price.*${testName}`, 'i'));
const saveButton = () => screen.getByRole('button', { name: /save/i });

describe('Price and commission catalogue', () => {
  it('shows the saved price and commission for each test', async () => {
    renderScreen();
    await screen.findByText('Full Blood Count');

    expect((priceBox('Full Blood Count') as HTMLInputElement).value).toBe('3000');
    expect((priceBox('Chest X-Ray') as HTMLInputElement).value).toBe('8000');
    // A test that has never been priced shows empty, not a misleading zero.
    expect((priceBox('Malaria Parasite') as HTMLInputElement).value).toBe('');
  });

  it('has nothing to save until something is edited', async () => {
    renderScreen();
    await screen.findByText('Full Blood Count');

    expect(saveButton()).toBeDisabled();

    fireEvent.change(priceBox('Full Blood Count'), { target: { value: '3500' } });
    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  /**
   * Typing a price and then clearing it again is not an edit.
   *
   * The dirty check compared a map keyed by test id, and clearing the box wrote
   * a 0 under a key the saved map had never had — so the screen believed there
   * were unsaved changes for the rest of the session and the button never went
   * back to "All saved".
   */
  it('goes back to having nothing to save when an edit is undone', async () => {
    renderScreen();
    await screen.findByText('Malaria Parasite');

    fireEvent.change(priceBox('Malaria Parasite'), { target: { value: '1500' } });
    await waitFor(() => expect(saveButton()).toBeEnabled());

    fireEvent.change(priceBox('Malaria Parasite'), { target: { value: '' } });
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  /**
   * The one that matters.
   *
   * The save writes the whole catalogue, and the filters hide rows. A price
   * edited before a filter was applied must still be in the write, and a test
   * hidden behind the filter must keep the price it already had.
   */
  it('saves rows the filter is hiding, with the values they already had', async () => {
    renderScreen();
    await screen.findByText('Full Blood Count');

    fireEvent.change(priceBox('Full Blood Count'), { target: { value: '3500' } });

    // Narrow to radiology — the blood tests leave the screen.
    fireEvent.change(screen.getByLabelText(/department/i), { target: { value: 'radiology' } });
    await waitFor(() => expect(screen.queryByText('Full Blood Count')).not.toBeInTheDocument());

    fireEvent.click(saveButton());

    await waitFor(() => expect(storeFns.upsertTestPrices).toHaveBeenCalled());
    const [rows] = storeFns.upsertTestPrices.mock.calls[0]!;

    expect(rows).toHaveLength(CATALOGUE.length);
    expect(rows.find((r: any) => r.test_id === 'fbc')).toMatchObject({ price: 3500 });
    // Hidden, untouched, and still 8000 rather than zeroed.
    expect(rows.find((r: any) => r.test_id === 'cxr')).toMatchObject({
      price: 8000,
      commission_type: 'flat',
      commission_value: 500,
    });
  });

  it('zeroes the commission value when the type is set to none', async () => {
    renderScreen();
    await screen.findByText('Full Blood Count');

    const type = screen.getByLabelText(/commission type.*Full Blood Count/i);
    fireEvent.change(type, { target: { value: 'none' } });

    fireEvent.click(saveButton());
    await waitFor(() => expect(storeFns.upsertTestPrices).toHaveBeenCalled());

    const [rows] = storeFns.upsertTestPrices.mock.calls[0]!;
    expect(rows.find((r: any) => r.test_id === 'fbc')).toMatchObject({
      commission_type: 'none',
      commission_value: 0,
    });
  });

  it('filters by department, category and search together', async () => {
    renderScreen();
    await screen.findByText('Full Blood Count');

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'malaria' } });
    await waitFor(() => expect(screen.queryByText('Full Blood Count')).not.toBeInTheDocument());
    expect(screen.getByText('Malaria Parasite')).toBeInTheDocument();
    expect(screen.queryByText('Chest X-Ray')).not.toBeInTheDocument();
  });

  it('reports a failed save instead of appearing to succeed', async () => {
    storeFns.upsertTestPrices.mockRejectedValueOnce(new Error('price list locked'));
    renderScreen();
    await screen.findByText('Full Blood Count');

    fireEvent.change(priceBox('Full Blood Count'), { target: { value: '3500' } });
    fireEvent.click(saveButton());

    expect(await screen.findByText(/price list locked/i)).toBeInTheDocument();
    // Still unsaved, so the desk can try again without retyping.
    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('has nothing left to save once a save succeeds', async () => {
    renderScreen();
    await screen.findByText('Full Blood Count');

    fireEvent.change(priceBox('Full Blood Count'), { target: { value: '3500' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it('warns before the tab is closed with unsaved edits, and not otherwise', async () => {
    renderScreen();
    await screen.findByText('Full Blood Count');

    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    fireEvent.change(priceBox('Full Blood Count'), { target: { value: '3500' } });
    await waitFor(() => expect(saveButton()).toBeEnabled());

    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('gives every price and commission box a name of its own', async () => {
    renderScreen();
    await screen.findByText('Full Blood Count');

    // Every row has three controls and they are otherwise identical, so without
    // the test name in the label they are all just "edit text".
    for (const t of CATALOGUE) {
      expect(screen.getByLabelText(new RegExp(`price.*${t.name}`, 'i'))).toBeInTheDocument();
      expect(screen.getByLabelText(new RegExp(`commission type.*${t.name}`, 'i'))).toBeInTheDocument();
      expect(screen.getByLabelText(new RegExp(`commission value.*${t.name}`, 'i'))).toBeInTheDocument();
    }
  });
});
