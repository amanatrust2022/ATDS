import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the investigation catalogue editor.
 *
 * This is where a test gets its name, its specimen, its parameters and its
 * price. Two roles use it and they do different things: an admin's test goes
 * live priced, a scientist's goes in unpriced and waits for an admin. What
 * matters most is that the screen tells the truth about which of those
 * happened — a test that is sitting unpriced while the person who added it
 * believes it is live is money not billed.
 *
 * Written before the rebuild. See decision #28.
 */

const ORG = 'org-1';

let authState: any;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));

const ask = vi.hoisted(() => vi.fn(async () => true));
vi.mock('@/components/Notices', () => ({
  useNotices: () => ({ ask, notify: vi.fn(), askFor: vi.fn() }),
}));

const { storeFns } = vi.hoisted(() => ({
  storeFns: {
    fetchCustomTests: vi.fn(async (_orgId: string): Promise<any[]> => []),
    fetchTestPrices: vi.fn(async (_orgId: string): Promise<any[]> => []),
    addCustomTest: vi.fn(async (_test: any, _orgId: string) => {}),
    updateCustomTest: vi.fn(async (_id: string, _test: any, _orgId: string) => {}),
    deleteCustomTest: vi.fn(async (_id: string, _orgId: string) => {}),
    setCustomCatalogueCache: vi.fn((_tests: any[]) => {}),
    upsertTestPrices: vi.fn(async (_rows: any[], _orgId: string) => {}),
  },
}));

vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<any>('@/lib/store');
  return { ...actual, ...storeFns };
});

import TestManager from './TestManager';

const CUSTOM = {
  id: 'custom_abc',
  name: 'Vitamin D',
  department: 'lab' as const,
  category: 'Chemical Pathology',
  specimen: 'Serum',
  parameters: [{ name: '25-OH D', unit: 'ng/mL', range: '30-100' }],
  is_active: true,
};

const admin = () => ({
  organization: { id: ORG },
  profile: { id: 'p1', role: 'admin', full_name: 'Amina Bello' },
});
const scientist = () => ({
  organization: { id: ORG },
  profile: { id: 'p2', role: 'lab', full_name: 'Musa Sani' },
});

beforeEach(() => {
  vi.clearAllMocks();
  authState = admin();
  storeFns.fetchCustomTests.mockResolvedValue([CUSTOM]);
  storeFns.fetchTestPrices.mockResolvedValue([
    {
      organization_id: ORG,
      test_id: 'custom_abc',
      test_name: 'Vitamin D',
      price: 15000,
      commission_type: 'percentage',
      commission_value: 10,
    },
  ]);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })));
});

const renderManager = () => render(<TestManager organizationId={ORG} />);

const openNew = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /add custom investigation/i }));
};

const field = (name: RegExp) => screen.getByLabelText(name);
const save = () => screen.getByRole('button', { name: /save changes/i });

