import type { RadiologyFormState } from '@/lib/radiology-templates';

/**
 * Gestational age from ultrasound biometry, and writing that estimate back into
 * a report the sonographer is drafting.
 *
 * Pure by design (AGENTS.md §5): no React, no store, no I/O.
 */

export interface GestationalAge {
  weeks: number;
  days: number;
  /** Estimated delivery date, formatted for Nigeria (dd/mm/yyyy). */
  edd: string;
}

/**
 * Averages whichever of BPD, FL and CRL were measured. Each is a quadratic fit
 * of weeks against the measurement in millimetres; a measurement left blank,
 * zero or non-numeric is skipped rather than counted as zero.
 *
 * Returns null when nothing usable was entered, which is what tells the UI to
 * show its "enter a measurement" hint instead of a result.
 */
export const estimateGestationalAge = (
  measurements: RadiologyFormState['measurements'],
  today: Date = new Date(),
): GestationalAge | null => {
  const bpdVal = parseFloat(measurements.bpd || '');
  const flVal = parseFloat(measurements.fl || '');
  const crlVal = parseFloat(measurements.crl || '');

  let totalWeeks = 0;
  let count = 0;

  if (!isNaN(bpdVal) && bpdVal > 0) {
    totalWeeks += 0.0012 * (bpdVal * bpdVal) + 0.22 * bpdVal + 7.5;
    count++;
  }
  if (!isNaN(flVal) && flVal > 0) {
    totalWeeks += 0.0015 * (flVal * flVal) + 0.26 * flVal + 10.2;
    count++;
  }
  if (!isNaN(crlVal) && crlVal > 0) {
    totalWeeks += -0.0006 * (crlVal * crlVal) + 0.15 * crlVal + 5.8;
    count++;
  }

  if (count === 0) return null;

  const avgWeeks = totalWeeks / count;
  const weeksInt = Math.floor(avgWeeks);
  const daysInt = Math.floor((avgWeeks - weeksInt) * 7);

  const remainingDays = Math.round((40 - avgWeeks) * 7);
  const eddDate = new Date(today);
  eddDate.setDate(eddDate.getDate() + remainingDays);

  return {
    weeks: weeksInt,
    days: daysInt,
    edd: eddDate.toLocaleDateString('en-NG'),
  };
};

/**
 * Replaces a labelled value in the report, keeping whatever follows it.
 *
 * The report is HTML from the rich-text editor, and `convertTextToFormattedHtml`
 * emits it with no newlines at all — so a `[^\n]*` "rest of the line" pattern
 * matches to the end of the document and deletes the remainder of the report.
 * A line therefore ends at a newline OR at the next tag.
 */
const replaceLabelled = (text: string, pattern: RegExp, replacement: string) =>
  text.replace(pattern, replacement);

/**
 * Writes the estimate into the draft: the biometry lines in the findings, the
 * conclusion in the impression, and the EGA/EDD measurement fields.
 *
 * Templates label the same value several ways, so each field is tried against
 * the labels that actually appear in the catalogue before falling back to
 * appending a new line.
 */
export const applyObstetricEstimate = (
  state: RadiologyFormState,
  estimate: GestationalAge,
): RadiologyFormState => {
  const gaStr = `${estimate.weeks} weeks ${estimate.days} day(s)`;
  const eddStr = estimate.edd;

  let newFindings = state.findings;
  let newImpression = state.impression;

  if (newFindings.includes('EGA:')) {
    newFindings = replaceLabelled(newFindings, /EGA:[^\n<]*/g, `EGA: ${gaStr}`);
  } else if (newFindings.includes('Gestation age based')) {
    newFindings = replaceLabelled(newFindings, /Gestation age based[^\n<]*/g,
      `Gestation age based on BPD, HC and FL is approximately (GA): ${gaStr}`);
  } else {
    newFindings += `\nEGA: ${gaStr}`;
  }

  if (newFindings.includes('EDD:')) {
    newFindings = replaceLabelled(newFindings, /EDD:[^\n<]*/g, `EDD: ${eddStr}`);
  } else if (newFindings.includes('Expected date of delivery')) {
    newFindings = replaceLabelled(newFindings, /Expected date of delivery[^\n<]*/g,
      `Expected date of delivery by USG DD): ${eddStr}`);
  } else {
    newFindings += `\nEDD: ${eddStr}`;
  }

  const { bpd, fl } = state.measurements;
  if (bpd && newFindings.includes('BPD:')) {
    newFindings = replaceLabelled(newFindings, /BPD:[^\n<]*/g, `BPD: ${bpd} mm`);
  }
  if (fl && newFindings.includes('FL:')) {
    newFindings = replaceLabelled(newFindings, /FL:[^\n<]*/g, `FL: ${fl} mm`);
  }

  const conclusionText = `Single live foetus at ${gaStr} GA.`;
  if (newImpression.includes('CONCLUSION:')) {
    newImpression = replaceLabelled(newImpression, /CONCLUSION:[^\n<]*/g, `CONCLUSION: ${conclusionText}`);
  } else if (newImpression.includes('IMPRESSION:')) {
    newImpression = replaceLabelled(newImpression, /IMPRESSION:[^\n<]*/g, `IMPRESSION: ${conclusionText}`);
  } else {
    newImpression = `IMPRESSION: ${conclusionText}\nEDD: ${eddStr}\n\n` + newImpression;
  }

  return {
    ...state,
    findings: newFindings,
    impression: newImpression,
    measurements: {
      ...state.measurements,
      ega: gaStr,
      edd: eddStr,
    },
  };
};
