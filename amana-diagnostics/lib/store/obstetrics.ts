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
 * How a gestational age was arrived at.
 *
 * The measurement used to be a detail the screen threw away. It is the first
 * thing a second reader needs: dating by CRL and dating by BPD are different
 * claims of different reliability, and which one produced the EDD decides how
 * much weight it carries.
 */
export type DatingMethod = 'CRL' | 'composite' | 'CRL (beyond dating range)';

export interface Dating extends GestationalAge {
  method: DatingMethod;
  /** The measurements the estimate was taken from. */
  used: BiometryEstimate[];
  /** Measured, but not eligible to date this pregnancy. */
  ignored: BiometryEstimate[];
}

/**
 * The crown-rump length beyond which CRL stops being a dating measurement.
 *
 * 84 mm is the standard cut-off (ACOG Committee Opinion 700, ISUOG) and lands
 * at 14+1 on the fit used here, which is the boundary it is meant to mark: up
 * to it the embryo grows at a rate that varies little between pregnancies, and
 * after it CRL flexes with fetal position and stops measuring age.
 */
export const CRL_DATING_LIMIT_MM = 84;

/**
 * Gestational age from ultrasound biometry, by the standard rule.
 *
 * Up to a CRL of 84 mm, CRL dates the pregnancy on its own — it is the most
 * accurate measurement obstetrics has, to about ±5 days, and adding anything
 * to it makes the estimate worse. After that CRL is no longer a dating
 * measurement at all, and the pregnancy is dated on a composite of the
 * second- and third-trimester biometry, which beats any one of them alone.
 *
 * The two are never blended. They describe different halves of a pregnancy
 * and do not overlap, so a CRL sitting in the box beside a third-trimester BPD
 * is a stale field, not a reading.
 *
 * This used to be the plain mean of whichever boxes had numbers in them. With
 * BPD 85 and FL 65 — a fetus near 34 weeks — a leftover CRL of 50 pulled the
 * mean under 27, and the EDD that went into the report, and got used to time a
 * delivery, was two months out.
 *
 * Returns null when nothing usable was entered, which is what tells the UI to
 * show its "enter a measurement" hint instead of a result.
 */
export const dateByBiometry = (
  measurements: RadiologyFormState['measurements'],
  today: Date = new Date(),
): Dating | null => {
  const parts = gestationalAgeByMeasurement(measurements);
  if (parts.length === 0) return null;

  const crl = parts.find((p) => p.source === 'CRL');
  const others = parts.filter((p) => p.source !== 'CRL');

  let used: BiometryEstimate[];
  let method: DatingMethod;

  if (crl && crl.mm <= CRL_DATING_LIMIT_MM) {
    // First trimester. CRL alone, and the others are set aside rather than
    // averaged in: BPD and FL are no better than CRL this early, and mixing
    // them only widens the error.
    used = [crl];
    method = 'CRL';
  } else if (others.length > 0) {
    used = others;
    method = 'composite';
  } else {
    // An over-range CRL and nothing else. It is all there is, so it is used,
    // but it is named for what it is so nobody treats it as a dating scan.
    used = [crl!];
    method = 'CRL (beyond dating range)';
  }

  const avgWeeks = used.reduce((total, p) => total + p.weeks, 0) / used.length;
  const weeksInt = Math.floor(avgWeeks);
  const daysInt = Math.floor((avgWeeks - weeksInt) * 7);

  const remainingDays = Math.round((40 - avgWeeks) * 7);
  const eddDate = new Date(today);
  eddDate.setDate(eddDate.getDate() + remainingDays);

  return {
    weeks: weeksInt,
    days: daysInt,
    edd: eddDate.toLocaleDateString('en-NG'),
    method,
    used,
    ignored: parts.filter((p) => !used.includes(p)),
  };
};

/** The age and date on their own, for callers that need nothing else. */
export const estimateGestationalAge = (
  measurements: RadiologyFormState['measurements'],
  today: Date = new Date(),
): GestationalAge | null => {
  const dating = dateByBiometry(measurements, today);
  if (!dating) return null;
  return { weeks: dating.weeks, days: dating.days, edd: dating.edd };
};

/** One measurement's own answer, before they are averaged together. */
export interface BiometryEstimate {
  source: 'BPD' | 'FL' | 'CRL';
  /** Millimetres, as measured. */
  mm: number;
  /** Gestational age in weeks, unrounded. */
  weeks: number;
}

const FITS = {
  BPD: (mm: number) => 0.0012 * (mm * mm) + 0.22 * mm + 7.5,
  FL: (mm: number) => 0.0015 * (mm * mm) + 0.26 * mm + 10.2,
  CRL: (mm: number) => -0.0006 * (mm * mm) + 0.15 * mm + 5.8,
} as const;

/**
 * What each measurement says on its own.
 *
 * `estimateGestationalAge` averages these, which is right while they agree —
 * they are three views of one fetus. The case it cannot see is CRL beside BPD
 * or FL: crown-rump length is a first-trimester measurement, taken to about 14
 * weeks and meaningless after, while BPD and FL belong to the second and third.
 * They do not overlap in a real pregnancy, so a CRL sitting in the box next to
 * a third-trimester BPD is a stale field rather than a reading — and the mean
 * of the two is a gestational age belonging to no pregnancy at all.
 *
 * The average is left as it is. This is what lets the screen show the working,
 * so a disagreement of that size is visible instead of folded away.
 */
export const gestationalAgeByMeasurement = (
  measurements: RadiologyFormState['measurements'],
): BiometryEstimate[] => {
  const sources: [BiometryEstimate['source'], string | undefined][] = [
    ['BPD', measurements.bpd],
    ['FL', measurements.fl],
    ['CRL', measurements.crl],
  ];

  return sources.flatMap(([source, raw]) => {
    const mm = parseFloat(raw || '');
    if (isNaN(mm) || mm <= 0) return [];
    return [{ source, mm, weeks: FITS[source](mm) }];
  });
};

/**
 * How far apart the measurements are, in days.
 *
 * Two weeks is the point at which they are no longer describing one fetus.
 * Biometry of the same gestation scatters by a few days; fifty does not
 * happen, and means somebody typed into the wrong box.
 */
export const SPREAD_WARNING_DAYS = 14;

export const spreadInDays = (parts: BiometryEstimate[]): number => {
  if (parts.length < 2) return 0;
  const weeks = parts.map((p) => p.weeks);
  return Math.round((Math.max(...weeks) - Math.min(...weeks)) * 7);
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
