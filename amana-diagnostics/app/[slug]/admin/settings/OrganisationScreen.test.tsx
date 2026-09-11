import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Characterisation tests for the organisation settings screen.
 *
 * This is where the facility's name and letterhead come from — the top of
 * every printed report. It is edited rarely, by one admin, so what matters is
 * that the form says what it saved, that the fields have names, and that a
 * facility called "Smith & Sons" comes out on paper as Smith & Sons.
 *
 * Written before the rebuild. See decision #28.
 */

// The screen decides local vs cloud mode when its module loads, from the
// hostname — and jsdom's is localhost. Decide before the import runs.
vi.hoisted(() => localStorage.setItem('amana_local_mode', 'false'));

let authState: any;
const refreshOrg = vi.fn(async () => {});
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => authState }));

vi.mock('@/components/RequireRole', () => ({
  default: ({ children }: any) => <>{children}</>,
}));

const update = vi.fn();
const eq = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({ update: (row: any) => { update(row); return { eq }; } }),
  }),
}));

// The designer is a canvas the size of a page; the preview draws it. Both
// have their own tests. Here they only need to say what they were given.
vi.mock('next/dynamic', () => ({
  default: () => (props: { value: string; onChange: (v: string) => void }) => (
    <textarea
      data-testid="designer"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  ),
}));
vi.mock('@/components/LetterheadA4Preview', () => ({
  default: ({ html }: { html: string }) => <div data-testid="preview">{html}</div>,
}));

import OrganisationScreen from './OrganisationScreen';

const org = (over: Record<string, unknown> = {}) => ({
  id: 'org-1',
  slug: 'kano-diagnostics',
  name: 'Kano Diagnostics',
  letterhead_line2: 'AND CLINICAL SERVICES',
  email: 'info@kano.example',
  phone: '+234 800 000 0000',
  address: '1 Hospital Road, Kano',
  letterhead_html: null,
  plan_tier: 'standard',
  ...over,
});

beforeEach(() => {
  update.mockClear();
  eq.mockClear();
  refreshOrg.mockClear();
  localStorage.setItem('amana_local_mode', 'false');
  authState = { organization: org(), refreshOrg, profile: { role: 'admin' } };
});

describe('The organisation settings screen', () => {
  it('names every field', () => {
    render(<OrganisationScreen />);

    expect(screen.getByRole('textbox', { name: /facility name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /line 2/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /address/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /phone/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
  });

  it('starts from what the organisation already has', () => {
    render(<OrganisationScreen />);

    expect(screen.getByRole('textbox', { name: /facility name/i })).toHaveValue('Kano Diagnostics');
    expect(screen.getByRole('textbox', { name: /phone/i })).toHaveValue('+234 800 000 0000');
  });

  /**
   * With no letterhead saved, one is assembled from the facility details by
   * string-building HTML. The name went in raw, so "Smith & Sons" or a
   * facility with a "<" in its name came out mangled on every report.
   */
  it('escapes the facility details in the default letterhead', () => {
    authState.organization = org({ name: 'Smith & Sons <Diagnostics>', address: 'A & B Street' });
    render(<OrganisationScreen />);

    const [header] = screen.getAllByTestId('designer') as HTMLTextAreaElement[];
    expect(header!.value).toContain('SMITH &amp; SONS &lt;DIAGNOSTICS&gt;');
    expect(header!.value).toContain('A &amp; B Street');
    expect(header!.value).not.toContain('<Diagnostics>');
  });

  it('saves the edited name and says so', async () => {
    render(<OrganisationScreen />);

    fireEvent.change(screen.getByRole('textbox', { name: /facility name/i }), {
      target: { value: 'Kano Diagnostics Ltd' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0]![0]).toMatchObject({ name: 'Kano Diagnostics Ltd' });

    // Announced, not just painted green.
    const note = await screen.findByRole('status');
    expect(note).toHaveTextContent(/updated/i);
    expect(refreshOrg).toHaveBeenCalled();
  });

  it('says when saving failed, where a screen reader will hear it', async () => {
    eq.mockResolvedValueOnce({ error: { message: 'row-level security' } } as any);
    render(<OrganisationScreen />);

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const note = await screen.findByRole('alert');
    expect(note).toHaveTextContent(/row-level security/i);
  });

  it('offers header, footer and full-page sections and says which are empty', () => {
    render(<OrganisationScreen />);

    expect(screen.getByRole('button', { name: /^header/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /footer.*none yet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /full page.*none yet/i })).toBeInTheDocument();
  });

  it('shows the workspace id as information, not as an error', () => {
    render(<OrganisationScreen />);

    const id = screen.getByText(/kano-diagnostics/);
    expect(id.closest('[role="alert"]')).toBeNull();
  });
});
