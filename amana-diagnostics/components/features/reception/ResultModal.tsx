'use client';

import { useState } from 'react';
import { RiMailLine, RiPrinterLine } from '@remixicon/react';
import type { Patient } from '@/lib/store';
import { getResultTemplate, printHtml } from '@/lib/templates';
import { useAuth } from '@/components/AuthProvider';
import { useNotices } from '@/components/Notices';
import { Button, Dialog } from '@/components/ui';
import styles from './DocumentPreview.module.css';

/**
 * The completed report: choose which tests go on it, preview, print or email.
 *
 * Two changes beyond the chrome moving to Dialog.
 *
 * The test picker was a row of `<button>`s that toggled an array. They carried
 * no pressed or checked state, so a screen reader announced four identical
 * buttons and gave no way to tell which were selected — and selection was
 * signalled by background colour alone. They are real checkboxes now, drawn as
 * chips, inside a fieldset that names what the group is for.
 *
 * The print button used to be styled disabled — half opacity, a not-allowed
 * cursor — while remaining clickable, so pressing it produced a toast telling
 * you off. It is actually disabled, and the reason sits next to it.
 */
export default function ResultModal({
  patient,
  onClose,
  org,
}: {
  patient: Patient;
  onClose: () => void;
  org?: any;
}) {
  const { notify } = useNotices();
  const { session } = useAuth();
  const completedTests = patient.tests.filter((t) => t.status === 'completed');
  const [sendingEmail, setSendingEmail] = useState(false);
  // Everything is included until the receptionist says otherwise.
  const [selectedIds, setSelectedIds] = useState<string[]>(
    completedTests.map((t) => t.testId),
  );

  const toggleTest = (testId: string) => {
    setSelectedIds((prev) =>
      prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId],
    );
  };

  const allSelected = selectedIds.length === completedTests.length;
  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : completedTests.map((t) => t.testId));

  const chosen = completedTests.filter((t) => selectedIds.includes(t.testId));
  const nothingChosen = chosen.length === 0;

  const handlePrint = () => {
    printHtml(getResultTemplate(patient, chosen, org));
  };

  const handleEmail = async () => {
    if (!patient.email) {
      notify(
        'This patient has no email address on file. Add one to their details first.',
        'error',
      );
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch('/api/send-result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The route sends mail as the clinic, so it establishes who is asking.
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ patient, completedTests: chosen, org }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send email');
      }

      notify(`Report emailed to ${patient.email}.`, 'success');
    } catch (err: any) {
      notify('Could not send the report: ' + err.message, 'error');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Result report"
      description={`${patient.name} · ${patient.slipNumber}`}
      size="lg"
      flush
      footerNote={
        nothingChosen ? 'Choose at least one test to print or send.' : undefined
      }
      footer={
        <>
          <Button intent="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            intent="secondary"
            icon={<RiMailLine size={14} />}
            loading={sendingEmail}
            disabled={nothingChosen}
            onClick={() => void handleEmail()}
          >
            Email to patient
          </Button>
          <Button
            intent="primary"
            icon={<RiPrinterLine size={14} />}
            disabled={nothingChosen}
            onClick={handlePrint}
          >
            {nothingChosen
              ? 'Print'
              : `Print ${chosen.length} test${chosen.length === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className={styles.picker}>
        <fieldset className={styles.chips}>
          <div className={styles.pickerHead}>
            <legend className={styles.pickerLegend}>Tests to include</legend>
            <Button intent="link" size="sm" onClick={toggleAll}>
              {allSelected ? 'Clear all' : 'Select all'}
            </Button>
          </div>

          {completedTests.map((t) => {
            const checked = selectedIds.includes(t.testId);
            return (
              <label key={t.testId} className={styles.chip}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTest(t.testId)}
                />
                <span className={styles.chipMark} aria-hidden="true">
                  {checked ? '✓' : ''}
                </span>
                {t.testName}
              </label>
            );
          })}
        </fieldset>

        {/* Announced as it changes, so the count is not sight-only. */}
        <p
          className={nothingChosen ? styles.pickerEmpty : styles.pickerCount}
          aria-live="polite"
        >
          {nothingChosen
            ? 'No tests selected — nothing would be printed.'
            : `${chosen.length} of ${completedTests.length} test${
                completedTests.length === 1 ? '' : 's'
              } will be included.`}
        </p>
      </div>

      <div className={styles.reportFrame}>
        <iframe
          srcDoc={getResultTemplate(patient, chosen, org)}
          title="Preview of the report as it will print"
        />
      </div>
    </Dialog>
  );
}
