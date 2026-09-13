'use client';

import { useState } from 'react';
import { RiPrinterLine } from '@remixicon/react';
import type { Patient, PatientTest } from '@/lib/store';
import {
  getSlipTemplate,
  getInvoiceTemplate,
  getReceiptAndSlipTemplate,
  printHtml,
  specimenOf,
  slipCopyTag,
  slipDestination,
  RECEIPT_COPY_TAG,
  RECEIPT_AND_SLIP_ORDER,
  type OrgForTemplate,
} from '@/lib/templates';
import { patientDisplayName } from '@/lib/store/patientName';
import { letterheadFor, addressLines } from '@/lib/letterhead';
import { Button, Dialog, SegmentedControl } from '@/components/ui';
import styles from './DocumentPreview.module.css';

/**
 * The payment receipt and the request slip, previewed before printing.
 *
 * A visit hands the patient two pieces of paper: a receipt to keep and a slip
 * to hand in at the department. This used to be two documents behind one tab
 * switcher, printed one at a time — the desk approved a slip, printed it,
 * reopened the dialog, switched to the receipt, printed that.
 *
 * It now has two purposes, and the caller says which:
 *
 *   register — straight after a patient is saved. Both tickets, side by side
 *              in the order they come off the printer, no tabs, and one press
 *              sends both as a single print job with a page break between.
 *   reprint  — from the queue, for a lost slip or a second receipt. One
 *              document at a time behind a two-way switcher, and the button
 *              says which it will print.
 *
 * Lifted out of ReceptionPage, where it was one of 18 hand-rolled overlays:
 * a fixed div over an rgba() scrim, with no focus trap, no Escape, no scroll
 * lock, and no way back to the button that opened it. That chrome is now
 * Dialog, and the switcher is a real SegmentedControl.
 *
 * The preview is a facsimile of a piece of paper, so its black-on-white is the
 * paper's and must not follow the viewer's theme. The captions above each
 * sheet are app chrome and do.
 *
 * What it shows is derived exactly as the printed page derives it. It used to
 * be a second, hand-written description of the same document, and the two had
 * already parted: the preview read `patient.name`, which is blank on every
 * real patient because the column does not exist, so the slip on screen had
 * no name on it while the paper did; it read the specimen off the visit row
 * where the printer falls back to the catalogue; it ran a two-line address
 * onto one line; and it called the receipt something the receipt does not
 * call itself. Everything on the paper now comes from one place, so the desk
 * approves what the patient is actually handed.
 */
type Ticket = (typeof RECEIPT_AND_SLIP_ORDER)[number];
export type SlipModalPurpose = 'register' | 'reprint';

const money = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

function Letterhead({ org }: { org?: OrgForTemplate | null }) {
  const head = letterheadFor(org);
  return (
    <div className={styles['head']}>
      <div className={styles['orgName']}>{head.name.toUpperCase()}</div>
      {head.line2 && <div className={styles['orgLine2']}>{head.line2.toUpperCase()}</div>}
      {/* One line per line the clinic typed, as the printed page does. */}
      {addressLines(head.address).map((line) => (
        <div key={line} className={styles['orgMeta']}>
          {line}
        </div>
      ))}
      {head.phone && <div className={styles['orgMeta']}>{head.phone}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles['row']}>
      <span className={styles['rowLabel']}>{label}:</span>
      <span className={styles['rowValue']}>{value}</span>
    </div>
  );
}

function Foot({ org, children }: { org?: OrgForTemplate | null; children: React.ReactNode }) {
  return (
    <div className={styles['foot']}>
      {children}
      {letterheadFor(org).name} &copy; {new Date().getFullYear()}
    </div>
  );
}

