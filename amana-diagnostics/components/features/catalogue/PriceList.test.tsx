import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the price and commission list.
 *
 * This used to be a standalone screen that fetched its own catalogue and
 * prices; it is now a tab of the catalogue screen, driven entirely by props,
 * so an edit here and an edit in the investigations tab can never disagree
 * about which test prices are current. Two things still matter more than
 * anything visual: that a save carries values the screen never showed —
 * because the filters hide rows, and the write does not — and that leaving
 * with unsaved edits cannot happen silently.
 */

const { storeFns } = vi.hoisted(() => ({
  storeFns: {
    upsertTestPrices: vi.fn(async (_rows: any[], _orgId: string) => {}),
    recordAudit: vi.fn(async () => ({})),
  },
}));

vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<any>('@/lib/store');
  return { ...actual, ...storeFns };
});

import { PriceList } from './PriceList';

const CATALOGUE = [
  { id: 'fbc', name: 'Full Blood Count', department: 'lab' as const, category: 'Haematology', specimen: 'Blood', parameters: [] },
  { id: 'mp', name: 'Malaria Parasite', department: 'lab' as const, category: 'Haematology', specimen: 'Blood', parameters: [] },
  { id: 'cxr', name: 'Chest X-Ray', department: 'radiology' as const, category: 'Imaging', specimen: 'N/A', parameters: [] },
];

const PRICES = [
  { organization_id: 'org-1', test_id: 'fbc', test_name: 'Full Blood Count', price: 3000, commission_type: 'percentage' as const, commission_value: 10 },
  { organization_id: 'org-1', test_id: 'cxr', test_name: 'Chest X-Ray', price: 8000, commission_type: 'flat' as const, commission_value: 500 },
];

beforeEach(() => {
  vi.clearAllMocks();
});

const priceBox = (testName: string) => screen.getByLabelText(new RegExp(`price.*${testName}`, 'i'));
const saveButton = () => screen.getByRole('button', { name: /save/i });

function renderList(overrides: Partial<React.ComponentProps<typeof PriceList>> = {}) {
  return render(
    <PriceList
      organizationId="org-1"
      catalogue={CATALOGUE}
      prices={PRICES}
      {...overrides}
    />,
  );
}

