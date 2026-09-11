'use client';

import { RiAddLine, RiDeleteBin6Line } from '@remixicon/react';

import {
  McsFormState,
  colourOptions,
  appearanceOptions,
  microscopyDefaults,
  growthOptions,
  degreeOptions,
  shapeOptions,
  GRAM_POSITIVE_ANTIBIOTICS,
  GRAM_NEGATIVE_ANTIBIOTICS,
  isNoGrowth,
} from '@/lib/store/labResults';
import { useNotices } from '@/components/Notices';
import { Button, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';

import { ChoiceField } from './ChoiceField';
import SensitivityTable from './SensitivityTable';
import styles from './entryForm.module.css';

interface Props {
  value: McsFormState;
  onChange: (next: McsFormState) => void;
}

/**
 * Microscopy, culture and sensitivity — the full urine/swab/stool workup.
 *
 * Each handler produces one complete next state. Nothing here batches two
 * edits into a single event, so a plain `onChange(next)` is enough; if that
 * ever changes, build the whole patch in one call rather than chaining.
 *
 * Two things were wrong beyond the chrome. Every control carried a positive
 * `tabIndex` — 1 to 4 here, 10 upward per microscopy row, 50 to 56 in the
 * culture, 100 upward per antibiotic — and a positive tabindex does not order
 * a form, it reorders the entire page ahead of everything else on it. And no
 * control had a name: the labels were bare `<label>` elements with no
 * `htmlFor`, so a scientist working by keyboard heard "edit text" thirty times
 * down an antibiogram.
 */
export default function McsEntryForm({ value: mcsState, onChange }: Props) {
  const { ask } = useNotices();
  const noGrowth = isNoGrowth(mcsState.culture.growth);

  const setMacroscopy = (field: 'colour' | 'appearance', val: string) =>
    onChange({ ...mcsState, macroscopy: { ...mcsState.macroscopy, [field]: val } });

  const setCulture = (field: keyof McsFormState['culture'], val: string) =>
    onChange({ ...mcsState, culture: { ...mcsState.culture, [field]: val } });

  const updateMicroscopyRow = (index: number, field: 'parameter' | 'value', val: string) =>
    onChange({
      ...mcsState,
      microscopy: mcsState.microscopy.map((m, idx) =>
        idx === index ? { ...m, [field]: val } : m,
      ),
    });

  const addMicroscopyRow = () =>
    onChange({ ...mcsState, microscopy: [...mcsState.microscopy, { parameter: '', value: '' }] });

  const removeMicroscopyRow = (index: number) =>
    onChange({ ...mcsState, microscopy: mcsState.microscopy.filter((_, idx) => idx !== index) });

  const updateSensitivityResult = (
    index: number,
    result: McsFormState['sensitivity'][number]['result'],
  ) =>
    onChange({
      ...mcsState,
      sensitivity: mcsState.sensitivity.map((s, idx) => (idx === index ? { ...s, result } : s)),
    });

  /**
   * Changing the gram reaction swaps in the matching antibiotic panel.
   *
   * This used to say it kept any result already scored against an antibiotic
   * that appears in both panels, and carried them over by matching `code`. No
   * code appears in both: the same drug is CN here and GN there, APX and ACX,
   * LEV and LBC. So nothing ever carried, and a scientist who had scored ten
   * discs and then corrected the gram reaction lost all ten without being
   * told.
   *
   * Carrying them silently would be worse — a different gram reaction is a
   * different identification read off a different plate. So it asks.
   */
  const handleGramReactionChange = async (newGram: string) => {
    const panel =
      newGram === 'Gram Positive'
        ? GRAM_POSITIVE_ANTIBIOTICS
        : newGram === 'Gram Negative'
          ? GRAM_NEGATIVE_ANTIBIOTICS
          : null;

    const scored = mcsState.sensitivity.filter((s) => s.result !== '').length;
    if (scored > 0) {
      const ok = await ask(
        `Change the gram reaction to "${newGram || 'not recorded'}"?\n\n` +
          `${scored === 1 ? 'One antibiotic has' : `${scored} antibiotics have`} been scored. ` +
          'A different gram reaction loads a different panel, so those readings will be cleared.',
      );
      if (!ok) return;
    }

    onChange({
      ...mcsState,
      culture: { ...mcsState.culture, gramReaction: newGram },
      sensitivity: panel ? panel.map((g) => ({ ...g, result: '' as const })) : [],
    });
  };

  return (
    <div className={styles['form']}>
      <div className={styles['pair']}>
        <Card>
          <CardHeader title="Macroscopy" subtitle="What the specimen looks like." />
          <CardBody>
            <div className={styles['fields']}>
              <ChoiceField
                label="Colour"
                options={colourOptions}
                value={mcsState.macroscopy.colour}
                onChange={(v) => setMacroscopy('colour', v)}
                placeholder="Type the custom colour"
              />
              <ChoiceField
                label="Appearance"
                options={appearanceOptions}
                value={mcsState.macroscopy.appearance}
                onChange={(v) => setMacroscopy('appearance', v)}
                placeholder="Type the custom appearance"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Microscopy" subtitle="What is seen under the slide." />
          <CardBody>
            <div className={styles['fields']}>
              {mcsState.microscopy.length === 0 ? (
                <p className={styles['rowsEmpty']}>
                  No parameters yet. Add the first one below.
                </p>
              ) : (
                <div className={styles['rows']}>
                  {mcsState.microscopy.map((m, idx) => {
                    // Named by what the row is for, falling back to its
                    // position while it is still blank. Without this the value
                    // boxes were identical and the delete buttons were a row
                    // of unlabelled crosses.
                    const rowName = m.parameter.trim() || `parameter ${idx + 1}`;
                    return (
                      // eslint-disable-next-line react/no-array-index-key
                      <div key={idx} className={styles['row']}>
                        <ChoiceField
                          label={`Microscopy row ${idx + 1}`}
                          options={microscopyDefaults}
                          value={m.parameter}
                          onChange={(v) => updateMicroscopyRow(idx, 'parameter', v)}
                          placeholder="Type the parameter"
                        />
                        <Field label={`${rowName} value`}>
                          <Input
                            value={m.value}
                            onChange={(e) => updateMicroscopyRow(idx, 'value', e.target.value)}
                            placeholder="e.g. 1-2/hpf"
                          />
                        </Field>
                        <Field label={`Remove ${rowName}`} labelHidden>
                          <Button
                            intent="dangerQuiet"
                            aria-label={`Remove ${rowName}`}
                            icon={<RiDeleteBin6Line size={15} />}
                            onClick={() => removeMicroscopyRow(idx)}
                          />
                        </Field>
                      </div>
                    );
                  })}
                </div>
              )}

              <Button
                intent="secondary"
                icon={<RiAddLine size={15} />}
                onClick={addMicroscopyRow}
              >
                Add parameter
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Culture" subtitle="What grew, and what it is." />
        <CardBody>
          <div className={styles['culture']}>
            <ChoiceField
              label="Growth"
              options={growthOptions}
              value={mcsState.culture.growth}
              onChange={(v) => setCulture('growth', v)}
              placeholder="Describe the growth"
            />

            {/* Nothing grew: there is no organism to describe and no plate to
              * read, so the rest of the culture and the whole antibiogram go
              * away rather than sit there inviting a reading that was never
              * taken. serializeMcsResults drops them too. */}
            {!noGrowth && (
              <>
                <Field label="Organism isolated">
                  <Input
                    value={mcsState.culture.organism}
                    onChange={(e) => setCulture('organism', e.target.value)}
                    placeholder="e.g. Staphylococcus aureus"
                  />
                </Field>

                <ChoiceField
                  label="Degree"
                  options={degreeOptions}
                  value={mcsState.culture.degree}
                  onChange={(v) => setCulture('degree', v)}
                  placeholder="Type the degree"
                />

                <Field
                  label="Gram reaction"
                  hint="Sets which antibiotic panel is loaded below."
                >
                  <Select
                    value={mcsState.culture.gramReaction}
                    onChange={(e) => handleGramReactionChange(e.target.value)}
                  >
                    <option value="">Not recorded</option>
                    <option value="Gram Positive">Gram Positive</option>
                    <option value="Gram Negative">Gram Negative</option>
                    <option value="Gram Variable">Gram Variable</option>
                    <option value="Not Applicable">Not Applicable</option>
                    <option value="Nil">Nil</option>
                  </Select>
                </Field>

                <ChoiceField
                  label="Shape"
                  options={shapeOptions}
                  value={mcsState.culture.shape}
                  onChange={(v) => setCulture('shape', v)}
                  placeholder="Type the shape"
                />

                <Field label="Incubation period">
                  <Input
                    value={mcsState.culture.incubationPeriod}
                    onChange={(e) => setCulture('incubationPeriod', e.target.value)}
                    placeholder="e.g. 24 hours"
                  />
                </Field>

                <Field label="Incubation temperature">
                  <Input
                    value={mcsState.culture.incubationTemperature}
                    onChange={(e) => setCulture('incubationTemperature', e.target.value)}
                    placeholder="e.g. 37°C"
                  />
                </Field>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {!noGrowth && (
        <SensitivityTable
          sensitivity={mcsState.sensitivity}
          gramReaction={mcsState.culture.gramReaction}
          onResult={updateSensitivityResult}
        />
      )}
    </div>
  );
}
