import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Characterisation tests for the staff admin screen.
 *
 * Written against `app/[slug]/admin/staff/StaffScreen.tsx` BEFORE it is split
 * into components. At 1,690 lines it is the largest screen left, it carries
 * 199 inline style objects, and it computes a whole performance dashboard
 * inside a JSX expression. These describe what an administrator can do, so the
 * split has something to fail against.
 *
 * Three earlier extractions in this repo copied state instead of moving it and
 * shipped dead buttons behind a green build. That is what these are for.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

const ORG = { id: 'org-1', name: 'Riverside Diagnostics', slug: 'riverside' };
const ME = { id: 'me', full_name: 'Dr. Ada Grace Okoye', role: 'admin' };

let authState: any;
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));

const ask = vi.fn(async () => true);
vi.mock('@/components/Notices', () => ({
  useNotices: () => ({ ask, notify: vi.fn(), askFor: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'riverside' }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/lib/templates', () => ({ printHtml: vi.fn() }));

// RequireRole would otherwise need a whole auth story of its own; the role
// check is covered where it lives.
vi.mock('@/components/RequireRole', () => ({
  default: ({ children }: any) => <>{children}</>,
}));

/** Rows the fake Supabase answers with, per table. */
let tables: Record<string, any[]> = {};
const inserted: any[] = [];

function query(table: string) {
  const chain: any = {};
  for (const m of ['select', 'eq', 'is', 'order', 'update', 'delete']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.insert = vi.fn((rows: any[]) => {
    inserted.push({ table, rows });
    return chain;
  });
  chain.then = (resolve: any) =>
    Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve);
  return chain;
}

const channel = {
  on: vi.fn(() => channel),
  subscribe: vi.fn(() => channel),
};

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (table: string) => query(table),
    auth: { getUser: async () => ({ data: { user: { id: 'me' } } }) },
    channel: () => channel,
    removeChannel: vi.fn(),
  }),
}));

import StaffScreen from './StaffScreen';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const STAFF = [
  { id: 'me', full_name: 'Dr. Ada Grace Okoye', email: 'ada@clinic.test', role: 'admin', signature_url: 'sig.png' },
  { id: 's2', full_name: 'Bala Yusuf', email: 'bala@clinic.test', role: 'lab', signature_url: null },
];

const INVITES = [
  { id: 'i1', email: 'new@clinic.test', role: 'reception', token: 'tok-123', expires_at: '2026-10-01T00:00:00.000Z' },
];

