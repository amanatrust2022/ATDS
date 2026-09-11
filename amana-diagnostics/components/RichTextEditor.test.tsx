import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import RichTextEditor from './RichTextEditor';

/**
 * Characterisation tests for the report editor.
 *
 * A radiologist writes the findings and the impression in this; the
 * letterhead is drawn in it. It had no tests. Everything here is about the
 * toolbar, because the editing itself is TipTap's — what this codebase owns
 * is whether the buttons can be found, reached and understood.
 *
 * Written before the rebuild. See decision #28.
 */

function Harness({ initial = '<p>Hello</p>', label = 'Report findings' }: { initial?: string; label?: string }) {
  const [html, setHtml] = useState(initial);
  return <RichTextEditor value={html} onChange={setHtml} ariaLabel={label} />;
}

// TipTap renders on the client after mount, so the toolbar is a tick away.
const renderEditor = async (props: React.ComponentProps<typeof Harness> = {}) => {
  const utils = render(<Harness {...props} />);
  await waitFor(() => expect(screen.getByRole('toolbar')).toBeInTheDocument());
  return utils;
};

describe('The report editor', () => {
  it('names the text area after what it is for', async () => {
    await renderEditor({ label: 'Clinical impression' });
    expect(screen.getByRole('textbox', { name: 'Clinical impression' })).toBeInTheDocument();
  });

  it('groups the buttons in a named toolbar', async () => {
    await renderEditor();
    expect(screen.getByRole('toolbar', { name: /formatting/i })).toBeInTheDocument();
  });

  /**
   * Bold, italic and the alignments are toggles, and the only sign that one
   * was on was a pale blue background. A screen reader heard "Bold, button"
   * whether or not the selection was bold.
   */
  it('says whether a toggle is on', async () => {
    await renderEditor();

    const bold = screen.getByRole('button', { name: /^bold/i });
    expect(bold).toHaveAttribute('aria-pressed');
  });

  it('says that a menu opens something', async () => {
    await renderEditor();

    const font = screen.getByRole('button', { name: /font family/i });
    expect(font).toHaveAttribute('aria-haspopup');
    expect(font).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(font);
    expect(font).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: /arial/i })).toBeInTheDocument();
  });

  /**
   * The table-size picker was an 8×8 grid of <div onClick>. No button, no
   * name, no tab stop: from the keyboard there was no way to insert a table.
   */
  it('lets a keyboard user insert a table', async () => {
    await renderEditor();

    fireEvent.click(screen.getByRole('button', { name: /insert table/i }));
    const cell = screen.getByRole('button', { name: /2 by 3 table/i });
    expect(cell.tagName).toBe('BUTTON');
  });

  it('names each colour, not just its hex code', async () => {
    await renderEditor();

    fireEvent.click(screen.getByRole('button', { name: /text colour/i }));
    expect(screen.getByRole('button', { name: /^red$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /automatic/i })).toBeInTheDocument();
  });

  it('closes an open menu on Escape', async () => {
    await renderEditor();

    const font = screen.getByRole('button', { name: /font family/i });
    fireEvent.click(font);
    expect(font).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(font, { key: 'Escape' });
    expect(font).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the placeholder only while empty', async () => {
    await renderEditor({ initial: '' });
    expect(screen.getByText(/start typing/i)).toBeInTheDocument();
  });

  it('offers the table tools only when the caret is in a table', async () => {
    await renderEditor();
    expect(screen.queryByRole('button', { name: /delete table/i })).not.toBeInTheDocument();
  });
});
