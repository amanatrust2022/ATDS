import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the two referrer directories.
 *
 * Doctors and facilities are near-identical screens — same header, same stat
 * row, same table, same hand-rolled modal — so they are tested together and
 * the differences between them are stated rather than assumed.
 *
 * Written before either was rebuilt. See decision #28.
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
    addReferringDoctor: vi.fn(async (_payload: any, _orgId: string) => {}),
    updateReferringDoctor: vi.fn(async (_id: string, _payload: any) => {}),
    deleteReferringDoctor: vi.fn(async (_id: string) => {}),
    addReferringFacility: vi.fn(async (_payload: any, _orgId: string) => {}),
    updateReferringFacility: vi.fn(async (_id: string, _payload: any) => {}),
    deleteReferringFacility: vi.fn(async (_id: string) => {}),
  },
}));

vi.mock('@/components/Notices', () => ({
  useNotices: () => ({ ask, notify, askFor: vi.fn() }),
}));

vi.mock('@/components/RequireRole', () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/lib/store', async () => {
  const actual = await vi.importActual<any>('@/lib/store');
  return { ...actual, ...storeFns };
});

import { ShellSlotProvider, useShellSlotValue } from '@/components/shell';

import ReferringDoctorsScreen from './doctors/ReferringDoctorsScreen';
import ReferringFacilitiesScreen from './facilities/ReferringFacilitiesScreen';

/**
 * Both screens hand their "Add …" button to the shell header rather than
 * drawing a second one under it, so a bare render has no such button. This
 * stands in for the shell: it renders the slot the screen contributed, which
 * is also the only way to assert the screen contributed anything.
 */
function SlotActions() {
  const { actions } = useShellSlotValue();
  return <div data-testid="shell-actions">{actions}</div>;
}

function renderScreen(Screen: React.ComponentType) {
  return render(
    <ShellSlotProvider>
      <SlotActions />
      <Screen />
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
    id: 'fac-2', organization_id: ORG.id, name: 'Northside Clinic', address: '',
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
  authState = { organization: ORG, profile: { id: 'me', role: 'admin' } };
  storeFns.fetchReferringDoctors.mockResolvedValue(DOCTORS);
  storeFns.fetchReferringFacilities.mockResolvedValue(FACILITIES);
});

/* ========================================================================
 * Doctors
 * ==================================================================== */

describe('Referring doctors', () => {
  // Scoped to the table throughout: the facility filter is a <select> holding
  // the same names, and the stat row has a tile labelled "Active".
  const table = () => within(screen.getByRole('table'));

  it('lists every doctor with their facility and contact details', async () => {
    renderScreen(ReferringDoctorsScreen);
    await screen.findByText(/Bello/);

    expect(table().getByText(/City General/)).toBeInTheDocument();
    expect(table().getByText('08031111111')).toBeInTheDocument();
    // A doctor with no facility is not blank — they are independent.
    expect(table().getByText(/Independent/i)).toBeInTheDocument();
    expect(table().getByText(/Adamu/)).toBeInTheDocument();
  });

  it('shows who is active and who is not', async () => {
    renderScreen(ReferringDoctorsScreen);
    await screen.findByText(/Bello/);

    expect(table().getByText('Active')).toBeInTheDocument();
    expect(table().getByText('Inactive')).toBeInTheDocument();
  });

  it('searches by doctor name and by facility name', async () => {
    renderScreen(ReferringDoctorsScreen);
    await screen.findByText(/Bello/);

    const search = screen.getByPlaceholderText(/search by doctor or facility/i);

    fireEvent.change(search, { target: { value: 'adamu' } });
    await waitFor(() => expect(screen.queryByText(/Bello/)).not.toBeInTheDocument());
    expect(screen.getByText(/Adamu/)).toBeInTheDocument();

    // A facility name finds the doctors who work there.
    fireEvent.change(search, { target: { value: 'city general' } });
    await waitFor(() => expect(screen.getByText(/Bello/)).toBeInTheDocument());
    expect(screen.queryByText(/Adamu/)).not.toBeInTheDocument();
  });

  it('saves a new doctor against the organisation', async () => {
    renderScreen(ReferringDoctorsScreen);
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getByRole('button', { name: /add doctor/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/doctor name/i), {
      target: { value: 'Hauwa Ibrahim' },
    });
    fireEvent.change(within(dialog).getByLabelText(/phone/i), {
      target: { value: '08032222222' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }));

    await waitFor(() => expect(storeFns.addReferringDoctor).toHaveBeenCalled());
    const [payload, orgId] = storeFns.addReferringDoctor.mock.calls[0]!;
    expect(payload).toMatchObject({ name: 'Hauwa Ibrahim', phone: '08032222222', is_active: true });
    expect(orgId).toBe(ORG.id);
    // The list is re-read, rather than the new row being guessed locally.
    expect(storeFns.fetchReferringDoctors).toHaveBeenCalledTimes(2);
  });

  it('refuses to save a doctor with no name', async () => {
    renderScreen(ReferringDoctorsScreen);
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getByRole('button', { name: /add doctor/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }));

    expect(await within(dialog).findByText(/name is required/i)).toBeInTheDocument();
    expect(storeFns.addReferringDoctor).not.toHaveBeenCalled();
  });

  it('edits an existing doctor in place rather than adding a second one', async () => {
    renderScreen(ReferringDoctorsScreen);
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]!);

    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText(/doctor name/i) as HTMLInputElement;
    // The form opens holding that doctor, not blank.
    expect(name.value).toBe('Bello');

    fireEvent.change(name, { target: { value: 'Bello Yusuf' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }));

    await waitFor(() => expect(storeFns.updateReferringDoctor).toHaveBeenCalled());
    const [id, payload] = storeFns.updateReferringDoctor.mock.calls[0]!;
    expect(id).toBe('doc-1');
    expect(payload).toMatchObject({ name: 'Bello Yusuf' });
    expect(storeFns.addReferringDoctor).not.toHaveBeenCalled();
  });

  /**
   * Editing must not quietly zero the commission rate.
   *
   * Nothing on this screen can set it, so the only value it ever holds came
   * from somewhere else. An edit that dropped it would be silent data loss on
   * a field the desk cannot see.
   */
  it('carries the existing commission through an edit untouched', async () => {
    renderScreen(ReferringDoctorsScreen);
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/doctor name/i), {
      target: { value: 'Bello Yusuf' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }));

    await waitFor(() => expect(storeFns.updateReferringDoctor).toHaveBeenCalled());
    const [, payload] = storeFns.updateReferringDoctor.mock.calls[0]!;
    expect(payload).toMatchObject({ commission_type: 'percentage', commission_value: 10 });
  });

  it('asks before deleting, and does not delete when refused', async () => {
    ask.mockResolvedValueOnce(false);
    renderScreen(ReferringDoctorsScreen);
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]!);

    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(storeFns.deleteReferringDoctor).not.toHaveBeenCalled();
  });

  it('deletes once confirmed, and reloads', async () => {
    renderScreen(ReferringDoctorsScreen);
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]!);

    await waitFor(() => expect(storeFns.deleteReferringDoctor).toHaveBeenCalledWith('doc-1'));
    await waitFor(() => expect(storeFns.fetchReferringDoctors).toHaveBeenCalledTimes(2));
  });

  it('says so when a delete fails instead of appearing to succeed', async () => {
    storeFns.deleteReferringDoctor.mockRejectedValueOnce(new Error('still referenced'));
    renderScreen(ReferringDoctorsScreen);
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]!);

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(expect.stringMatching(/still referenced/i), 'error'),
    );
  });

  it('offers only active facilities to link a doctor to', async () => {
    renderScreen(ReferringDoctorsScreen);
    await screen.findByText(/Bello/);

    fireEvent.click(screen.getByRole('button', { name: /add doctor/i }));
    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText(/facility/i);

    expect(within(select).getByRole('option', { name: /City General/ })).toBeInTheDocument();
    // Northside is inactive, so it is not offered for new links.
    expect(within(select).queryByRole('option', { name: /Northside/ })).not.toBeInTheDocument();
  });
});

