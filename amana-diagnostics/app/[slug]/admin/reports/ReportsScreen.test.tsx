import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const org = { id: 'org-1', slug: 'kano', name: 'Kano Diagnostics' };
const profile = { id: 'admin-1', full_name: 'Admin User', role: 'admin' };
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ organization: org, profile }) }));
vi.mock('@/components/RequireRole', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('next/navigation', () => ({ useParams: () => ({ slug: 'kano' }) }));
vi.mock('@/components/shell', () => ({ useShellSlot: vi.fn() }));
vi.mock('@/lib/authHeaders', () => ({
  bearerHeaders: async () => ({ Authorization: 'Bearer admin-token' }),
  jsonAuthHeaders: async () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' }),
}));
vi.mock('@/lib/useRuntimeMode', () => ({ useRuntimeMode: () => 'cloud' }));
vi.mock('@/lib/cloudOrigin', () => ({ apiBase: () => '' }));
const fetchStaff = vi.fn(async () => [{ id: 's1', full_name: 'Amina Bello', role: 'lab', email: 'amina@clinic.test', signature_url: null }]);
const fetchCommissionReport = vi.fn(async () => []);
vi.mock('@/lib/store', () => ({ fetchStaff: (...args: []) => fetchStaff(...args), fetchCommissionReport: (...args: []) => fetchCommissionReport(...args) }));
vi.mock('@/lib/templates', () => ({ printHtml: vi.fn() }));

import ReportsScreen from './ReportsScreen';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

describe('Reports', () => {
  it('loads a bounded report with the admin session and tolerates absent arrays', async () => {
    const { container } = render(<ReportsScreen />);
    await waitFor(() => expect(fetchStaff).toHaveBeenCalledWith('org-1'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, options] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('organizationId=org-1&since=');
    expect(options?.headers).toEqual({ Authorization: 'Bearer admin-token' });
    expect(screen.getByRole('tab', { name: /workload and revenue/i })).toBeInTheDocument();
    expect(container.querySelector('h1')).toBeNull();
  });

  it('loads commissions only when ageing is opened', async () => {
    render(<ReportsScreen />);
    expect(fetchCommissionReport).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /commission owed/i }));
    await waitFor(() => expect(fetchCommissionReport).toHaveBeenCalledWith('org-1'));
    expect(await screen.findByText('Nothing is owed')).toBeInTheDocument();
  });

  it('announces a failed report request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Please sign in again' }), { status: 401 })));
    render(<ReportsScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Please sign in again');
    expect(screen.queryByText('Billed')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(await screen.findByText('Amina Bello')).toBeInTheDocument();
  });

  it('uses neutral tones for the summary report blocks instead of blue accent colours', async () => {
    render(<ReportsScreen />);
    await screen.findByText('Amina Bello');
    expect(document.querySelector('[data-tone="info"]')).toBeNull();
    expect(document.querySelector('[data-tone="accent"]')).toBeNull();
  });

  it('opens the selected staff details', async () => {
    render(<ReportsScreen />);
    fireEvent.click(await screen.findByText('Amina Bello'));
    expect(await screen.findByRole('dialog', { name: 'Amina Bello' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Manage people' })).toHaveAttribute('href', '/kano/admin/staff');
  });

  it('assigns a percentage commission from the staff performance profile', async () => {
    render(<ReportsScreen />);
    fireEvent.click(await screen.findByText('Amina Bello'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Commission plan' }), { target: { value: 'percentage' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Commission percentage' }), { target: { value: '7.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save commission plan' }));

    await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(1));
    const [url, options] = vi.mocked(fetch).mock.calls.at(-1)!;
    expect(url).toBe('/api/staff/update');
    expect(options?.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' });
    expect(JSON.parse(String(options?.body))).toMatchObject({
      action: 'update_performance_commission',
      staffId: 's1',
      performanceCommissionType: 'percentage',
      performanceCommissionValue: 7.5,
    });
    expect(await screen.findByText('Commission plan saved.')).toBeInTheDocument();
  });
});
