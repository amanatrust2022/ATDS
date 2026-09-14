import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for the unified Referrers screen.
 *
 * Doctors and facilities are now one table — the two screens this replaces
 * were twins with a hard delete that was not reversible and no audit trail.
 * This screen deactivates instead and writes an audit row either way.
 */

const ORG = { id: 'org-1', name: 'Riverside Diagnostics', slug: 'riverside' };

let authState: any;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));

const { ask, notify, storeFns } = vi.hoisted(() => ({
  ask: vi.fn(async () => true),
  notify: vi.fn(),
  storeFns: {
    fetchReferringDoctors: vi.fn(async (_orgId: string): Promise<any[]> => []),
    fetchReferringFacilities: vi.fn(async (_orgId: string): Promise<any[]> => []),
    fetchCommissionReport: vi.fn(async (_orgId: string): Promise<any[]> => []),
    addReferringDoctor: vi.fn(async (_payload: any, _orgId: string) => ({ id: 'new-doc-1' })),
    updateReferringDoctor: vi.fn(async (_id: string, _payload: any) => {}),
    addReferringFacility: vi.fn(async (_payload: any, _orgId: string) => ({ id: 'new-fac-1' })),
    updateReferringFacility: vi.fn(async (_id: string, _payload: any) => {}),
    recordAudit: vi.fn(async () => ({ id: 'audit-1' })),
  },
}));

vi.mock('@/components/Notices', () => ({
  useNotices: () => ({ ask, notify, askFor: vi.fn() }),
}));

vi.mock('@/components/RequireRole', () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'riverside' }),
}));

vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<any>('@/lib/store');
  return { ...actual, ...storeFns };
});

import { ShellSlotProvider, useShellSlotValue } from '@/components/shell';
import ReferrersScreen from './ReferrersScreen';

function SlotActions() {
  const { actions } = useShellSlotValue();
  return <div data-testid="shell-actions">{actions}</div>;
}

function renderScreen() {
  return render(
    <ShellSlotProvider>
      <SlotActions />
      <ReferrersScreen />
    </ShellSlotProvider>,
  );
}

const CREATED = '2026-01-01T09:00:00.000Z';

const FACILITIES = [
  {
    id: 'fac-1', organization_id: ORG.id, name: 'City General', address: '12 Clinic Road',
    phone: '08030000001', email: 'info@citygeneral.ng',
    commission_type: 'percentage' as const, commission_value: 10, is_active: true, created_at: CREATED,
  },
  {
    id: 'fac-2', organization_id: ORG.id, name: 'Northside Clinic', address: '5 North Ave',
    phone: '', email: '',
    commission_type: 'flat' as const, commission_value: 0, is_active: false, created_at: CREATED,
  },
];

const DOCTORS = [
  {
    id: 'doc-1', organization_id: ORG.id, name: 'Bello', facility_id: 'fac-1', facility_name: 'City General',
    phone: '08031111111', email: 'bello@citygeneral.ng',
    commission_type: 'percentage' as const, commission_value: 10, is_active: true, created_at: CREATED,
  },
  {
    id: 'doc-2', organization_id: ORG.id, name: 'Adamu', facility_id: '', facility_name: '',
    phone: '', email: '',
    commission_type: 'flat' as const, commission_value: 0, is_active: false, created_at: CREATED,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  authState = { organization: ORG, profile: { id: 'me', full_name: 'Test Admin', role: 'admin' } };
  storeFns.fetchReferringDoctors.mockResolvedValue(DOCTORS);
  storeFns.fetchReferringFacilities.mockResolvedValue(FACILITIES);
  storeFns.fetchCommissionReport.mockResolvedValue([]);
});

/* ========================================================================
 * Listing
 * ==================================================================== */

describe('Referrers screen — listing', () => {
  it('shows both doctors and facilities in one table by default', async () => {
    renderScreen();
    // Only active referrers by default
    await screen.findByText(/Bello/);
    expect(screen.getByText(/City General/)).toBeInTheDocument();
    // Inactive are hidden
    expect(screen.queryByText(/Adamu/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Northside Clinic/)).not.toBeInTheDocument();
  });

  it('labels doctors with Dr. prefix and facilities without', async () => {
    renderScreen();
    await screen.findByText(/Dr\. Bello/);
    expect(screen.getByText('City General')).toBeInTheDocument();
  });

  it('shows a facility badge and a doctor badge side by side', async () => {
    renderScreen();
    await screen.findByText(/Bello/);
    expect(screen.getByText('Doctor')).toBeInTheDocument();
    expect(screen.getByText('Facility')).toBeInTheDocument();
  });

  it('shows the facility name for a linked doctor, and Independent for one without', async () => {
    storeFns.fetchReferringDoctors.mockResolvedValue([
      DOCTORS[0]!, // Bello → City General
      { ...DOCTORS[0]!, id: 'doc-solo', name: 'Solo', facility_id: '', facility_name: '', is_active: true },
    ]);
    renderScreen();
    await screen.findByText(/Bello/);
    expect(screen.getByText('City General')).toBeInTheDocument();
    expect(screen.getByText(/Independent/i)).toBeInTheDocument();
  });

  it('reveals inactive referrers when the checkbox is checked', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getByRole('checkbox', { name: /show inactive/i }));
    await screen.findByText(/Adamu/);
    expect(screen.getByText(/Northside Clinic/)).toBeInTheDocument();
  });
});

