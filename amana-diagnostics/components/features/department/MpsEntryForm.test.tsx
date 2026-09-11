import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { emptyMpsState, type MpsFormState } from '@/lib/store/labResults';
import MpsEntryForm from './MpsEntryForm';

/**
 * Characterisation tests for the malaria parasite microscopy form.
 *
 * A technologist reads a stained thick and thin film and types what is on the
 * slide. What comes out the other end decides whether a febrile patient is
 * treated for malaria, and — through the species — which drug they get. So the
 * bar is the same as the MCS workup: the form may not answer for the person
 * reading the slide, and every control has to say what it is.
 *
 * Written before the rebuild. See decision #28.
 */

function Harness({ initial }: { initial: MpsFormState }) {
  const [state, setState] = useState(initial);
  return <MpsEntryForm value={state} onChange={setState} />;
}

const renderForm = (initial: MpsFormState = emptyMpsState()) =>
  render(<Harness initial={initial} />);

const positive = (): MpsFormState => ({
  ...emptyMpsState(),
  parasiteSeen: 'Seen',
  densityPlus: '++',
  densityCount: '240',
  species: 'Plasmodium falciparum',
  stage: 'Trophozoites (ring forms)',
});

describe('The malaria film form', () => {
  it('gives every control a name', () => {
    renderForm(positive());

    expect(screen.getByRole('combobox', { name: /parasite detection|parasites seen/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /density/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /species/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /stage/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /parasites per|quantitative/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /comment|morphology/i })).toBeInTheDocument();
  });

  /**
   * The form used to fill in a species the moment "Seen" was chosen: switching
   * from negative set species to Plasmodium falciparum and stage to ring forms,
   * on the reasoning that they are the commonest. But falciparum and vivax are
   * not interchangeable — vivax carries hypnozoites and needs primaquine on
   * top — so a species nobody read off the slide is a treatment decision the
   * form made for the technologist. It may offer a shortcut; it may not
   * pre-answer.
   */
  it('does not choose a species when parasites are marked seen', () => {
    renderForm();

    fireEvent.change(screen.getByRole('combobox', { name: /parasite detection|parasites seen/i }), {
      target: { value: 'Seen' },
    });

    const species = screen.getByRole('combobox', { name: /species/i }) as HTMLSelectElement;
    expect(species.value).not.toBe('Plasmodium falciparum');

    const stage = screen.getByRole('combobox', { name: /stage/i }) as HTMLSelectElement;
    expect(stage.value).not.toBe('Trophozoites (ring forms)');
  });

  /** A positive film is not a colour. It has to survive a monochrome print. */
  it('says a film is positive in words, not only in red', () => {
    renderForm(positive());
    // Exact, because the dropdown option says "Seen (positive)" too — the
    // point is the standing marker on the card, not the choice that set it.
    expect(screen.getByText('Positive')).toBeInTheDocument();
  });

  it('carries no positive marker on a negative film', () => {
    renderForm();
    expect(screen.queryByText('Positive')).not.toBeInTheDocument();
  });

  it('does not seize the tab order of the page', () => {
    const { container } = renderForm(positive());

    const hijackers = Array.from(container.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) > 0,
    );
    expect(hijackers.map((el) => el.getAttribute('tabindex'))).toEqual([]);
  });

  /**
   * Marking a film negative clears the findings with it — there is no species
   * on a film with no parasites. That much the form already did.
   */
  it('clears the findings when the film is marked negative', () => {
    renderForm(positive());

    fireEvent.change(screen.getByRole('combobox', { name: /parasite detection|parasites seen/i }), {
      target: { value: 'Not Seen' },
    });

    expect(screen.queryByRole('combobox', { name: /species/i })).not.toBeInTheDocument();
    expect((screen.getByRole('textbox', { name: /parasites per|quantitative/i }) as HTMLInputElement).value)
      .toMatch(/^(Nil)?$/);
  });

  /**
   * The count and the plus grading describe the same parasitaemia. Going
   * positive used to leave the count reading "Nil" beside a density of "+",
   * so the report contradicted itself.
   */
  it('does not leave a Nil count beside a positive density', () => {
    renderForm();

    fireEvent.change(screen.getByRole('combobox', { name: /parasite detection|parasites seen/i }), {
      target: { value: 'Seen' },
    });

    const count = screen.getByRole('textbox', { name: /parasites per|quantitative/i }) as HTMLInputElement;
    expect(count.value).not.toBe('Nil');
  });

  it('hides the species and stage while the film is negative', () => {
    renderForm();
    expect(screen.queryByRole('combobox', { name: /species/i })).not.toBeInTheDocument();
  });
});