/* ========================================================================
 * Facilities
 * ==================================================================== */

describe('Referring facilities', () => {
  const table = () => within(screen.getByRole('table'));

  it('lists every facility with its address and contact details', async () => {
    renderScreen(ReferringFacilitiesScreen);
    await screen.findByText(/City General/);

    expect(table().getByText(/12 Clinic Road/)).toBeInTheDocument();
    expect(table().getByText('08030000001')).toBeInTheDocument();
    expect(table().getByText(/Northside Clinic/)).toBeInTheDocument();
  });

  it('saves a new facility against the organisation', async () => {
    renderScreen(ReferringFacilitiesScreen);
    await screen.findByText(/City General/);

    fireEvent.click(screen.getByRole('button', { name: /add facility/i }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/facility name/i), {
      target: { value: 'Eastgate Hospital' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }));

    await waitFor(() => expect(storeFns.addReferringFacility).toHaveBeenCalled());
    const [payload, orgId] = storeFns.addReferringFacility.mock.calls[0]!;
    expect(payload).toMatchObject({ name: 'Eastgate Hospital', is_active: true });
    expect(orgId).toBe(ORG.id);
  });

  it('refuses to save a facility with no name', async () => {
    renderScreen(ReferringFacilitiesScreen);
    await screen.findByText(/City General/);

    fireEvent.click(screen.getByRole('button', { name: /add facility/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }));

    expect(await within(dialog).findByText(/name is required/i)).toBeInTheDocument();
    expect(storeFns.addReferringFacility).not.toHaveBeenCalled();
  });

  it('carries the existing commission through an edit untouched', async () => {
    renderScreen(ReferringFacilitiesScreen);
    await screen.findByText(/City General/);

    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/facility name/i), {
      target: { value: 'City General Hospital' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /save/i }));

    await waitFor(() => expect(storeFns.updateReferringFacility).toHaveBeenCalled());
    const [id, payload] = storeFns.updateReferringFacility.mock.calls[0]!;
    expect(id).toBe('fac-1');
    expect(payload).toMatchObject({ commission_type: 'percentage', commission_value: 10 });
  });

  it('asks before deleting', async () => {
    ask.mockResolvedValueOnce(false);
    renderScreen(ReferringFacilitiesScreen);
    await screen.findByText(/City General/);

    fireEvent.click(screen.getAllByRole('button', { name: /delete/i })[0]!);

    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(storeFns.deleteReferringFacility).not.toHaveBeenCalled();
  });
});