/* ========================================================================
 * Filtering
 * ==================================================================== */

describe('Referrers screen — filters', () => {
  it('filters to doctors only', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getByRole('radio', { name: /^Doctors$/i }));
    await waitFor(() => expect(screen.queryByText(/City General/i)).not.toBeInTheDocument());
    expect(screen.getByText(/Dr\. Bello/)).toBeInTheDocument();
  });

  it('filters to facilities only', async () => {
    renderScreen();
    await screen.findByText(/City General/);

    fireEvent.click(screen.getByRole('radio', { name: /^Facilities$/i }));
    await waitFor(() => expect(screen.queryByText(/Dr\. Bello/)).not.toBeInTheDocument());
    expect(screen.getByText('City General')).toBeInTheDocument();
  });

  it('searches by doctor name', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'bello' } });
    await waitFor(() => expect(screen.getByText(/Dr\. Bello/)).toBeInTheDocument());
    expect(screen.queryByText(/City General/)).not.toBeInTheDocument();
  });

  it('searches by facility name (finds the doctor linked to it)', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'city' } });
    await waitFor(() => expect(screen.getByText(/Dr\. Bello/)).toBeInTheDocument());
  });

  it('searches by facility address', async () => {
    storeFns.fetchReferringDoctors.mockResolvedValue([]);
    renderScreen();
    await screen.findByText(/City General/);

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'clinic road' } });
    await waitFor(() => expect(screen.getByText(/City General/)).toBeInTheDocument());
  });
});

/* ========================================================================
 * Add doctor
 * ==================================================================== */

describe('Referrers screen — add doctor', () => {
  it('opens the add doctor dialog from the shell action', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(within(screen.getByTestId('shell-actions')).getByRole('button', { name: /add doctor/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('saves a new doctor against the organisation', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(within(screen.getByTestId('shell-actions')).getByRole('button', { name: /add doctor/i }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/doctor name/i), { target: { value: 'Hauwa Ibrahim' } });
    fireEvent.change(within(dialog).getByLabelText(/phone/i), { target: { value: '08032222222' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /save doctor/i }));

    await waitFor(() => expect(storeFns.addReferringDoctor).toHaveBeenCalled());
    const [payload, orgId] = storeFns.addReferringDoctor.mock.calls[0]!;
    expect(payload).toMatchObject({ name: 'Hauwa Ibrahim', phone: '08032222222', is_active: true });
    expect(orgId).toBe(ORG.id);
    // Screen re-reads from the server, not guessing locally.
    expect(storeFns.fetchReferringDoctors).toHaveBeenCalledTimes(2);
  });

  it('refuses to save a doctor with no name', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(within(screen.getByTestId('shell-actions')).getByRole('button', { name: /add doctor/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /save doctor/i }));

    expect(await within(dialog).findByText(/name is required/i)).toBeInTheDocument();
    expect(storeFns.addReferringDoctor).not.toHaveBeenCalled();
  });

  it('records an audit row on add', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(within(screen.getByTestId('shell-actions')).getByRole('button', { name: /add doctor/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/doctor name/i), { target: { value: 'Zara Musa' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /save doctor/i }));

    await waitFor(() => expect(storeFns.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'referrer.added', entity_label: 'Zara Musa' }),
    ));
  });
});

/* ========================================================================
 * Edit doctor
 * ==================================================================== */

describe('Referrers screen — edit doctor', () => {
  it('opens the edit dialog populated with existing data', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect((within(dialog).getByLabelText(/doctor name/i) as HTMLInputElement).value).toBe('Bello');
  });

  it('updates the doctor in place, not adding a second one', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getAllByRole('button', { name: /edit Bello/i })[0]!);
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText(/doctor name/i);
    fireEvent.change(name, { target: { value: 'Bello Yusuf' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /save doctor/i }));

    await waitFor(() => expect(storeFns.updateReferringDoctor).toHaveBeenCalled());
    const [id, payload] = storeFns.updateReferringDoctor.mock.calls[0]!;
    expect(id).toBe('doc-1');
    expect(payload).toMatchObject({ name: 'Bello Yusuf' });
    expect(storeFns.addReferringDoctor).not.toHaveBeenCalled();
  });

  /**
   * An edit must not silently zero the commission rate.
   *
   * Nothing on this screen can set it — test_prices.commission_* wins
   * unconditionally — so whatever is already there came from somewhere else.
   * Dropping it would be silent data loss on a field the desk cannot see.
   */
  it('carries the existing commission through an edit untouched', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getAllByRole('button', { name: /edit Bello/i })[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/doctor name/i), { target: { value: 'Bello Yusuf' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /save doctor/i }));

    await waitFor(() => expect(storeFns.updateReferringDoctor).toHaveBeenCalled());
    const [, payload] = storeFns.updateReferringDoctor.mock.calls[0]!;
    expect(payload).toMatchObject({ commission_type: 'percentage', commission_value: 10 });
  });
});

