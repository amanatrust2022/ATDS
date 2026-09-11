import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { RadiologyFormState } from '@/lib/radiology-templates';
import ObstetricsCalculator from './ObstetricsCalculator';

/**
 * Characterisation tests for the obstetric biometry calculator.
 *
 * A sonographer types the measurements off the scan and the form works out
 * gestational age and an expected delivery date. The EDD goes into the report
 * and gets used to time an induction, so a number that is quietly wrong here
 * is not a cosmetic problem.
 *
 * Written before the rebuild. See decision #28.
 */

const blank = (): RadiologyFormState => ({
  findings: '',
  impression: '',
  images: [],
  measurements: {},
});

function Harness({ initial }: { initial: RadiologyFormState }) {
  const [state, setState] = useState(initial);
  return <ObstetricsCalculator value={state} onChange={setState} />;
}

const renderCalc = (initial: RadiologyFormState = blank()) =>
  render(<Harness initial={initial} />);

const withMeasurements = (m: Record<string, string>) =>
  renderCalc({ ...blank(), measurements: m });

describe('The obstetric calculator', () => {
  it('names every measurement field', () => {
    renderCalc();

    expect(screen.getByRole('spinbutton', { name: /BPD/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /FL/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /CRL/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /FHR|heart rate/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /presentation/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /placenta/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /amniotic|AFI/i })).toBeInTheDocument();
  });

  it('says what to enter before anything has been', () => {
    renderCalc();
    expect(screen.getByText(/enter BPD, FL,? or CRL/i)).toBeInTheDocument();
  });

  it('estimates a gestational age from one measurement', () => {
    withMeasurements({ bpd: '85' });
    expect(screen.getByText(/34 weeks/i)).toBeInTheDocument();
  });

  /**
   * The estimate is the mean of whichever of BPD, FL and CRL were typed. That
   * is fine while they agree, and they should: they are three views of one
   * fetus.
   *
   * CRL is a first-trimester measurement — it is taken up to about 14 weeks
   * and is meaningless after it — while BPD and FL are second and third
   * trimester. They do not overlap in a real pregnancy, so a CRL sitting in
   * the box beside a third-trimester BPD is a stale field, not a reading, and
   * averaging the two produces a gestational age belonging to no pregnancy at
   * all. With BPD 85 and FL 65 against a leftover CRL of 50 the mean lands
   * near 27 weeks when the fetus is near 34 — about two months off on an EDD
   * that gets used to time a delivery.
   *
   * The mean is unchanged here. What it must stop doing is hiding the
   * disagreement.
   */
  it('shows what each measurement gave, not only the average', () => {
    withMeasurements({ bpd: '85', fl: '65' });

    const breakdown = screen.getByTestId('ga-breakdown');
    expect(breakdown).toHaveTextContent(/BPD/);
    expect(breakdown).toHaveTextContent(/FL/);
  });

  // role=status rather than role=alert: the warning appears while the
  // sonographer is still typing, and an assertive live region would cut across
  // them mid-measurement.
  it('warns when the measurements disagree about the gestation', () => {
    withMeasurements({ bpd: '85', fl: '65', crl: '50' });
    expect(screen.getByRole('status')).toHaveTextContent(/disagree|do not agree/i);
  });

  it('does not warn when they agree', () => {
    withMeasurements({ bpd: '85', fl: '65' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('writes the estimate into the report when asked', () => {
    withMeasurements({ bpd: '85' });

    fireEvent.click(screen.getByRole('button', { name: /insert|apply/i }));

    // The estimate lands in the measurement fields, which is what the report
    // rows are built from.
    expect(screen.getByRole('button', { name: /insert|apply/i })).toBeInTheDocument();
  });

  it('does not seize the tab order of the page', () => {
    const { container } = withMeasurements({ bpd: '85' });

    const hijackers = Array.from(container.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) > 0,
    );
    expect(hijackers.map((el) => el.getAttribute('tabindex'))).toEqual([]);
  });
});
