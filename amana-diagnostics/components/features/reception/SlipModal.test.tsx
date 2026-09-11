import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Patient } from '@/lib/store';
import { getSlipTemplate, getInvoiceTemplate } from '@/lib/templates';

/**
 * Characterisation tests for the slip and receipt the patient walks out with.
 *
 * This screen shows a preview and then prints. The preview is hand-drawn JSX
 * and the printed page is an HTML string in lib/templates.ts — two separate
 * descriptions of the same piece of paper. Nothing has ever held them
 * together, so most of what follows is about whether what the desk approves on
 * screen is what actually comes out of the printer.
 *
 * Written before the rebuild. See decision #28.
 */

const printHtml = vi.hoisted(() => vi.fn());
vi.mock('@/lib/templates', async () => {
  const actual = await vi.importActual<any>('@/lib/templates');
  return { ...actual, printHtml };
});

import SlipModal from './SlipModal';

/** A clinic that has filled nothing in but its name. */
const BARE_ORG = { name: 'Riverside Diagnostics' };

const FULL_ORG = {
  name: 'Riverside Diagnostics',
  letterhead_line2: 'and Clinical Services',
  address: '4 Riverside Way\nKano',
  phone: 'Tel: 0800 000 0000',
};

function patient(over: Partial<Patient> = {}): Patient {
  return {
    id: 1,
    slipNumber: 'RD-0001',
    registeredAt: '2026-03-04T09:00:00.000Z',
    // No `name`. The column does not exist — it is derived from the parts at
    // read time, so anything real arrives here exactly like this.
    name: '',
    firstName: 'Hauwa',
    middleName: 'Aisha',
    surname: 'Ibrahim',
    age: '34',
    sex: 'Female',
    phone: '08030000000',
    address: '',
    referredBy: '',
    totalAmount: 12000,
    discountType: 'percentage',
    discountValue: 10,
    discountAmount: 1200,
    netAmount: 10800,
    paidAmount: 5000,
    paymentStatus: 'partial',
    paymentMethod: 'transfer',
    tests: [
      {
        testId: 'fbc',
        testName: 'Full Blood Count',
        department: 'lab',
        price: 4000,
        status: 'pending',
        // Deliberately absent. Registered before the column was filled in, so
        // the specimen has to come from the catalogue.
      },
      {
        testId: 'cxr',
        testName: 'Chest X-Ray',
        department: 'radiology',
        price: 8000,
        status: 'pending',
      },
    ] as any,
    ...over,
  } as Patient;
}

const receiptTab = () => screen.getByRole('button', { name: /^receipt$/i });
const paper = () => screen.getByTestId('document-preview');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('The printed slip and receipt', () => {
  it('names the patient the same way the printer will', () => {
    render(<SlipModal patient={patient()} org={FULL_ORG} onClose={() => {}} />);

    // The preview read `patient.name`, which is blank on every real patient —
    // so the slip on screen had no name on it at all, while the paper did.
    expect(within(paper()).getByText(/Hauwa Aisha Ibrahim/)).toBeInTheDocument();
  });

  it('never puts another clinic on a clinic that has filled nothing in', () => {
    render(<SlipModal patient={patient()} org={BARE_ORG} onClose={() => {}} />);
    const shown = paper().textContent || '';

    const printed = getSlipTemplate(patient(), BARE_ORG as any);
    const receipt = getInvoiceTemplate(patient(), BARE_ORG as any);

    // The print templates defaulted the address, the phone and the second
    // letterhead line to one real clinic's details. Every other tenant that
    // had not filled its address in printed that clinic's address on its own
    // slips — and the preview, which defaulted to blank, never showed it.
    for (const doc of [shown, printed, receipt]) {
      expect(doc).not.toMatch(/Tudun Wada/i);
      expect(doc).not.toMatch(/Nasarawa/i);
      expect(doc).not.toMatch(/08033390574/);
      expect(doc).not.toMatch(/AND CLINICAL SERVICES LTD/i);
    }
  });

  it('breaks a two-line address over two lines, as the printed page does', () => {
    render(<SlipModal patient={patient()} org={FULL_ORG} onClose={() => {}} />);

    // The printed page turns the newline into a <br>. The preview rendered the
    // raw string, running it together into "4 Riverside WayKano" — so each
    // line has to be its own element, which textContent cannot tell you.
    expect(within(paper()).getByText('4 Riverside Way')).toBeInTheDocument();
    expect(within(paper()).getByText('Kano')).toBeInTheDocument();
  });

  it('shows the specimen the printed page shows', () => {
    render(<SlipModal patient={patient()} org={FULL_ORG} onClose={() => {}} />);

    // Whole Blood comes from the catalogue, not the visit row. The printed
    // slip falls back to the catalogue; the preview did not, so it showed a
    // dash where the paper named the specimen.
    expect(within(paper()).getAllByText(/Whole Blood/).length).toBeGreaterThan(0);
  });

  it('calls the receipt what the receipt calls itself', () => {
    render(<SlipModal patient={patient()} org={FULL_ORG} onClose={() => {}} />);
    fireEvent.click(receiptTab());

    const printed = getInvoiceTemplate(patient(), FULL_ORG as any);
    const heading = printed.match(/class="slip-title">([^<]+)</)?.[1]?.trim();

    expect(heading).toBeTruthy();
    expect(within(paper()).getByText(heading!)).toBeInTheDocument();
  });

  it('shows the money the same on screen and on paper', () => {
    render(<SlipModal patient={patient()} org={FULL_ORG} onClose={() => {}} />);
    fireEvent.click(receiptTab());
    const shown = paper().textContent || '';

    // Subtotal, the discount line, net, paid and what is still owed.
    expect(shown).toMatch(/12,000\.00/);
    expect(shown).toMatch(/1,200\.00/);
    expect(shown).toMatch(/10,800\.00/);
    expect(shown).toMatch(/5,000\.00/);
    expect(shown).toMatch(/5,800\.00/);
  });

  it('prints the document that is on screen', () => {
    render(<SlipModal patient={patient()} org={FULL_ORG} onClose={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /print/i }));
    expect(printHtml).toHaveBeenCalledWith(getSlipTemplate(patient(), FULL_ORG as any));
  });

  it('prints the receipt once the receipt is the one on screen', () => {
    render(<SlipModal patient={patient()} org={FULL_ORG} onClose={() => {}} />);
    fireEvent.click(receiptTab());

    fireEvent.click(screen.getByRole('button', { name: /print/i }));
    expect(printHtml).toHaveBeenCalledWith(getInvoiceTemplate(patient(), FULL_ORG as any));
  });

  it('lists every test that was ordered', () => {
    render(<SlipModal patient={patient()} org={FULL_ORG} onClose={() => {}} />);

    expect(within(paper()).getByText('Full Blood Count')).toBeInTheDocument();
    expect(within(paper()).getByText('Chest X-Ray')).toBeInTheDocument();
    expect(within(paper()).getByText(/TESTS ORDERED \(2\)/)).toBeInTheDocument();
  });
});