/* ========================================================================
 * Add / edit facility
 * ==================================================================== */

describe('Referrers screen — add facility', () => {
  it('opens the add facility dialog', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(within(screen.getByTestId('shell-actions')).getByRole('button', { name: /add facility/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('saves a new facility against the organisation', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(within(screen.getByTestId('shell-actions')).getByRole('button', { name: /add facility/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/facility name/i), { target: { value: 'Eastgate Hospital' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /save facility/i }));

    await waitFor(() => expect(storeFns.addReferringFacility).toHaveBeenCalled());
    const [payload, orgId] = storeFns.addReferringFacility.mock.calls[0]!;
    expect(payload).toMatchObject({ name: 'Eastgate Hospital', is_active: true });
    expect(orgId).toBe(ORG.id);
  });

  it('refuses to save a facility with no name', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(within(screen.getByTestId('shell-actions')).getByRole('button', { name: /add facility/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /save facility/i }));

    expect(await within(dialog).findByText(/name is required/i)).toBeInTheDocument();
    expect(storeFns.addReferringFacility).not.toHaveBeenCalled();
  });

  it('carries the existing commission through a facility edit untouched', async () => {
    // Show inactive so City General's inactive twin is also visible
    renderScreen();
    await screen.findByText(/City General/);

    // The first edit button belongs to City General (active facility)
    const facilityEditBtns = screen.getAllByRole('button', { name: /edit city general/i });
    fireEvent.click(facilityEditBtns[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/facility name/i), {
      target: { value: 'City General Hospital' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /save facility/i }));

    await waitFor(() => expect(storeFns.updateReferringFacility).toHaveBeenCalled());
    const [id, payload] = storeFns.updateReferringFacility.mock.calls[0]!;
    expect(id).toBe('fac-1');
    expect(payload).toMatchObject({ commission_type: 'percentage', commission_value: 10 });
  });
});

/* ========================================================================
 * Deactivate / reactivate (replaces delete)
 * ==================================================================== */

describe('Referrers screen — deactivate / reactivate', () => {
  it('deactivates a referrer and writes an audit row', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getByRole('button', { name: /deactivate Bello/i }));

    await waitFor(() => expect(storeFns.updateReferringDoctor).toHaveBeenCalled());
    const [, payload] = storeFns.updateReferringDoctor.mock.calls[0]!;
    // The full row must be sent — the hub uses a whole-row update and the
    // NOT NULL columns reject a partial object.
    expect(payload).toMatchObject({ is_active: false, name: 'Bello' });

    await waitFor(() =>
      expect(storeFns.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'referrer.deactivated', entity_id: 'doc-1' }),
      ),
    );
  });

  it('notifies on deactivate and offers an Undo', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getByRole('button', { name: /deactivate Bello/i }));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.stringMatching(/deactivated/i),
        expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }),
      ),
    );
  });

  it('Undo sends is_active:true with commission carried through', async () => {
    let undoFn: () => void = () => {};
    notify.mockImplementationOnce((_msg: string, opts: any) => {
      undoFn = opts?.action?.run;
    });

    renderScreen();
    await screen.findByText(/Bello/);
    fireEvent.click(screen.getByRole('button', { name: /deactivate Bello/i }));
    await waitFor(() => expect(notify).toHaveBeenCalled());

    // Reset so we can track the undo call
    storeFns.updateReferringDoctor.mockClear();
    storeFns.recordAudit.mockClear();
    undoFn();

    await waitFor(() => expect(storeFns.updateReferringDoctor).toHaveBeenCalled());
    const [, payload] = storeFns.updateReferringDoctor.mock.calls[0]!;
    expect(payload).toMatchObject({ is_active: true, commission_type: 'percentage', commission_value: 10 });

    await waitFor(() =>
      expect(storeFns.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'referrer.reactivated', reverses_id: 'audit-1' }),
      ),
    );
  });

  it('shows inactive referrers with a Reactivate button, not a Deactivate one', async () => {
    renderScreen();
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getByRole('checkbox', { name: /show inactive/i }));
    await screen.findByText(/Adamu/);

    expect(screen.getByRole('button', { name: /reactivate Adamu/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deactivate Adamu/i })).not.toBeInTheDocument();
  });
});