beforeEach(() => {
  authState = { profile: ME, organization: ORG };
  tables = { profiles: STAFF, invitations: INVITES };
  inserted.length = 0;
  ask.mockClear();
  localStorage.clear();
  // Cloud mode: the local-mode branch reads staff over /api/profiles instead,
  // which is the same list by a different route.
  localStorage.setItem('amana_local_mode', 'false');

  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── The directory ────────────────────────────────────────────────────────────

describe('the team directory', () => {
  it('lists everyone with their address and whether they can sign a report', async () => {
    render(<StaffScreen />);

    expect(await screen.findByText('Bala Yusuf')).toBeTruthy();
    expect(screen.getByText('bala@clinic.test')).toBeTruthy();
    // Ada has a signature on file; Bala does not. A report cannot be released
    // without one, so this column is the point of the screen.
    expect(screen.getByText('Configured')).toBeTruthy();
    expect(screen.getByText('Not Uploaded')).toBeTruthy();
  });

  it('will not let an administrator change their own role', async () => {
    render(<StaffScreen />);
    await screen.findByText('Bala Yusuf');

    const selects = screen.getAllByRole('combobox');
    const mine = selects.find((s) => (s as HTMLSelectElement).value === 'admin')!;
    expect(mine).toBeDisabled();
  });

  it('sends a role change to the staff endpoint', async () => {
    render(<StaffScreen />);
    await screen.findByText('Bala Yusuf');

    const balaSelect = screen
      .getAllByRole('combobox')
      .find((s) => (s as HTMLSelectElement).value === 'lab')!;
    fireEvent.change(balaSelect, { target: { value: 'radiology' } });

    await waitFor(() => {
      const call = (fetch as any).mock.calls.find((c: any[]) =>
        String(c[0]).includes('/api/staff/update'),
      );
      expect(call, 'no call to /api/staff/update').toBeTruthy();
      expect(JSON.parse(call[1].body)).toMatchObject({
        action: 'update_role',
        staffId: 's2',
        role: 'radiology',
      });
    });
  });
});

// ── Invitations ──────────────────────────────────────────────────────────────

describe('inviting someone', () => {
  it('records the invitation and shows a link on this deployment', async () => {
    render(<StaffScreen />);
    await screen.findByText('Bala Yusuf');

    fireEvent.change(screen.getByPlaceholderText('staff@example.com'), {
      target: { value: 'New@Clinic.test ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate Invite Link/i }));

    await waitFor(() => expect(inserted.length).toBe(1));
    const row = inserted[0].rows[0];
    expect(inserted[0].table).toBe('invitations');
    // Addresses are matched on later, so they are stored lowercased and trimmed.
    expect(row.email).toBe('new@clinic.test');
    expect(row.organization_id).toBe('org-1');
    expect(row.expires_at).toBeTruthy();

    // The link must be on the origin the browser is actually on. It used to be
    // a hard-coded domain, so on any other deployment it pointed elsewhere.
    // Two now: the pending invitation already on file, and the one just made.
    await waitFor(() => {
      const links = screen.getAllByDisplayValue(
        new RegExp(`^${window.location.origin}/invite/`),
      );
      expect(links).toHaveLength(2);
      expect(links.some((el) => !(el as HTMLInputElement).value.endsWith('tok-123'))).toBe(true);
    });
  });

  it('shows a pending invitation with a copyable link on this deployment', async () => {
    render(<StaffScreen />);
    await screen.findByText('new@clinic.test');

    expect(
      screen.getByDisplayValue(`${window.location.origin}/invite/tok-123`),
    ).toBeTruthy();
  });

  it('copies that link to the clipboard', async () => {
    render(<StaffScreen />);
    await screen.findByText('new@clinic.test');

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/invite/tok-123`,
    );
  });
});

// ── The profile panel ────────────────────────────────────────────────────────

describe('opening someone profile', () => {
  it('breaks a full name into its parts', async () => {
    render(<StaffScreen />);
    const row = (await screen.findByText('Dr. Ada Grace Okoye')).closest('tr')!;
    fireEvent.click(row);

    const panel = await screen.findByText('Name Details');
    const box = panel.parentElement!;
    // 'Dr. Ada Grace Okoye' — title, first, middle, surname.
    expect(within(box).getByText('Dr.')).toBeTruthy();
    expect(within(box).getByText('Ada')).toBeTruthy();
    expect(within(box).getByText('Grace')).toBeTruthy();
    expect(within(box).getByText('Okoye')).toBeTruthy();
  });
});

// ── The performance tab ──────────────────────────────────────────────────────

describe('the performance dashboard', () => {
  it('is not fetched until the tab is opened', async () => {
    render(<StaffScreen />);
    await screen.findByText('Bala Yusuf');

    const calls = () =>
      (fetch as any).mock.calls.filter((c: any[]) =>
        String(c[0]).includes('/api/admin/performance'),
      );
    expect(calls()).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /Performance Dashboard/i }));
    await waitFor(() => expect(calls().length).toBeGreaterThan(0));
    expect(String(calls()[0][0])).toContain('organizationId=org-1');
  });

  it('survives a response that is missing its arrays', async () => {
    // The dashboard reads perfData.completedTests.filter(...) directly and the
    // only guard was `!perfData`, so `{}` threw during render and took the
    // whole admin screen to a blank page.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })),
    );

    render(<StaffScreen />);
    await screen.findByText('Bala Yusuf');
    fireEvent.click(screen.getByRole('button', { name: /Performance Dashboard/i }));

    // Still standing: the tab strip is on the page rather than a blank body.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Team Directory/i })).toBeTruthy(),
    );
  });
});
