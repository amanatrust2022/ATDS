'use client';

import { useState } from 'react';
import { RiPrinterLine } from '@remixicon/react';
import type { Patient } from '@/lib/store';
import { getSlipTemplate, getInvoiceTemplate, printHtml } from '@/lib/templates';
import { Button, Dialog, SegmentedControl } from '@/components/ui';
import { FALLBACK_ORG_NAME } from '@/lib/branding';
import styles from './DocumentPreview.module.css';

/**
 * The request slip and the payment receipt, previewed before printing.
 *
 * Lifted out of ReceptionPage, where it was one of 18 hand-rolled overlays:
 * a fixed div over an rgba() scrim, with no focus trap, no Escape, no scroll
 * lock, and no way back to the button that opened it. That chrome is now
 * Dialog, and the tab switcher is a real SegmentedControl rather than two
 * buttons with a borderBottom.
 *
 * The preview itself is untouched. It is a facsimile of a piece of paper, so
 * its black-on-white is the paper's and must not follow the viewer's theme.
 */
export default function SlipModal({
  patient,
  onClose,
  org,
}: {
  patient: Patient;
  onClose: () => void;
  org?: any;
}) {
  const [modalTab, setModalTab] = useState<'slip' | 'invoice'>('slip');
  const regDate = new Date(patient.registeredAt).toLocaleDateString('en-NG');
  const specimens =
    Array.from(new Set(patient.tests.map((t: any) => t.specimen))).filter(Boolean).join(', ') ||
    '—';

  const orgName = org?.name || FALLBACK_ORG_NAME;
  const orgLine2 = org?.letterhead_line2 || '';
  const orgAddress = org?.address || '';
  const orgPhone = org?.phone || '';

  const handlePrint = () => {
    const html =
      modalTab === 'slip' ? getSlipTemplate(patient, org) : getInvoiceTemplate(patient, org);
    printHtml(html);
  };

  const title =
    modalTab === 'slip' ? 'Investigation request slip' : 'Payment receipt';

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      description={`${patient.name} · ${patient.slipNumber}`}
      size="sm"
      flush
      footer={
        <Button
          intent="primary"
          icon={<RiPrinterLine size={14} />}
          onClick={() => {
            handlePrint();
            onClose();
          }}
        >
          Print this document
        </Button>
      }
    >
      <div className={styles.switcher}>
        <SegmentedControl
          value={modalTab}
          onValueChange={setModalTab}
          ariaLabel="Which document to preview"
          options={[
            { value: 'slip', label: 'Request slip' },
            { value: 'invoice', label: 'Receipt' },
          ]}
        />
      </div>

      {/* A facsimile of the printed page. Fixed colours on purpose. */}
      <div className={styles.tray}>
        {modalTab === 'slip' ? (
          <div className={styles.paper}>
            {/* ── Org Header ── */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', lineHeight: 1.2, margin: 0 }}>{orgName.toUpperCase()}</div>
              {orgLine2 && <div style={{ fontSize: 11, fontWeight: 'bold', margin: '2px 0 4px' }}>{orgLine2.toUpperCase()}</div>}
              {orgAddress && <div style={{ fontSize: 10, margin: '2px 0' }}>{orgAddress}</div>}
              {orgPhone && <div style={{ fontSize: 10, margin: 0 }}>{orgPhone}</div>}
            </div>

            {/* ── Slip title ── */}
            <div style={{ fontSize: 14, fontWeight: 'bold', textAlign: 'center', margin: '8px 0 10px', borderBottom: '1px solid #000', paddingBottom: 4 }}>
              INVESTIGATION SLIP
            </div>

            {/* ── Patient info ── */}
            <div style={{ marginBottom: 10, fontSize: 12, lineHeight: 1.6 }}>
              {[
                ['ID', patient.slipNumber],
                ['Name', patient.name],
                ['Age / Sex', `${patient.age} / ${patient.sex}`],
                ['Date', regDate],
                ['Specimen(s)', specimens],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>{l}:</span>
                  <span style={{ textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* ── Tests ── */}
            <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: 2, marginTop: 10, fontSize: 12 }}>
              TESTS ORDERED ({patient.tests.length})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #000', textAlign: 'left', padding: '3px 0', fontWeight: 700 }}>Test</th>
                  <th style={{ borderBottom: '1px solid #000', textAlign: 'right', padding: '3px 0', fontWeight: 700 }}>Dept</th>
                </tr>
              </thead>
              <tbody>
                {patient.tests.map((t: any) => (
                  <tr key={t.testId} style={{ borderBottom: '1px dashed #ccc' }}>
                    <td style={{ padding: '3px 0', fontSize: 11 }}>
                      {t.testName}
                      {t.specimen && <span style={{ fontSize: 9, color: '#666' }}> ({t.specimen})</span>}
                    </td>
                    <td style={{ padding: '3px 0', textAlign: 'right', fontSize: 11 }}>
                      {t.department === 'lab' ? 'Lab' : 'Radio'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Footer ── */}
            <div style={{ marginTop: 14, borderTop: '1px dashed #000', paddingTop: 8, fontSize: 10, textAlign: 'center', lineHeight: 1.5 }}>
              Please proceed to the respective department with this slip<br />
              {orgName} &copy; {new Date().getFullYear()}
            </div>
          </div>
        ) : (
          <div className={styles.paper}>
            {/* ── Org Header ── */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 'bold', lineHeight: 1.2, margin: 0 }}>{orgName.toUpperCase()}</div>
              {orgLine2 && <div style={{ fontSize: 11, fontWeight: 'bold', margin: '2px 0 4px' }}>{orgLine2.toUpperCase()}</div>}
              {orgAddress && <div style={{ fontSize: 10, margin: '2px 0' }}>{orgAddress}</div>}
              {orgPhone && <div style={{ fontSize: 10, margin: 0 }}>{orgPhone}</div>}
            </div>

            {/* ── Invoice Title ── */}
            <div style={{ fontSize: 14, fontWeight: 'bold', textAlign: 'center', margin: '8px 0 10px', borderBottom: '1px solid #000', paddingBottom: 4 }}>
              PAYMENT RECEIPT
            </div>

            {/* ── Patient & Referral Info ── */}
            <div style={{ marginBottom: 10, fontSize: 12, lineHeight: 1.6, borderBottom: '1px dashed #000', paddingBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>Invoice No:</span> <span>{patient.slipNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>Patient Name:</span> <span>{patient.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>Age/Sex:</span> <span>{patient.age} / {patient.sex}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>Date:</span> <span>{regDate}</span>
              </div>
            </div>

            {/* ── Invoice Items ── */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ borderBottom: '1px solid #000', textAlign: 'left', padding: '3px 0', fontWeight: 700 }}>Investigation</th>
                  <th style={{ borderBottom: '1px solid #000', textAlign: 'right', padding: '3px 0', fontWeight: 700 }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {patient.tests.map((t: any) => (
                  <tr key={t.testId} style={{ borderBottom: '1px dashed #eee' }}>
                    <td style={{ padding: '3px 0', fontSize: 11 }}>{t.testName}</td>
                    <td style={{ padding: '3px 0', textAlign: 'right', fontSize: 11 }}>
                      ₦{(t.price || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Billing Summary ── */}
            <div style={{ marginTop: 10, borderTop: '1px solid #000', paddingTop: 6, fontSize: 12, lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>₦{(patient.totalAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
              </div>
              {(patient.discountAmount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {patient.discountType === 'percentage'
                      ? `Discount (${patient.discountValue}%)`
                      : patient.discountType === 'flat'
                        ? 'Discount (Flat)'
                        : 'Discount'}
                    :
                  </span>
                  <span>-₦{(patient.discountAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13, borderBottom: '1px dashed #000', paddingBottom: 4, marginBottom: 4 }}>
                <span>Net Amount:</span>
                <span>₦{(patient.netAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Amount Paid:</span>
                <span>₦{(patient.paidAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: ((patient.netAmount || 0) - (patient.paidAmount || 0)) > 0 ? '#c0392b' : '#000' }}>
                <span>Balance Due:</span>
                <span>₦{((patient.netAmount || 0) - (patient.paidAmount || 0)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', marginTop: 4 }}>
                <span>Payment Method:</span>
                <span style={{ textTransform: 'uppercase' }}>{patient.paymentMethod || 'cash'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
                <span>Payment Status:</span>
                <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{patient.paymentStatus || 'paid'}</span>
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{ marginTop: 14, borderTop: '1px dashed #000', paddingTop: 8, fontSize: 10, textAlign: 'center', lineHeight: 1.5 }}>
              Thank you for your patronage.<br />
              Please retain this receipt for your records.<br />
              {orgName} &copy; {new Date().getFullYear()}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
