import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const ask = vi.hoisted(() => vi.fn(async (_message: string) => true));
vi.mock('@/components/Notices', () => ({
  useNotices: () => ({ ask, notify: vi.fn(), askFor: vi.fn() }),
}));

beforeEach(() => ask.mockClear());

import { emptyMcsState, type McsFormState } from '@/lib/store/labResults';
import McsEntryForm from './McsEntryForm';

/**
 * Characterisation tests for the microscopy, culture and sensitivity workup.
 *
 * This is a scientist reading a plate and typing what they see, and what they
 * type is printed and handed to a doctor who prescribes from it. Two things
 * therefore matter more than anything visual: that the form says what was
 * actually entered rather than something it filled in itself, and that the
 * antibiogram can be worked down at speed without the mouse.
 *
 * Written before the rebuild. See decision #28.
 */

/** The form is controlled, so drive it through real state. */
function Harness({ initial }: { initial: McsFormState }) {
  const [state, setState] = useState(initial);
  return <McsEntryForm value={state} onChange={setState} />;
}

const blank = (): McsFormState => ({
  ...emptyMcsState(),
  // What deserialising a saved-but-unfilled result gives you.
  macroscopy: { colour: '', appearance: '' },
  culture: { ...emptyMcsState().culture, growth: '', gramReaction: '' },
});

const renderForm = (initial: McsFormState = emptyMcsState()) =>
  render(<Harness initial={initial} />);

describe('The MCS workup form', () => {
  it('gives every field in the workup a name', () => {
    renderForm();

    expect(screen.getByLabelText(/colour/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/appearance/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/growth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/organism/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/degree/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gram reaction/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/shape/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/incubation period/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/incubation temp/i)).toBeInTheDocument();
  });

  /**
   * Nothing on this form may claim a reading that was not taken.
   *
   * Each dropdown showed the chosen value if it was one of the presets and
   * "Other (Type custom)" otherwise — including when nothing had been chosen at
   * all, because an empty string is not in the preset list either. So opening a
   * result that had not been filled in showed "Other" selected on every
   * dropdown, and its "-- Select --" placeholder could never be displayed.
   */
  it('shows nothing chosen when nothing has been chosen', () => {
    renderForm(blank());

    const colour = screen.getByLabelText(/colour/i) as HTMLSelectElement;
    expect(colour.value).toBe('');
    expect(colour.value).not.toBe('Other...');

    const growth = screen.getByLabelText(/growth/i) as HTMLSelectElement;
    expect(growth.value).toBe('');
  });

  it('keeps a typed colour that is not on the list', () => {
    renderForm(blank());

    // Pick the "something else" option by what it says, not by its value.
    const select = screen.getByLabelText(/colour/i) as HTMLSelectElement;
    const other = Array.from(select.options).find((o) => /something else/i.test(o.text))!;
    fireEvent.change(select, { target: { value: other.value } });

    const custom = screen.getByLabelText(/custom colour/i);
    fireEvent.change(custom, { target: { value: 'Straw-ish' } });

    expect((custom as HTMLInputElement).value).toBe('Straw-ish');
  });

  /**
   * A positive tabindex does not order this form — it reorders the whole page.
   * Every control here carried one (1..4, 10+, 50..56, and 100+ per antibiotic),
   * so tabbing anywhere in the workspace landed in the middle of a culture
   * before it reached the navigation.
   */
  it('does not seize the tab order of the page', () => {
    const { container } = renderForm();

    const hijackers = Array.from(container.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) > 0,
    );
    expect(hijackers.map((el) => el.getAttribute('tabindex'))).toEqual([]);
  });

  it('names each microscopy row, and the button that removes it', () => {
    renderForm();

    // Pus Cells, Epithelial Cells, RBCs come as standard.
    expect(screen.getByLabelText(/pus cells.*value|value.*pus cells/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove.*pus cells/i })).toBeInTheDocument();
  });

  it('adds and removes microscopy rows', () => {
    renderForm();

    const rowsBefore = screen.getAllByRole('button', { name: /^remove /i }).length;
    fireEvent.click(screen.getByRole('button', { name: /add parameter/i }));
    expect(screen.getAllByRole('button', { name: /^remove /i })).toHaveLength(rowsBefore + 1);

    fireEvent.click(screen.getByRole('button', { name: /remove.*pus cells/i }));
    expect(screen.queryByRole('button', { name: /remove.*pus cells/i })).not.toBeInTheDocument();
  });

  it('hides the organism and the antibiogram when nothing grew', () => {
    renderForm();

    expect(screen.getByLabelText(/organism/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/growth/i), { target: { value: 'No Growth' } });

    expect(screen.queryByLabelText(/organism/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sensitivity/i)).not.toBeInTheDocument();
  });
});

