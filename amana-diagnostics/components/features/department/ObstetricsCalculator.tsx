'use client';

import type { RadiologyFormState } from '@/lib/radiology-templates';
import {
  dateByBiometry,
  applyObstetricEstimate,
  gestationalAgeByMeasurement,
  spreadInDays,
  SPREAD_WARNING_DAYS,
  CRL_DATING_LIMIT_MM,
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
 * The dating rule lives in lib/store/obstetrics: CRL alone up to 84 mm, a
 * composite of the second- and third-trimester biometry after it, and never
 * the two blended. What this screen adds is the working — which measurement
 * dated the pregnancy, what each one said on its own, and anything measured
 * but set aside — so a second reader can see where the EDD came from instead
 * of being handed a number.
 */
export default function ObstetricsCalculator({ value, onChange }: Props) {
  const setMeasurement = (field: string, val: string) =>
    onChange({ ...value, measurements: { ...value.measurements, [field]: val } });

  const dating = dateByBiometry(value.measurements);
  // Across every measurement taken, not only the ones that dated the
  // pregnancy. A CRL of 50 beside a BPD of 85 is the case worth catching, and
  // the rule has already set one of them aside by the time it gets here — so
  // measuring the spread of what was used would report no disagreement at all.
  const spread = spreadInDays(gestationalAgeByMeasurement(value.measurements));
  const contradictory = spread > SPREAD_WARNING_DAYS;

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

        {/* Set aside, not silently dropped. A CRL that is out of dating range
          * beside a third-trimester BPD is usually a box left filled in from
          * the last scan, and the sonographer is the only one who can say. */}
        {dating && dating.ignored.length > 0 && (
          <Alert tone="warning" live>
            {dating.ignored.map((p) => `${p.source} ${p.mm} mm`).join(' and ')}{' '}
            {dating.ignored.length === 1 ? 'was' : 'were'} not used for dating.
            {dating.method === 'CRL'
              ? ` Up to ${CRL_DATING_LIMIT_MM} mm the CRL dates the pregnancy on its own — it is
                 more accurate this early than BPD or FL, and averaging them in would only widen
                 the estimate.`
              : ` CRL is a first-trimester measurement and stops measuring age beyond
                 ${CRL_DATING_LIMIT_MM} mm. Check whether it was left in from an earlier scan.`}
          </Alert>
        )}

        {/* Irreconcilable, so the form does not pick for them. Which box is
          * stale is not something the rule can know — a CRL of 50 mm and a BPD
          * of 85 mm are both real measurements, of pregnancies five months
          * apart — and one of them is a typing slip. Inserting either into the
          * report would be a guess printed as a finding. */}
        {contradictory && (
          <Alert tone="critical" live>
            These measurements are {spread} days apart, so they cannot be of one fetus — one of
            the boxes is wrong. Correct or clear it before this goes into the report.
          </Alert>
        )}

        {dating ? (
          <div className={styles['obsResult']}>
            <div>
              <p className={styles['obsHeadline']}>
                {dating.weeks} weeks {dating.days} day(s)
                <span className={styles['obsEdd']}>EDD {dating.edd}</span>
              </p>

              {/* The working, not just the answer: which measurement dated it,
                * and what each one said on its own. */}
              <p className={styles['obsBreakdown']} data-testid="ga-breakdown">
                {dating.used.length === 1
                  ? `Dated by ${dating.used[0]!.source} alone (${dating.used[0]!.mm} mm).`
                  : `Composite of ${dating.used
                      .map((p) => `${p.source} ${asWeeks(p.weeks)}`)
                      .join(', ')}.`}
              </p>
            </div>

            <Button
              intent="primary"
              disabled={contradictory}
              onClick={() => onChange(applyObstetricEstimate(value, dating))}
            >
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
