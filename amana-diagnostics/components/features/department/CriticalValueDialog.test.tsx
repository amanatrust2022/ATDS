import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { CriticalValueDialog } from './CriticalValueDialog';

/**
 * Tests for the release interlock.
 *
 * This is the one dialog in the product that a technologist is not allowed to
 * dismiss by accident: on the other side of it is a panic value going to
 * reception without anyone having looked at it. It had no tests at all.
 */

type Rows = React.ComponentProps<typeof CriticalValueDialog>['rows'];

const rows = (): Rows =>
  [
    {
      row: { parameter: 'Potassium', result: '7.1', unit: 'mmol/L', range: '3.5-5.1' },
      flag: 'HH',
    },
  ] as unknown as Rows;

const renderDialog = (over: Partial<React.ComponentProps<typeof CriticalValueDialog>> = {}) => {
  const onCancel = vi.fn();
  const onAcknowledge = vi.fn();
  const utils = render(
    <CriticalValueDialog
      rows={rows()}
      professional="A. Bello"
      onCancel={onCancel}
      onAcknowledge={onAcknowledge}
      {...over}
    />,
  );
  return { ...utils, onCancel, onAcknowledge };
};

const releaseButton = () => screen.getByRole('button', { name: /acknowledge and release/i });
const tickbox = () => screen.getByRole('checkbox');

describe('The critical value interlock', () => {
  it('stays out of the way when nothing is critical', () => {
    render(
      <CriticalValueDialog
        rows={[] as unknown as Rows}
        professional="A. Bello"
        onCancel={vi.fn()}
        onAcknowledge={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the figure, its units and the range it broke', () => {
    renderDialog();

    expect(screen.getByText('Potassium')).toBeInTheDocument();
    expect(screen.getByText(/7\.1/)).toBeInTheDocument();
    expect(screen.getByText(/3\.5-5\.1/)).toBeInTheDocument();
  });

  /** The whole point: nothing is released until a human says they checked. */
  it('will not release until the value has been read back', () => {
    const { onAcknowledge } = renderDialog();

    expect(releaseButton()).toBeDisabled();
    fireEvent.click(releaseButton());
    expect(onAcknowledge).not.toHaveBeenCalled();

    fireEvent.click(tickbox());

    expect(releaseButton()).toBeEnabled();
    fireEvent.click(releaseButton());
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });

  it('lets the technologist go back and check instead', () => {
    const { onCancel } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /go back and check/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  /**
   * Escape closes every other dialog in the product. Here it would mean a
   * critical result released — or the decision skipped — by a keystroke aimed
   * at something else.
   */
  it('does not close on Escape', () => {
    const { onAcknowledge } = renderDialog();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onAcknowledge).not.toHaveBeenCalled();
  });

  /**
   * Each set of criticals is its own decision. A tick carried over from the
   * last patient would release this one unread.
   */
  it('starts unticked again for a new set of values', () => {
    const { rerender } = renderDialog();

    fireEvent.click(tickbox());
    expect(releaseButton()).toBeEnabled();

    const next = [
      {
        row: { parameter: 'Haemoglobin', result: '4.0', unit: 'g/dL', range: '12-16' },
        flag: 'LL',
      },
    ] as unknown as Rows;

    rerender(
      <CriticalValueDialog
        rows={next}
        professional="A. Bello"
        onCancel={vi.fn()}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(releaseButton()).toBeDisabled();
  });

  it('says whose name the acknowledgement goes against', () => {
    renderDialog();
    expect(screen.getByText(/recorded against A\. Bello/i)).toBeInTheDocument();
  });

  it('says to enter a name when there is none to record', () => {
    renderDialog({ professional: '' });
    expect(screen.getByText(/enter your name on the form first/i)).toBeInTheDocument();
  });
});