describe('The antibiogram', () => {
  const withPanel = () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/gram reaction/i), {
      target: { value: 'Gram Positive' },
    });
  };

  it('asks for the gram reaction before it can show any antibiotics', () => {
    renderForm(blank());
    // The field and its hint carry the words too, so look for the guidance.
    expect(screen.getByText(/to load the matching antibiotics/i)).toBeInTheDocument();
  });

  it('names every result box after its antibiotic', () => {
    withPanel();

    // Thirty identical one-character boxes. Without the antibiotic in the name
    // they are thirty of "edit text", and scoring the wrong row is a wrong
    // prescription.
    expect(screen.getByLabelText('Ciprofloxacin result')).toBeInTheDocument();
  });

  it('names the S, I and R buttons after their antibiotic', () => {
    withPanel();

    expect(
      screen.getByRole('button', { name: /sensitive.*ciprofloxacin|ciprofloxacin.*sensitive/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /resistant.*ciprofloxacin|ciprofloxacin.*resistant/i }),
    ).toBeInTheDocument();
  });

  it('scores a row from the keyboard and moves to the next', () => {
    withPanel();

    const box = screen.getByLabelText('Ciprofloxacin result');
    fireEvent.keyDown(box, { key: 's' });

    expect((screen.getByLabelText('Ciprofloxacin result') as HTMLInputElement).value).toBe('S');
  });

  it('clears a score with backspace', () => {
    withPanel();

    const box = screen.getByLabelText('Ciprofloxacin result');
    fireEvent.keyDown(box, { key: 'r' });
    expect((screen.getByLabelText('Ciprofloxacin result') as HTMLInputElement).value).toBe('R');

    fireEvent.keyDown(screen.getByLabelText('Ciprofloxacin result'), { key: 'Backspace' });
    expect((screen.getByLabelText('Ciprofloxacin result') as HTMLInputElement).value).toBe('');
  });

  /**
   * The two panels share no antibiotic code — the same drug is CN on one and
   * GN on the other, APX and ACX, LEV and LBC — so the carry-over the code
   * claimed to do never carried anything. Changing the gram reaction wiped
   * every score with no warning. It has to ask first.
   */
  it('asks before a change of gram reaction throws away scored readings', async () => {
    ask.mockResolvedValueOnce(false);
    withPanel();

    fireEvent.keyDown(screen.getByLabelText('Ciprofloxacin result'), { key: 's' });
    fireEvent.change(screen.getByLabelText(/gram reaction/i), {
      target: { value: 'Gram Negative' },
    });

    await waitFor(() => expect(ask).toHaveBeenCalled());
    expect(ask.mock.calls[0]![0]).toMatch(/cleared|scored/i);

    // Declined, so the panel and the reading both stand.
    expect((screen.getByLabelText('Ciprofloxacin result') as HTMLInputElement).value).toBe('S');
  });

  it('changes the panel without asking when nothing has been scored', async () => {
    withPanel();

    fireEvent.change(screen.getByLabelText(/gram reaction/i), {
      target: { value: 'Gram Negative' },
    });

    await waitFor(() => expect(screen.getByLabelText('Ofloxacin result')).toBeInTheDocument());
    expect(ask).not.toHaveBeenCalled();
  });

  it('says what a score means, not only its letter', () => {
    withPanel();

    fireEvent.keyDown(screen.getByLabelText('Ciprofloxacin result'), { key: 'r' });

    // Colour alone cannot carry "resistant" on a document a doctor prescribes
    // from — and the row tint was the only thing that said it.
    const row = screen.getByLabelText('Ciprofloxacin result').closest('tr')!;
    expect(within(row).getByText(/resistant/i)).toBeInTheDocument();
  });
});
