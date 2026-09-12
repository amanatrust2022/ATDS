import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import SensitivityTable from './SensitivityTable';
import type { McsFormState } from '@/lib/store/labResults';

/**
 * Characterisation tests for the antibiogram.
 *
 * A doctor prescribes from this grid, so what it says out loud matters more
 * here than anywhere else in the product. Written before the rebuild
 * (decision #28).
 */

type Sensitivity = McsFormState['sensitivity'];

const panel = [
  { code: 'AMP', antibiotic: 'Ampicillin', result: '' },
  { code: 'CIP', antibiotic: 'Ciprofloxacin', result: '' },
] as unknown as Sensitivity;

const show = (sensitivity: Sensitivity = panel, onResult = vi.fn()) => {
  render(
    <SensitivityTable sensitivity={sensitivity} gramReaction="Gram negative" onResult={onResult} />,
  );
  return onResult;
};

describe('Antibiotic sensitivity', () => {
  /**
   * The antibiotic sat in a plain <td>, so it was not the row's header. A
   * screen reader moving across the grid announced a result without the drug
   * it belonged to — on the one table in the product where confusing two rows
   * is a wrong prescription.
   */
  it('makes the antibiotic the row header', () => {
    show();

    expect(screen.getByRole('rowheader', { name: /ampicillin/i })).toBeInTheDocument();
  });

  // Behaviour guards. These held before the rebuild.
  it('names the grid for a screen reader', () => {
    show();

    expect(screen.getAllByRole('table', { name: /antibiotic sensitivity/i }).length)
      .toBeGreaterThan(0);
  });

  it('names each score box after its drug', () => {
    show();

    expect(screen.getByRole('textbox', { name: /ampicillin result/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /ciprofloxacin result/i })).toBeInTheDocument();
  });

  it('spells out what a score means, rather than leaving a letter and a tint', () => {
    const scored = [{ code: 'AMP', antibiotic: 'Ampicillin', result: 'R' }] as unknown as Sensitivity;
    show(scored);

    const row = screen.getByRole('row', { name: /ampicillin/i });
    expect(within(row).getByText('Resistant')).toBeInTheDocument();
  });

  it('scores a row from the keyboard', () => {
    const onResult = show();

    fireEvent.keyDown(screen.getByRole('textbox', { name: /ampicillin result/i }), { key: 'r' });

    expect(onResult).toHaveBeenCalledWith(0, 'R');
  });

  it('offers the three scores as pressable buttons too', () => {
    const onResult = show();

    fireEvent.click(screen.getByRole('button', { name: /ampicillin: sensitive/i }));

    expect(onResult).toHaveBeenCalledWith(0, 'S');
  });

  it('asks for a gram reaction before loading a panel', () => {
    render(<SensitivityTable sensitivity={[] as unknown as Sensitivity} gramReaction="" onResult={vi.fn()} />);

    expect(screen.getByText(/choose a gram reaction/i)).toBeInTheDocument();
  });
});
