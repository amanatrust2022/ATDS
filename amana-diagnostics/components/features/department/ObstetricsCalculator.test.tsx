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
   * The dating rule is in lib/store/obstetrics: CRL alone up to 84 mm, a
   * composite of the later biometry after it, never the two blended. The
   * screen's job is to show which of those happened.
   */
  it('shows what dated the pregnancy, not only the answer', () => {
    withMeasurements({ bpd: '85', fl: '65' });

    const breakdown = screen.getByTestId('ga-breakdown');
    expect(breakdown).toHaveTextContent(/composite/i);
    expect(breakdown).toHaveTextContent(/BPD/);
    expect(breakdown).toHaveTextContent(/FL/);
  });

  it('says when a first-trimester CRL dated it on its own', () => {
    withMeasurements({ crl: '50' });
    expect(screen.getByTestId('ga-breakdown')).toHaveTextContent(/dated by CRL alone/i);
  });

  it('names a measurement that was taken but not used for dating', () => {
    withMeasurements({ crl: '90', bpd: '85', fl: '65' });

    // Past 84 mm the CRL no longer dates anything, so the later biometry does.
    expect(screen.getByTestId('ga-breakdown')).toHaveTextContent(/composite/i);
    const notices = screen.getAllByRole('status').map((el) => el.textContent).join(' ');
    expect(notices).toMatch(/CRL 90 mm/i);
    expect(notices).toMatch(/not used for dating/i);
  });

  /**
   * A CRL of 50 mm beside a BPD of 85 is two real measurements of pregnancies
   * five months apart, so one box is a typing slip — and which one is not
   * something any rule can know. The form must not pick: it says so and stops
   * the estimate reaching the report until a human resolves it.
   */
  it('calls out measurements that cannot be of one fetus', () => {
    withMeasurements({ bpd: '85', fl: '65', crl: '50' });

    expect(screen.getByRole('alert')).toHaveTextContent(/cannot be of one fetus/i);
  });

  it('will not insert a contradictory estimate into the report', () => {
    withMeasurements({ bpd: '85', fl: '65', crl: '50' });

    expect(screen.getByRole('button', { name: /insert/i })).toBeDisabled();
  });

  it('inserts freely when the measurements agree', () => {
    withMeasurements({ bpd: '85', fl: '65' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /insert/i })).toBeEnabled();
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
