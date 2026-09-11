import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { emptyWidalState, type WidalFormState } from '@/lib/store/labResults';
import WidalEntryForm from './WidalEntryForm';

/**
 * Characterisation tests for the Widal agglutination matrix.
 *
 * Eight titres across four salmonella antigens, each read off a tile. The
 * matrix is the whole test, and the only thing distinguishing one dropdown
 * from the next used to be where it sat in the grid — so by keyboard or by
 * screen reader it was eight identical combo boxes, and putting 1:160 in the
 * wrong one reports typhoid on the wrong antigen.
 *
 * Written before the rebuild. See decision #28.
 */

function Harness({ initial }: { initial: WidalFormState }) {
  const [state, setState] = useState(initial);
  return <WidalEntryForm value={state} onChange={setState} />;
}

const renderForm = (initial: WidalFormState = emptyWidalState()) =>
  render(<Harness initial={initial} />);

describe('The Widal matrix', () => {
  /**
   * Named by antigen and by limb. "S. Typhi O" and "S. Typhi H" mean different
   * things clinically — O rises in acute infection, H persists after it and
   * after vaccination — so the pair cannot share one name.
   */
  it('names all eight titres by antigen and limb', () => {
    renderForm();

    for (const antigen of ['S. Typhi', 'S. Paratyphi A', 'S. Paratyphi B', 'S. Paratyphi C']) {
      expect(screen.getByRole('combobox', { name: new RegExp(`${antigen} O`, 'i') })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: new RegExp(`${antigen} H`, 'i') })).toBeInTheDocument();
    }
  });

  it('sets one titre without disturbing its neighbour', () => {
    renderForm();

    const typhiO = screen.getByRole('combobox', { name: /S\. Typhi O/i }) as HTMLSelectElement;
    fireEvent.change(typhiO, { target: { value: '1:160' } });

    expect((screen.getByRole('combobox', { name: /S\. Typhi O/i }) as HTMLSelectElement).value).toBe('1:160');
    expect((screen.getByRole('combobox', { name: /S\. Typhi H/i }) as HTMLSelectElement).value).toBe('Negative');
  });

  /**
   * A significant titre was red and bold and nothing else. Red is not a
   * reading: it does not print, it does not read aloud, and roughly one man in
   * twelve cannot rely on it. The word goes beside the number.
   */
  it('says which titres are significant, not only colours them', () => {
    renderForm({ ...emptyWidalState(), typhiO: '1:160' });

    const row = screen.getByRole('combobox', { name: /S\. Typhi O/i }).closest('tr')!;
    expect(within(row).getByText(/significant/i)).toBeInTheDocument();
  });

  it('does not call a low titre significant', () => {
    renderForm({ ...emptyWidalState(), typhiO: '1:40' });

    const row = screen.getByRole('combobox', { name: /S\. Typhi O/i }).closest('tr')!;
    expect(within(row).queryByText(/significant/i)).not.toBeInTheDocument();
  });

  it('gives the matrix a caption and proper column headers', () => {
    renderForm();

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3);
  });

  it('does not seize the tab order of the page', () => {
    const { container } = renderForm();

    const hijackers = Array.from(container.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) > 0,
    );
    expect(hijackers.map((el) => el.getAttribute('tabindex'))).toEqual([]);
  });
});
