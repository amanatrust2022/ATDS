import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AppearanceSettings } from './AppearanceSettings';
import { AppearanceProvider } from '@/components/ui';

/**
 * Tests for the appearance card — theme and row height.
 *
 * Unlike the rest of this queue, no test here failed against the old card:
 * it was already built on the design system, its radio groups already had
 * legends, and its icons were already marked decorative. There was no defect
 * to find, so all four are behaviour guards, written to hold the card still
 * while its last three inline styles moved to a stylesheet. Saying so rather
 * than dressing them up as findings — see the rule in docs/HANDOFF.md.
 */

const show = () =>
  render(
    <AppearanceProvider>
      <AppearanceSettings />
    </AppearanceProvider>,
  );

describe('Appearance settings', () => {
  it('offers the three themes, system among them', () => {
    show();

    expect(screen.getByRole('radio', { name: /match my device/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /dark/i })).toBeInTheDocument();
  });

  it('offers the three row heights', () => {
    show();

    expect(screen.getByRole('radio', { name: /compact/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /standard/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /comfortable/i })).toBeInTheDocument();
  });

  it('names both groups, so the radios are not loose on the page', () => {
    show();

    expect(screen.getByRole('group', { name: /theme/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /row height/i })).toBeInTheDocument();
  });

  it('takes the choice the user makes', () => {
    show();

    fireEvent.click(screen.getByRole('radio', { name: /dark/i }));

    expect(screen.getByRole('radio', { name: /dark/i })).toBeChecked();
  });
});
