'use client';

import { MpsFormState } from '@/lib/store/labResults';
import { Badge, Card, CardBody, CardHeader, Field, Input, Select } from '@/components/ui';

import styles from './entryForm.module.css';

interface Props {
  value: MpsFormState;
  onChange: (next: MpsFormState) => void;
}

const densityPlusOptions = ['+', '++', '+++', '++++'];
const speciesOptions = [
  'Plasmodium falciparum',
  'Plasmodium vivax',
  'Plasmodium malariae',
  'Plasmodium ovale',
];
const stageOptions = [
  'Trophozoites (ring forms)',
  'Gametocytes',
  'Schizonts',
  'Trophozoites & Gametocytes',
];

/**
 * Malaria parasites — the thick and thin film.
 *
 * Every edit patches the whole state at once. Marking a film positive or
 * negative changes four other fields with it, and applying those one at a time
 * would leave only the last.
 */
export default function MpsEntryForm({ value, onChange }: Props) {
  const patch = (over: Partial<MpsFormState>) => onChange({ ...value, ...over });

  const seen = value.parasiteSeen === 'Seen';

  /**
   * Going positive used to fill in the findings: species became Plasmodium
   * falciparum, stage became ring forms and density became "+", on the
   * reasoning that they are the commonest.
   *
   * They are, and that is not enough. Falciparum and vivax are not
   * interchangeable — vivax carries hypnozoites in the liver and needs
   * primaquine on top of the schizonticide — so a pre-filled species is the
   * form making a treatment decision on behalf of whoever is at the
   * microscope, and a pre-filled one that is right most of the time is exactly
   * the kind that stops being read. It also left the count saying "Nil" beside
   * a density of "+", so the report contradicted itself.
   *
   * Now going positive empties the findings and they have to be read off the
   * slide. Going negative clears them, because a film with no parasites has no
   * species.
   */
  const setParasiteSeen = (next: string) => {
    if (next === 'Not Seen') {
      patch({
        parasiteSeen: 'Not Seen',
        densityPlus: 'Nil',
        densityCount: 'Nil',
        species: 'Nil',
        stage: 'Nil',
      });
    } else {
      patch({
        parasiteSeen: 'Seen',
        densityPlus: value.densityPlus === 'Nil' ? '' : value.densityPlus,
        densityCount: value.densityCount === 'Nil' ? '' : value.densityCount,
        species: value.species === 'Nil' ? '' : value.species,
        stage: value.stage === 'Nil' ? '' : value.stage,
      });
    }
  };

  return (
    <Card>
      <CardHeader
        title="Malaria parasites"
        subtitle="What is on the film."
        actions={seen ? <Badge tone="critical">Positive</Badge> : undefined}
      />
      <CardBody>
        <div className={styles['culture']}>
          <Field label="Parasites seen">
            <Select
              value={value.parasiteSeen}
              onChange={(e) => setParasiteSeen(e.target.value)}
            >
              <option value="Not Seen">Not seen (negative)</option>
              <option value="Seen">Seen (positive)</option>
            </Select>
          </Field>

          {/* Nothing on the film: there is no parasite to grade, no species to
            * name and no stage to call, so the rest goes away rather than sit
            * there inviting a reading that was never taken. */}
          {seen && (
            <>
              <Field label="Density (plus system)">
                <Select
                  value={value.densityPlus}
                  onChange={(e) =>
                    patch({ densityPlus: e.target.value as MpsFormState['densityPlus'] })
                  }
                >
                  <option value="">Not recorded</option>
                  {densityPlusOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Parasite species">
                <Select value={value.species} onChange={(e) => patch({ species: e.target.value })}>
                  <option value="">Not recorded</option>
                  {speciesOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Parasite stage">
                <Select value={value.stage} onChange={(e) => patch({ stage: e.target.value })}>
                  <option value="">Not recorded</option>
                  {stageOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}

          <Field label="Parasites per µL" hint="The quantitative count, if one was done.">
            <Input
              value={value.densityCount}
              onChange={(e) => patch({ densityCount: e.target.value })}
              placeholder="e.g. 240"
            />
          </Field>

          <Field label="Comment / RBC morphology">
            <Input
              value={value.comment}
              onChange={(e) => patch({ comment: e.target.value })}
              placeholder="e.g. Normocytic, normochromic RBCs. No other haemoparasite seen."
            />
          </Field>
        </div>
      </CardBody>
    </Card>
  );
}
