import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Patient } from '@/lib/store';
import {
  getSlipTemplate,
  getInvoiceTemplate,
  getReceiptAndSlipTemplate,
  RECEIPT_AND_SLIP_ORDER,
} from '@/lib/templates';

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
 *
 * Extended when the two documents became one print job. A visit hands the
 * patient a receipt to keep and a slip to pass on to the department, and the
 * desk was going through the print dialog twice for it. After registration
 * the preview shows both tickets in print order and prints both in one go;
 * from the queue it shows one at a time, for a reprint.
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
const slipTab = () => screen.getByRole('button', { name: /^request slip$/i });
const printButton = () => screen.getByRole('button', { name: /^print/i });
const slipPaper = () => screen.getByTestId('document-preview-slip');
const receiptPaper = () => screen.getByTestId('document-preview-receipt');

/** The inner HTML of each ticket in a printed document, in print order. */
const tickets = (html: string) =>
  Array.from(html.matchAll(/<div class="ticket">([\s\S]*?)<\/div>\s*(?=<div class="ticket">|<\/body>)/g)).map(
    (m) => m[1],
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('The printed slip and receipt', () => {
  it('names the patient the same way the printer will', () => {
    render(<SlipModal patient={patient()} purpose="register" org={FULL_ORG} onClose={() => {}} />);

    // The preview read `patient.name`, which is blank on every real patient —
    // so the slip on screen had no name on it at all, while the paper did.
    expect(within(slipPaper()).getByText(/Hauwa Aisha Ibrahim/)).toBeInTheDocument();
    expect(within(receiptPaper()).getByText(/Hauwa Aisha Ibrahim/)).toBeInTheDocument();
  });

  it('never puts another clinic on a clinic that has filled nothing in', () => {
    render(<SlipModal patient={patient()} purpose="register" org={BARE_ORG} onClose={() => {}} />);
    const shown = [slipPaper(), receiptPaper()].map((p) => p.textContent || '').join('\n');

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
    render(<SlipModal patient={patient()} purpose="register" org={FULL_ORG} onClose={() => {}} />);

    // The printed page turns the newline into a <br>. The preview rendered the
    // raw string, running it together into "4 Riverside WayKano" — so each
    // line has to be its own element, which textContent cannot tell you.
    expect(within(slipPaper()).getByText('4 Riverside Way')).toBeInTheDocument();
    expect(within(slipPaper()).getByText('Kano')).toBeInTheDocument();
  });

  it('shows the specimen the printed page shows', () => {
    render(<SlipModal patient={patient()} purpose="register" org={FULL_ORG} onClose={() => {}} />);

    // Whole Blood comes from the catalogue, not the visit row. The printed
    // slip falls back to the catalogue; the preview did not, so it showed a
    // dash where the paper named the specimen.
    expect(within(slipPaper()).getAllByText(/Whole Blood/).length).toBeGreaterThan(0);
  });

  it('calls the receipt what the receipt calls itself', () => {
    render(<SlipModal patient={patient()} purpose="register" org={FULL_ORG} onClose={() => {}} />);

    const printed = getInvoiceTemplate(patient(), FULL_ORG as any);
    const heading = printed.match(/class="slip-title[^"]*">([^<]+)</)?.[1]?.trim();

    expect(heading).toBeTruthy();
    expect(within(receiptPaper()).getByText(heading!)).toBeInTheDocument();
  });

  it('shows the money the same on screen and on paper', () => {
    render(<SlipModal patient={patient()} purpose="register" org={FULL_ORG} onClose={() => {}} />);
    const shown = receiptPaper().textContent || '';

    // Subtotal, the discount line, net, paid and what is still owed.
    expect(shown).toMatch(/12,000\.00/);
    expect(shown).toMatch(/1,200\.00/);
    expect(shown).toMatch(/10,800\.00/);
    expect(shown).toMatch(/5,000\.00/);
    expect(shown).toMatch(/5,800\.00/);
  });

  it('lists every test that was ordered', () => {
    render(<SlipModal patient={patient()} purpose="register" org={FULL_ORG} onClose={() => {}} />);

    expect(within(slipPaper()).getByText('Full Blood Count')).toBeInTheDocument();
    expect(within(slipPaper()).getByText('Chest X-Ray')).toBeInTheDocument();
    expect(within(slipPaper()).getByText(/TESTS ORDERED \(2\)/)).toBeInTheDocument();
  });
});

describe('Printing the receipt and the slip together', () => {
  it('shows both tickets after registration, in the order they will come out of the printer', () => {
    render(<SlipModal patient={patient()} purpose="register" org={FULL_ORG} onClose={() => {}} />);

    const sheets = screen.getAllByRole('figure');
    expect(sheets).toHaveLength(2);
    // The receipt sits on top of the pair the patient is handed.
    expect(RECEIPT_AND_SLIP_ORDER).toEqual(['receipt', 'slip']);
    expect(within(sheets[0]!).getByTestId('document-preview-receipt')).toBeInTheDocument();
    expect(within(sheets[1]!).getByTestId('document-preview-slip')).toBeInTheDocument();
  });

  it('prints both in one job, with no tabs to choose between them', () => {
    render(<SlipModal patient={patient()} purpose="register" org={FULL_ORG} onClose={() => {}} />);

    expect(screen.queryByRole('group', { name: /which document/i })).not.toBeInTheDocument();
    expect(printButton()).toHaveTextContent(/print both/i);
    fireEvent.click(printButton());

    expect(printHtml).toHaveBeenCalledTimes(1);
    expect(printHtml).toHaveBeenCalledWith(getReceiptAndSlipTemplate(patient(), FULL_ORG as any));
  });

  it('puts a page break between the two tickets so the printer cuts there', () => {
    const html = getReceiptAndSlipTemplate(patient(), FULL_ORG as any);

    expect(tickets(html)).toHaveLength(2);
    expect(html).toMatch(/\.ticket \+ \.ticket \{[^}]*break-before: page/);
    // Receipt first, then the slip.
    expect(html.indexOf('PAYMENT RECEIPT / INVOICE')).toBeLessThan(html.indexOf('INVESTIGATION SLIP'));
  });

  it('is exactly the two tickets that print on their own', () => {
    const both = getReceiptAndSlipTemplate(patient(), FULL_ORG as any);
    const receiptAlone = tickets(getInvoiceTemplate(patient(), FULL_ORG as any));
    const slipAlone = tickets(getSlipTemplate(patient(), FULL_ORG as any));

    expect(receiptAlone).toHaveLength(1);
    expect(slipAlone).toHaveLength(1);
    expect(tickets(both)).toEqual([...receiptAlone, ...slipAlone]);
  });

  it('tells the patient which ticket to keep and where the other one goes', () => {
    render(<SlipModal patient={patient()} purpose="register" org={FULL_ORG} onClose={() => {}} />);

    // Two departments on this visit, so the slip names both.
    expect(within(receiptPaper()).getByText(/patient copy — please keep/i)).toBeInTheDocument();
    expect(
      within(slipPaper()).getByText(/department copy — hand in at lab & radiology/i),
    ).toBeInTheDocument();

    // And the paper says the same thing.
    const html = getReceiptAndSlipTemplate(patient(), FULL_ORG as any);
    expect(html).toMatch(/Patient copy — please keep/);
    expect(html).toMatch(/Department copy — hand in at Lab & Radiology/);
  });

  it('names only the department the tests actually go to', () => {
    const labOnly = patient({ tests: patient().tests.filter((t) => t.department === 'lab') });
    render(<SlipModal patient={labOnly} purpose="register" org={FULL_ORG} onClose={() => {}} />);

    expect(within(slipPaper()).getByText(/hand in at lab$/i)).toBeInTheDocument();
    expect(getSlipTemplate(labOnly, FULL_ORG as any)).toMatch(/hand in at Lab</);
  });

});

describe('Reprinting from the queue', () => {
  const reprint = () =>
    render(<SlipModal patient={patient()} purpose="reprint" org={FULL_ORG} onClose={() => {}} />);

  it('opens on the slip alone, with a tab for each document', () => {
    reprint();

    expect(screen.getByRole('group', { name: /which document/i })).toBeInTheDocument();
    expect(slipTab()).toHaveAttribute('aria-pressed', 'true');
    expect(slipPaper()).toBeInTheDocument();
    expect(screen.queryByTestId('document-preview-receipt')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^both$/i })).not.toBeInTheDocument();
  });

  it('prints the slip on its own', () => {
    reprint();

    expect(printButton()).toHaveTextContent(/print slip/i);
    fireEvent.click(printButton());
    expect(printHtml).toHaveBeenCalledWith(getSlipTemplate(patient(), FULL_ORG as any));
  });

  it('prints the receipt on its own once the receipt tab is up', () => {
    reprint();
    fireEvent.click(receiptTab());

    expect(receiptPaper()).toBeInTheDocument();
    expect(screen.queryByTestId('document-preview-slip')).not.toBeInTheDocument();
    expect(printButton()).toHaveTextContent(/print receipt/i);
    fireEvent.click(printButton());
    expect(printHtml).toHaveBeenCalledWith(getInvoiceTemplate(patient(), FULL_ORG as any));
  });
});
