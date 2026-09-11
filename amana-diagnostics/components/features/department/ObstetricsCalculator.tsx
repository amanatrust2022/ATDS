'use client';

import type { RadiologyFormState } from '@/lib/radiology-templates';
import {
  estimateGestationalAge,
  applyObstetricEstimate,
  gestationalAgeByMeasurement,
  spreadInDays,
  SPREAD_WARNING_DAYS,
} from '@/lib/store/obstetrics';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';

import styles from './entryForm.module.css';

interface Props {
  value: RadiologyFormState;
  onChange: (next: RadiologyFormState) => void;
}

const selectOptions: Record<string, { label: string; options: [string, string][] }> = {
  presentation: {
    label: 'Presentation',
    options: [['Cephalic', 'Cephalic'], ['Breech', 'Breech'], ['Transverse', 'Transverse'], ['Mobile', 'Mobile']],
  },
  placenta: {
    label: 'Placenta',
    options: [
      ['POSTERIOR', 'Posterior'], ['ANTERIOR', 'Anterior'], ['FUNDAL', 'Fundal'],
      ['LOW LYING', 'Low Lying'], ['PLACENTA PREVIA', 'Placenta Previa'],
    ],
  },
  afi: {
    label: 'Amniotic fluid (AFI)',
    options: [['ADEQUATE', 'Adequate'], ['OLIGOHYDRAMNIOS', 'Oligohydramnios'], ['POLYHYDRAMNIOS', 'Polyhydramnios']],
  },
};

/** Weeks as the report says them. */
const asWeeks = (weeks: number) =>
  `${Math.floor(weeks)}w ${Math.floor((weeks - Math.floor(weeks)) * 7)}d`;

/**
 * Gestational age and delivery date from ultrasound biometry.
 *
 * The estimate is the mean of whichever of BPD, FL and CRL were typed, and
 * that stays as it is. What changed is that the mean no longer stands alone:
 * each measurement's own answer is shown beside it, and a disagreement wide
 * enough that they cannot be describing one fetus is called out.
 *
 * The case that matters is a CRL left in the box next to a third-trimester
 * BPD — first-trimester and third-trimester measurements averaged together.
 * With BPD 85 and FL 65 the fetus is near 34 weeks; a stale CRL of 50 pulls
 * the mean to under 27, and the EDD that goes into the report, and gets used
 * to time a delivery, is two months out. Nothing on the old screen showed it.
 */
export default function ObstetricsCalculator({ value, onChange }: Props) {
  const setMeasurement = (field: string, val: string) =>
    onChange({ ...value, measurements: { ...value.measurements, [field]: val } });

  const estimate = estimateGestationalAge(value.measurements);
  const parts = gestationalAgeByMeasurement(value.measurements);
  const spread = spreadInDays(parts);

  const numberField = (
    field: 'bpd' | 'fl' | 'crl' | 'fhr',
    label: string,
    hint: string,
    max: number,
  ) => (
    <Field label={label}>
      <Input
        type="number"
        min={0}
        // An upper bound so a slipped decimal — 350 for 35 — is caught at the
        // box rather than turning into a gestational age nobody questions.
        max={max}
        placeholder={hint}
        value={value.measurements[field] || ''}
        onChange={(e) => setMeasurement(field, e.target.value)}
      />
    </Field>
  );

  const selectField = (field: 'presentation' | 'placenta' | 'afi') => {
    const { label, options } = selectOptions[field]!;
    return (
      <Field label={label}>
        <Select
          value={value.measurements[field] || ''}
          onChange={(e) => setMeasurement(field, e.target.value)}
        >
          <option value="">Not recorded</option>
          {options.map(([val, text]) => (
            <option key={val} value={val}>
              {text}
            </option>
          ))}
        </Select>
      </Field>
    );
  };

  return (
    <Card>
      <CardHeader title="Obstetric biometry" subtitle="Gestational age by Hadlock fit." />
      <CardBody>
        <div className={styles['obsFields']}>
          {numberField('bpd', 'BPD (mm)', 'e.g. 35', 120)}
          {numberField('fl', 'FL (mm)', 'e.g. 24', 100)}
          {numberField('crl', 'CRL (mm)', 'e.g. 50', 120)}
          {numberField('fhr', 'FHR (bpm)', 'e.g. 140', 300)}
          {selectField('presentation')}
          {selectField('placenta')}
          {selectField('afi')}
        </div>

        {spread > SPREAD_WARNING_DAYS && (
          <Alert tone="warning" live>
            These measurements disagree by {spread} days, so they cannot all be of one fetus.
            Check whether a measurement has been left in from another scan — CRL is a
            first-trimester measurement and does not belong beside a BPD or FL.
          </Alert>
        )}

        {estimate ? (
          <div className={styles['obsResult']}>
            <div>
              <p className={styles['obsHeadline']}>
                {estimate.weeks} weeks {estimate.days} day(s)
                <span className={styles['obsEdd']}>EDD {estimate.edd}</span>
              </p>

              {/* The working, not just the answer. Three views of one fetus
                * should agree within a few days; seeing them side by side is
                * what makes a stale box obvious. */}
              <p className={styles['obsBreakdown']} data-testid="ga-breakdown">
                {parts.length === 1
                  ? `From ${parts[0]!.source} alone.`
                  : `Mean of ${parts.map((p) => `${p.source} ${asWeeks(p.weeks)}`).join(', ')}.`}
              </p>
            </div>

            <Button intent="primary" onClick={() => onChange(applyObstetricEstimate(value, estimate))}>
              Insert into report
            </Button>
          </div>
        ) : (
          <p className={styles['obsEmpty']}>
            Enter BPD, FL or CRL to calculate gestational age and delivery date.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
