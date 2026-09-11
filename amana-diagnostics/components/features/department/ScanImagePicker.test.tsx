import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import ScanImagePicker from './ScanImagePicker';

/**
 * Characterisation tests for the scan image picker.
 *
 * Fifteen reference images a radiologist attaches to the report. They were
 * <div onClick> tiles: not focusable, not announced, not operable by anything
 * but a mouse, and whether one was attached was carried by a purple border and
 * a nine-pixel tick.
 *
 * Written before the rebuild. See decision #28.
 */

const BPD = '/uss-pics/BPD.jpg';

describe('The scan image picker', () => {
  it('offers each image as a control that says whether it is attached', () => {
    render(<ScanImagePicker images={[]} onToggle={vi.fn()} />);

    const tile = screen.getByRole('button', { name: /obstetric \(BPD\)/i });
    expect(tile).toHaveAttribute('aria-pressed', 'false');
  });

  it('attaches and detaches an image', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ScanImagePicker images={[]} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole('button', { name: /obstetric \(BPD\)/i }));
    expect(onToggle).toHaveBeenCalledWith(BPD);

    rerender(<ScanImagePicker images={[BPD]} onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: /obstetric \(BPD\)/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  /** A purple border and a tick glyph are not a state anyone can hear. */
  it('says in words how many images are attached', () => {
    render(<ScanImagePicker images={[BPD]} onToggle={vi.fn()} />);
    expect(screen.getByText(/1 image attached/i)).toBeInTheDocument();
  });

  it('says when none are attached', () => {
    render(<ScanImagePicker images={[]} onToggle={vi.fn()} />);
    expect(screen.getByText(/no images attached/i)).toBeInTheDocument();
  });

  it('shows a thumbnail for every option', () => {
    const { container } = render(<ScanImagePicker images={[]} onToggle={vi.fn()} />);
    // The thumbnails carry alt="" on purpose: the button around each one
    // already states the name and whether it is attached, and a duplicate alt
    // would have a screen reader read the same thing twice.
    expect(container.querySelectorAll('img')).toHaveLength(15);
  });

  it('does not seize the tab order of the page', () => {
    const { container } = render(<ScanImagePicker images={[]} onToggle={vi.fn()} />);

    const hijackers = Array.from(container.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) > 0,
    );
    expect(hijackers.map((el) => el.getAttribute('tabindex'))).toEqual([]);
  });
});