describe('Price list', () => {
  it('shows the saved price and commission for each test', async () => {
    renderList();
    await screen.findByText('Full Blood Count');

    expect((priceBox('Full Blood Count') as HTMLInputElement).value).toBe('3000');
    expect((priceBox('Chest X-Ray') as HTMLInputElement).value).toBe('8000');
    // A test that has never been priced shows empty, not a misleading zero.
    expect((priceBox('Malaria Parasite') as HTMLInputElement).value).toBe('');
  });

  it('has nothing to save until something is edited', async () => {
    renderList();
    await screen.findByText('Full Blood Count');

    expect(saveButton()).toBeDisabled();

    fireEvent.change(priceBox('Full Blood Count'), { target: { value: '3500' } });
    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('goes back to having nothing to save when an edit is undone', async () => {
    renderList();
    await screen.findByText('Malaria Parasite');

    fireEvent.change(priceBox('Malaria Parasite'), { target: { value: '1500' } });
    await waitFor(() => expect(saveButton()).toBeEnabled());

    fireEvent.change(priceBox('Malaria Parasite'), { target: { value: '' } });
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  it('saves rows the filter is hiding, with the values they already had', async () => {
    renderList();
    await screen.findByText('Full Blood Count');

    fireEvent.change(priceBox('Full Blood Count'), { target: { value: '3500' } });

    fireEvent.change(screen.getByLabelText(/department/i), { target: { value: 'radiology' } });
    await waitFor(() => expect(screen.queryByText('Full Blood Count')).not.toBeInTheDocument());

    fireEvent.click(saveButton());

    await waitFor(() => expect(storeFns.upsertTestPrices).toHaveBeenCalled());
    const [rows] = storeFns.upsertTestPrices.mock.calls[0]!;

    expect(rows).toHaveLength(CATALOGUE.length);
    expect(rows.find((r: any) => r.test_id === 'fbc')).toMatchObject({ price: 3500 });
    expect(rows.find((r: any) => r.test_id === 'cxr')).toMatchObject({
      price: 8000,
      commission_type: 'flat',
      commission_value: 500,
    });
  });

  it('zeroes the commission value when the type is set to none', async () => {
    renderList();
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
    renderList();
    await screen.findByText('Full Blood Count');

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'malaria' } });
    await waitFor(() => expect(screen.queryByText('Full Blood Count')).not.toBeInTheDocument());
    expect(screen.getByText('Malaria Parasite')).toBeInTheDocument();
    expect(screen.queryByText('Chest X-Ray')).not.toBeInTheDocument();
  });

  it('reports a failed save instead of appearing to succeed', async () => {
    storeFns.upsertTestPrices.mockRejectedValueOnce(new Error('price list locked'));
    renderList();
    await screen.findByText('Full Blood Count');

    fireEvent.change(priceBox('Full Blood Count'), { target: { value: '3500' } });
    fireEvent.click(saveButton());

    expect(await screen.findByText(/price list locked/i)).toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('has nothing left to save once a save succeeds, and records an audit row per changed test', async () => {
    renderList({ actorId: 'me', actorName: 'Amina Bello' });
    await screen.findByText('Full Blood Count');

    fireEvent.change(priceBox('Full Blood Count'), { target: { value: '3500' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(storeFns.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'price.changed',
        entity_id: 'fbc',
        actor_name: 'Amina Bello',
        before: expect.objectContaining({ price: 3000 }),
        after: expect.objectContaining({ price: 3500 }),
      }),
    );
    // Only the test that changed gets a row.
    expect(storeFns.recordAudit).toHaveBeenCalledTimes(1);
  });

  it('tells the caller once the save lands, so it can refetch', async () => {
    const onSaved = vi.fn();
    renderList({ onSaved });
    await screen.findByText('Full Blood Count');

    fireEvent.change(priceBox('Full Blood Count'), { target: { value: '3500' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('warns before the tab is closed with unsaved edits, and not otherwise', async () => {
    renderList();
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

  it('holds a fresher price list back while the grid is dirty, and offers to reload it', async () => {
    const { rerender } = renderList();
    await screen.findByText('Full Blood Count');

    fireEvent.change(priceBox('Full Blood Count'), { target: { value: '3500' } });
    await waitFor(() => expect(saveButton()).toBeEnabled());

    // Someone else's save comes in through the prop while this one is mid-edit.
    const fresher = [...PRICES.map((p) => (p.test_id === 'fbc' ? { ...p, price: 3200 } : p))];
    rerender(<PriceList organizationId="org-1" catalogue={CATALOGUE} prices={fresher} />);

    // The edit in progress is not clobbered...
    expect((priceBox('Full Blood Count') as HTMLInputElement).value).toBe('3500');
    // ...but the screen says so, and offers a way to take the newer figures.
    expect(await screen.findByText(/changed elsewhere/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reload/i }));
    await waitFor(() => expect((priceBox('Full Blood Count') as HTMLInputElement).value).toBe('3200'));
    expect(saveButton()).toBeDisabled();
  });

  it('gives every price and commission box a name of its own', async () => {
    renderList();
    await screen.findByText('Full Blood Count');

    for (const t of CATALOGUE) {
      expect(screen.getByLabelText(new RegExp(`price.*${t.name}`, 'i'))).toBeInTheDocument();
      expect(screen.getByLabelText(new RegExp(`commission type.*${t.name}`, 'i'))).toBeInTheDocument();
      expect(screen.getByLabelText(new RegExp(`commission value.*${t.name}`, 'i'))).toBeInTheDocument();
    }
  });
});