describe('The investigation catalogue editor', () => {
  it('gives every field in the form a name', async () => {
    renderManager();
    await openNew();

    // Every one of these was a <label> with no htmlFor beside an <input> with
    // no id, so not one control in the form had a name of its own.
    expect(field(/investigation name/i)).toBeInTheDocument();
    expect(field(/specimen/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
    // By role, because the category filter beside the list carries the word
    // too — and because a <select> nobody can name is the actual defect.
    expect(screen.getByRole('combobox', { name: /department/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /category/i })).toBeInTheDocument();
  });

  it('names each parameter row, so the third unit is not just "edit text"', async () => {
    renderManager();
    await openNew();

    fireEvent.change(field(/investigation name/i), { target: { value: 'Iron Studies' } });
    fireEvent.click(screen.getByRole('button', { name: /add parameter/i }));

    expect(screen.getByLabelText(/parameter 1 name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/parameter 1 unit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/parameter 1 (range|reference)/i)).toBeInTheDocument();
  });

  it('will not save a test whose name is only spaces', async () => {
    renderManager();
    await openNew();

    fireEvent.change(field(/investigation name/i), { target: { value: '   ' } });
    fireEvent.click(save());

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(storeFns.addCustomTest).not.toHaveBeenCalled();
  });

  it("puts an admin's new test straight into the catalogue, priced", async () => {
    renderManager();
    await openNew();

    fireEvent.change(field(/investigation name/i), { target: { value: 'Ferritin' } });
    fireEvent.change(field(/specimen/i), { target: { value: 'Serum' } });
    fireEvent.change(screen.getByLabelText(/parameter 1 name/i), { target: { value: 'Ferritin' } });
    fireEvent.change(field(/^price/i), { target: { value: '7500' } });
    fireEvent.click(save());

    await waitFor(() => expect(storeFns.addCustomTest).toHaveBeenCalled());
    const [test] = storeFns.addCustomTest.mock.calls[0]!;
    expect(test).toMatchObject({ name: 'Ferritin', is_active: true });

    const [rows] = storeFns.upsertTestPrices.mock.calls[0]!;
    expect(rows[0]).toMatchObject({ price: 7500 });
  });

  it("holds a scientist's new test back until an admin prices it", async () => {
    authState = scientist();
    renderManager();
    await openNew();

    fireEvent.change(field(/investigation name/i), { target: { value: 'Ferritin' } });
    fireEvent.change(field(/specimen/i), { target: { value: 'Serum' } });
    fireEvent.change(screen.getByLabelText(/parameter 1 name/i), { target: { value: 'Ferritin' } });
    fireEvent.click(save());

    await waitFor(() => expect(storeFns.addCustomTest).toHaveBeenCalled());
    const [test] = storeFns.addCustomTest.mock.calls[0]!;
    expect(test).toMatchObject({ is_active: false });
  });

  /**
   * The one that matters.
   *
   * A scientist adds a test, the email to the admin fails, and the screen said
   * "The administrator has been notified by email" anyway — the failure was
   * swallowed into console.warn. The test then sits unpriced and unbillable
   * while everyone believes it is being dealt with.
   */
  it('does not claim the administrator was emailed when the email failed', async () => {
    authState = scientist();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));

    renderManager();
    await openNew();

    fireEvent.change(field(/investigation name/i), { target: { value: 'Ferritin' } });
    fireEvent.change(field(/specimen/i), { target: { value: 'Serum' } });
    fireEvent.change(screen.getByLabelText(/parameter 1 name/i), { target: { value: 'Ferritin' } });
    fireEvent.click(save());

    await waitFor(() => expect(storeFns.addCustomTest).toHaveBeenCalled());

    // Saved — but the desk has to be told to chase the admin itself.
    expect(screen.queryByText(/has been notified by email/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/could not|not.*notif|tell.*admin|chase/i)).toBeInTheDocument();
  });

  it('says the administrator was emailed when they actually were', async () => {
    authState = scientist();
    renderManager();
    await openNew();

    fireEvent.change(field(/investigation name/i), { target: { value: 'Ferritin' } });
    fireEvent.change(field(/specimen/i), { target: { value: 'Serum' } });
    fireEvent.change(screen.getByLabelText(/parameter 1 name/i), { target: { value: 'Ferritin' } });
    fireEvent.click(save());

    expect(await screen.findByText(/notified/i)).toBeInTheDocument();
  });

  it('leaves the price alone when a scientist edits an existing test', async () => {
    authState = scientist();
    renderManager();

    fireEvent.click(await screen.findByRole('button', { name: /vitamin d/i }));
    fireEvent.change(field(/investigation name/i), { target: { value: 'Vitamin D (25-OH)' } });
    fireEvent.click(save());

    await waitFor(() => expect(storeFns.updateCustomTest).toHaveBeenCalled());
    // A scientist cannot see the price, so saving must not write one.
    expect(storeFns.upsertTestPrices).not.toHaveBeenCalled();
  });

  it('keeps the parameters when a parameterised test is saved', async () => {
    renderManager();

    fireEvent.click(await screen.findByRole('button', { name: /vitamin d/i }));
    fireEvent.change(field(/investigation name/i), { target: { value: 'Vitamin D (25-OH)' } });
    fireEvent.click(save());

    await waitFor(() => expect(storeFns.updateCustomTest).toHaveBeenCalled());
    const [, payload] = storeFns.updateCustomTest.mock.calls[0]!;
    expect(payload.parameters).toHaveLength(1);
    expect(payload.parameters[0]).toMatchObject({ name: '25-OH D' });
  });

  it('asks before removing a test from the catalogue', async () => {
    renderManager();

    fireEvent.click(await screen.findByRole('button', { name: /vitamin d/i }));
    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));

    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(storeFns.deleteCustomTest).toHaveBeenCalledWith('custom_abc', ORG);
  });

  it('reports a failed save instead of appearing to succeed', async () => {
    storeFns.addCustomTest.mockRejectedValueOnce(new Error('catalogue locked'));
    renderManager();
    await openNew();

    fireEvent.change(field(/investigation name/i), { target: { value: 'Ferritin' } });
    fireEvent.change(field(/specimen/i), { target: { value: 'Serum' } });
    fireEvent.change(screen.getByLabelText(/parameter 1 name/i), { target: { value: 'Ferritin' } });
    fireEvent.click(save());

    expect(await screen.findByText(/catalogue locked/i)).toBeInTheDocument();
  });
});