function SlipPaper({ patient, org }: { patient: Patient; org?: OrgForTemplate | null }) {
  const name = patientDisplayName(patient);
  const regDate = new Date(patient.registeredAt).toLocaleDateString('en-NG');
  const tests: PatientTest[] = patient.tests || [];
  const specimens =
    Array.from(new Set(tests.map(specimenOf))).filter(Boolean).join(', ') || '—';

  return (
    <div className={styles['paper']} data-testid="document-preview-slip">
      <Letterhead org={org} />
      <div className={styles['docTitle']}>INVESTIGATION SLIP</div>
      <div className={styles['copyTag']}>{slipCopyTag(tests)}</div>

      <div className={styles['rows']}>
        <Row label="ID" value={patient.slipNumber} />
        <Row label="Name" value={name} />
        <Row label="Age / Sex" value={`${patient.age} / ${patient.sex}`} />
        <Row label="Date" value={regDate} />
        <Row label="Specimen(s)" value={specimens} />
      </div>

      <div className={styles['sectionTitle']}>TESTS ORDERED ({tests.length})</div>
      <table className={styles['docTable']}>
        <caption className="sr-only">Tests ordered on this slip</caption>
        <thead>
          <tr>
            <th scope="col">Test</th>
            <th scope="col" className={styles['right']}>
              Dept
            </th>
          </tr>
        </thead>
        <tbody>
          {tests.map((t) => {
            const spec = specimenOf(t);
            return (
              <tr key={t.testId}>
                <td>
                  {t.testName}
                  {spec && <span className={styles['spec']}> ({spec})</span>}
                </td>
                <td className={styles['right']}>{t.department === 'lab' ? 'Lab' : 'Radio'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Foot org={org}>
        Please proceed to the respective department with this slip
        <br />
      </Foot>
    </div>
  );
}

function ReceiptPaper({ patient, org }: { patient: Patient; org?: OrgForTemplate | null }) {
  const name = patientDisplayName(patient);
  const regDate = new Date(patient.registeredAt).toLocaleDateString('en-NG');
  const tests: PatientTest[] = patient.tests || [];

  const subtotal = patient.totalAmount || 0;
  const discount = patient.discountAmount || 0;
  const net = patient.netAmount || 0;
  const paid = patient.paidAmount || 0;
  const balance = net - paid;

  const discountLabel =
    patient.discountType === 'percentage'
      ? `Discount (${patient.discountValue}%)`
      : patient.discountType === 'flat'
        ? 'Discount (Flat)'
        : 'Discount';

  return (
    <div className={styles['paper']} data-testid="document-preview-receipt">
      <Letterhead org={org} />
      {/* Named as the printed receipt names itself. */}
      <div className={`${styles['docTitle']} ${styles['docTitleRuled']}`}>
        PAYMENT RECEIPT / INVOICE
      </div>
      <div className={styles['copyTag']}>{RECEIPT_COPY_TAG}</div>

      <div className={`${styles['rows']} ${styles['rowsRuled']}`}>
        <Row label="Invoice No" value={patient.slipNumber} />
        <Row label="Patient Name" value={name} />
        <Row label="Age/Sex" value={`${patient.age} / ${patient.sex}`} />
        <Row label="Date" value={regDate} />
      </div>

      <table className={styles['docTable']}>
        <caption className="sr-only">What this visit was charged for</caption>
        <thead>
          <tr>
            <th scope="col">Investigation</th>
            <th scope="col" className={styles['right']}>
              Price
            </th>
          </tr>
        </thead>
        <tbody>
          {tests.map((t) => (
            <tr key={t.testId}>
              <td>{t.testName}</td>
              <td className={styles['right']}>{money(t.price || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles['summary']}>
        <div className={styles['row']}>
          <span>Subtotal:</span>
          <span>{money(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className={styles['row']}>
            <span>{discountLabel}:</span>
            <span>-{money(discount)}</span>
          </div>
        )}
        <div className={`${styles['row']} ${styles['summaryStrong']}`}>
          <span>Net Amount:</span>
          <span>{money(net)}</span>
        </div>
        <div className={styles['row']}>
          <span>Amount Paid:</span>
          <span>{money(paid)}</span>
        </div>
        <div className={`${styles['row']} ${balance > 0 ? styles['owing'] : ''}`}>
          <span>Balance Due:</span>
          <span>{money(balance)}</span>
        </div>
        <div className={`${styles['row']} ${styles['summaryNote']}`}>
          <span>Payment Method:</span>
          <span className={styles['upper']}>{patient.paymentMethod || 'cash'}</span>
        </div>
        <div className={`${styles['row']} ${styles['summaryNote']}`}>
          <span>Payment Status:</span>
          <span className={styles['upper']}>{patient.paymentStatus || 'paid'}</span>
        </div>
      </div>

      <Foot org={org}>
        Thank you for your patronage.
        <br />
        Please retain this receipt for your records.
        <br />
      </Foot>
    </div>
  );
}

/**
 * A sheet on the tray: the paper, with a caption saying which ticket it is
 * and whose hands it ends up in. When both are shown the caption also
 * carries its place in the print order, so the desk can tear and hand them
 * over without reading the tickets.
 */
function Sheet({
  ticket,
  ordinal,
  patient,
  org,
}: {
  ticket: Ticket;
  ordinal?: number;
  patient: Patient;
  org?: OrgForTemplate | null;
}) {
  const caption =
    ticket === 'receipt'
      ? { name: 'Receipt', handoff: 'Patient keeps this' }
      : { name: 'Request slip', handoff: `Patient hands this in at ${slipDestination(patient.tests || [])}` };

  return (
    <figure className={styles['sheet']} aria-label={`${caption.name} — ${caption.handoff}`}>
      <figcaption className={styles['sheetCaption']}>
        {ordinal !== undefined && (
          <>
            <span className={styles['sheetOrdinal']} aria-hidden="true">
              {ordinal}
            </span>
            <span className="sr-only">Prints {ordinal === 1 ? 'first' : 'second'}: </span>
          </>
        )}
        <span className={styles['sheetName']}>{caption.name}</span>
        <span className={styles['sheetHandoff']}>{caption.handoff}</span>
      </figcaption>
      {ticket === 'receipt' ? (
        <ReceiptPaper patient={patient} org={org} />
      ) : (
        <SlipPaper patient={patient} org={org} />
      )}
    </figure>
  );
}

export default function SlipModal({
  patient,
  purpose,
  onClose,
  org,
}: {
  patient: Patient;
  purpose: SlipModalPurpose;
  onClose: () => void;
  // Genuinely absent until the organisation loads, so null is a real value
  // here rather than a call-site oversight.
  org?: OrgForTemplate | null;
}) {
  /** The document up for reprint. Unused when registering: both are. */
  const [ticket, setTicket] = useState<Ticket>('slip');
  const both = purpose === 'register';

  const name = patientDisplayName(patient);
  const orgArg = org ?? undefined;

  const title = both
    ? 'Print receipt and request slip'
    : ticket === 'slip'
      ? 'Reprint investigation request slip'
      : 'Reprint payment receipt';

  const printLabel = both ? 'Print both' : ticket === 'slip' ? 'Print slip' : 'Print receipt';

  const handlePrint = () => {
    const html = both
      ? getReceiptAndSlipTemplate(patient, orgArg)
      : ticket === 'slip'
        ? getSlipTemplate(patient, orgArg)
        : getInvoiceTemplate(patient, orgArg);
    printHtml(html);
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      description={`${name} · ${patient.slipNumber}`}
      size={both ? 'lg' : 'sm'}
      flush
      footerNote={both ? 'One print job, two tickets — tear between them.' : undefined}
      footer={
        <Button
          intent="primary"
          icon={<RiPrinterLine size={14} />}
          onClick={() => {
            handlePrint();
            onClose();
          }}
        >
          {printLabel}
        </Button>
      }
    >
      {!both && (
        <div className={styles['switcher']}>
          <SegmentedControl
            value={ticket}
            onValueChange={setTicket}
            ariaLabel="Which document to reprint"
            options={[
              { value: 'slip', label: 'Request slip' },
              { value: 'receipt', label: 'Receipt' },
            ]}
          />
        </div>
      )}

      <div className={styles['tray']}>
        {both ? (
          <div className={styles['sheetPair']}>
            {RECEIPT_AND_SLIP_ORDER.map((t, i) => (
              <Sheet key={t} ticket={t} ordinal={i + 1} patient={patient} org={org} />
            ))}
          </div>
        ) : (
          <Sheet ticket={ticket} patient={patient} org={org} />
        )}
      </div>
    </Dialog>
  );
}
