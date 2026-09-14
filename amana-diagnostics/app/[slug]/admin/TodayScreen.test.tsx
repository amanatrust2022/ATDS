import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TodayPayload } from '@/lib/today';

vi.hoisted(() => {
  localStorage.setItem('amana_local_mode', 'false');
});

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    organization: { id: 'org-1', name: 'Kano Diagnostics', slug: 'kano' },
    session: { access_token: 'tok' },
  }),
}));
vi.mock('@/components/RequireRole', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'kano' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/authHeaders', () => ({
  bearerHeaders: async () => ({ Authorization: 'Bearer tok' }),
  jsonAuthHeaders: async () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' }),
}));

const subscribers: Array<() => void> = [];
vi.mock('@/lib/store', () => ({
  subscribeToPatients: (_org: string, cb: () => void) => {
    subscribers.push(cb);
    return () => {
      const i = subscribers.indexOf(cb);
      if (i >= 0) subscribers.splice(i, 1);
    };
  },
}));

let syncState: any = null;
vi.mock('@/lib/sync/useSyncState', () => ({ useSyncState: () => syncState }));

import { NoticeProvider } from '@/components/Notices';
import { ShellSlotProvider, useShellSlotValue } from '@/components/shell';
import TodayScreen from './TodayScreen';

function SlotActions() {
  const { actions } = useShellSlotValue();
  return <div data-testid="slot-actions">{actions}</div>;
}

function renderScreen() {
  return render(
    <NoticeProvider>
      <ShellSlotProvider>
        <SlotActions />
        <TodayScreen />
      </ShellSlotProvider>
    </NoticeProvider>,
  );
}

const NOW = new Date();
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

function payload(over: Partial<TodayPayload> = {}): TodayPayload {
  return {
    generatedAt: NOW.toISOString(),
    since: minutesAgo(61 * 24 * 60),
    visits: [
      {
        id: 'v1', slip_number: 'RD-1', registered_at: minutesAgo(40), first_name: 'Ada', surname: 'Okafor',
        referred_by: null, referring_doctor_id: null, referring_facility_id: null,
        commission_assigned: false, commission_amount: 0, commission_status: null, commission_paid_at: null,
        net_amount: 12000, paid_amount: 12000, payment_status: 'paid', payment_method: 'cash',
      },
      {
        id: 'v2', slip_number: 'RD-2', registered_at: minutesAgo(30), first_name: 'Bala', surname: 'Yusuf',
        referred_by: null, referring_doctor_id: null, referring_facility_id: null,
        commission_assigned: false, commission_amount: 0, commission_status: null, commission_paid_at: null,
        net_amount: 5000, paid_amount: 1000, payment_status: 'partial', payment_method: 'cash',
      },
    ],
    tests: [],
    ledger: [],
    charges: [],
    staff: [],
    doctors: [],
    facilities: [],
    pendingTests: [],
    invites: null,
    truncated: { unpaid: false, pendingCommission: false, unfinished: false },
    ...over,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;
const respond = (body: unknown, ok = true, status = 200) =>
  Promise.resolve({ ok, status, json: async () => body } as Response);

beforeEach(() => {
  subscribers.length = 0;
  syncState = null;
  localStorage.removeItem('amana_today_period');
  fetchMock = vi.fn(() => respond(payload()));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Today', () => {
  it('draws no page heading of its own, and never a zero while loading', async () => {
    let resolve!: (v: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((r) => (resolve = r)));
    renderScreen();

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading Billed' })).toBeInTheDocument();
    expect(screen.queryByText('₦0')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();

    // The fetch is made after the bearer token is read, so it is not yet in
    // flight the instant the screen mounts.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {
      resolve({ ok: true, status: 200, json: async () => payload() } as Response);
    });
    expect(await screen.findByText('₦17,000')).toBeInTheDocument();
  });

  it('puts the period control in the shell header and remembers the choice', async () => {
    renderScreen();
    await screen.findByText('₦17,000');

    const slot = screen.getByTestId('slot-actions');
    expect(slot).toHaveTextContent('Today');
    expect(slot).toHaveTextContent('7 days');
    expect(slot).toHaveTextContent('30 days');

    fireEvent.click(screen.getByText('7 days'));
    expect(localStorage.getItem('amana_today_period')).toBe('7days');
  });

  it('lists an unpaid visit as something to act on, linking to that patient', async () => {
    renderScreen();
    const row = await screen.findByRole('link', { name: '₦4,000 unpaid — Bala Yusuf' });
    expect(row).toHaveAttribute('href', '/kano/admin/patients?patient=v2');
  });

  it('shows the failure and lets the administrator try again', async () => {
    fetchMock.mockImplementationOnce(() => respond({ error: 'Administrator access required' }, false, 403));
    renderScreen();

    // The notice stack has an (empty) alert region of its own; find ours by its title.
    expect(await screen.findByText('The figures could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Administrator access required')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('₦17,000')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes when the building changes, keeping the old figures up meanwhile', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderScreen();
    await screen.findByText('₦17,000');
    expect(subscribers).toHaveLength(1);

    fetchMock.mockImplementationOnce(() =>
      respond(payload({ visits: [{ ...payload().visits[0]!, net_amount: 20000 }] })),
    );
    act(() => {
      subscribers[0]!();
    });
    // Debounced: the old figure is still there right after the doorbell.
    expect(screen.getByText('₦17,000')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(await screen.findByText('₦20,000')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('on a hub with stuck changes, offers to run the sync from the row', async () => {
    syncState = {
      enabled: true,
      connectivity: 'online',
      status: 'needs_attention',
      deadLetterCount: 2,
      deadPullRows: 0,
      pendingCount: 0,
      lastOnlineAt: NOW.getTime(),
    };
    renderScreen();
    await screen.findByText('₦17,000');

    expect(screen.getByRole('link', { name: 'Some changes are not reaching the cloud' })).toBeInTheDocument();
    fetchMock.mockImplementationOnce(() => respond({ ok: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Run sync now' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find((c) => c[0] === '/api/sync');
      expect(call).toBeTruthy();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toMatchObject({
        organizationId: 'org-1',
        action: 'requeue',
      });
    });
  });

  it('says when a figure is a floor because the rows were cut', async () => {
    fetchMock.mockImplementationOnce(() =>
      respond(payload({ truncated: { unpaid: true, pendingCommission: false, unfinished: false } })),
    );
    renderScreen();
    expect(await screen.findByRole('note')).toHaveTextContent('the unpaid visits');
  });

  it('says so when nothing needs attention', async () => {
    fetchMock.mockImplementationOnce(() =>
      respond(payload({ visits: [{ ...payload().visits[0]! }] })),
    );
    renderScreen();
    expect(await screen.findByText(/Nothing needs you/)).toBeInTheDocument();
  });
});
