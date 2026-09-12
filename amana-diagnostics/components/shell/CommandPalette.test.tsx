import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { CommandPalette } from './CommandPalette';

// jsdom has no layout, so it has no scrollIntoView. The palette calls it to
// keep the highlighted row in view.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

/**
 * Tests for the command palette.
 *
 * One defect: the dialog around the palette was named "Search and commands",
 * but the combobox inside it was not named at all — only a placeholder, which
 * is not a name. The other four tests passed against the old palette, which
 * was already a listbox with aria-activedescendant, and are behaviour guards
 * written to hold it still while its last three inline styles moved into
 * Shell.module.css. Said plainly rather than dressed up as findings, per the
 * rule in docs/HANDOFF.md.
 */

const commands = [
  { id: 'reception', label: 'Reception', group: 'Screens', href: '/kano/reception' },
  { id: 'lab', label: 'Laboratory', group: 'Screens', href: '/kano/lab' },
  { id: 'musa', label: 'Musa Bello', meta: 'ATD-0001', group: 'Patients', href: '/kano/p/1' },
];

const show = (over: Partial<React.ComponentProps<typeof CommandPalette>> = {}) =>
  render(
    <CommandPalette open onOpenChange={vi.fn()} commands={commands} {...over} />,
  );

describe('Command palette', () => {
  /**
   * The dialog carried the name; the box the user actually types into carried
   * a placeholder and nothing else, so a screen reader announced the palette
   * and then reached an unnamed field.
   */
  it('names the box the user types into', () => {
    show();

    expect(screen.getByRole('combobox', { name: /search patients, screens and actions/i })).toBeInTheDocument();
  });

  it('is a combobox over a listbox of results', () => {
    show();

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: /results/i })).toBeInTheDocument();
  });

  it('groups the results under headings', () => {
    show();

    expect(screen.getByText('Screens')).toBeInTheDocument();
    expect(screen.getByText('Patients')).toBeInTheDocument();
  });

  it('narrows the results as the user types', () => {
    show();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lab' } });

    expect(screen.getByRole('option', { name: /laboratory/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /musa bello/i })).not.toBeInTheDocument();
  });

  it('moves the highlight with the arrow keys, without moving focus', () => {
    show();

    const box = screen.getByRole('combobox');
    fireEvent.keyDown(box, { key: 'ArrowDown' });

    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveFocus();
  });

  it('says so when nothing matches, rather than showing an empty box', () => {
    show();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzzz' } });

    expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
  });
});
