import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import LetterheadDesigner from './LetterheadDesigner';

/**
 * Characterisation tests for the letterhead design canvas.
 *
 * The canvas itself is a mouse tool — drag, resize, rotate — and is not what
 * these test. What this codebase owes a keyboard user is the chrome around it:
 * that every button can be found by name, that a toggle says whether it is
 * on, and that adding an element produces the HTML the printer will get.
 *
 * Written before the rebuild. See decision #28.
 */

function Harness({ initial = '' }: { initial?: string }) {
  const [html, setHtml] = useState(initial);
  return (
    <>
      <LetterheadDesigner value={html} onChange={setHtml} />
      <output data-testid="out">{html}</output>
    </>
  );
}

describe('The letterhead designer', () => {
  it('groups the tools in a named toolbar', () => {
    render(<Harness />);
    expect(screen.getByRole('toolbar', { name: /letterhead tools/i })).toBeInTheDocument();
  });

  it('adds a text box and emits it as positioned HTML', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^text box/i }));

    const out = screen.getByTestId('out').textContent || '';
    expect(out).toContain('data-letterhead-canvas');
    expect(out).toContain('data-type="text"');
  });

  /**
   * Undo and redo were icon-only buttons whose only name was a tooltip; the
   * snap toggle was a button whose state was a blue border.
   */
  it('names undo, redo and snap, and says whether snap is on', () => {
    render(<Harness />);

    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled();

    const snap = screen.getByRole('button', { name: /snap/i });
    expect(snap).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(snap);
    expect(snap).toHaveAttribute('aria-pressed', 'false');
  });

  it('enables undo after a change, and undoing removes the element', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^text box/i }));

    const undo = screen.getByRole('button', { name: /undo/i });
    expect(undo).toBeEnabled();
    fireEvent.click(undo);

    expect(screen.getByTestId('out').textContent).not.toContain('data-type="text"');
  });

  it('says that the shapes button opens a menu', () => {
    render(<Harness />);

    const shapes = screen.getByRole('button', { name: /shapes/i });
    expect(shapes).toHaveAttribute('aria-haspopup');
    expect(shapes).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(shapes);
    expect(shapes).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: /star/i })).toBeInTheDocument();
  });

  it('names the canvas height field', () => {
    render(<Harness />);
    expect(screen.getByRole('spinbutton', { name: /height/i })).toBeInTheDocument();
  });

  /**
   * The bold, italic, underline and alignment toggles in the inspector had no
   * name at all — not even a tooltip — and showed their state as a blue
   * border. A screen reader heard "button" seven times.
   */
  it('names the text formatting toggles and says which are on', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^text box/i }));

    const inspector = screen.getByRole('region', { name: /properties/i });
    const bold = within(inspector).getByRole('button', { name: /^bold$/i });
    expect(bold).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(bold);
    expect(bold).toHaveAttribute('aria-pressed', 'true');

    // New text is centred, as a letterhead usually is.
    expect(within(inspector).getByRole('button', { name: /align centre/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('names the position and size fields', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^text box/i }));

    expect(screen.getByRole('spinbutton', { name: /^x$/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /^w$/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /opacity/i })).toBeInTheDocument();
  });

  it('deletes the selected element from the inspector', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /^text box/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(screen.getByTestId('out').textContent).not.toContain('data-type="text"');
  });
});
