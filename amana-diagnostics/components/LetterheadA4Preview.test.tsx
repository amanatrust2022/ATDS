import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import LetterheadA4Preview from './LetterheadA4Preview';

/**
 * Characterisation tests for the A4 letterhead preview.
 *
 * Paper, so its geometry is the design and stays inline (decision #31). What
 * is under test is the chrome around the sheet and what the preview says to
 * someone who cannot see it. Written before the rebuild (decision #28).
 */

const letterhead = '<p>Amana Diagnostics</p><p>12 Zaria Road, Kano</p>';

describe('A4 letterhead preview', () => {
  /**
   * The sheet carried a sample report block — a patient name, a patient ID, an
   * age and a sex — and nothing anywhere said it was a sample. On an admin
   * settings page, a screen reader announced what sounded exactly like a real
   * patient's record sitting in the middle of a form.
   */
  it('says the report block on the sheet is a sample', () => {
    render(<LetterheadA4Preview html={letterhead} />);

    expect(screen.getByRole('figure', { name: /sample/i })).toBeInTheDocument();
  });

  /**
   * The dashed guides are draughtsman's marks over the paper, not part of the
   * letterhead — but their labels were plain text, read out in among the
   * report content with no way to tell which was which.
   */
  it('keeps the measurement guides out of the reading order', () => {
    render(<LetterheadA4Preview html={letterhead} bgHtml="<p>frame</p>" />);

    for (const label of [/bottom margin/i, /report prints here/i]) {
      const mark = screen.getByText(label);
      expect(mark.closest('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  // Behaviour guards: the sheet still shows the letterhead it was handed, and
  // the footer only when there is one. Both held before.
  it('draws the letterhead it was given', () => {
    render(<LetterheadA4Preview html={letterhead} />);

    expect(screen.getByText(/12 Zaria Road, Kano/)).toBeInTheDocument();
  });

  it('draws a footer only when one is supplied', () => {
    const { rerender } = render(<LetterheadA4Preview html={letterhead} />);
    expect(screen.queryByText(/Accredited by MLSCN/)).not.toBeInTheDocument();

    rerender(<LetterheadA4Preview html={letterhead} footerHtml="<p>Accredited by MLSCN</p>" />);
    expect(screen.getByText(/Accredited by MLSCN/)).toBeInTheDocument();
  });
});
