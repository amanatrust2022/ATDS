import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Stat, formatDelta } from './Stat';

describe('Stat', () => {
  it('shows the label and the figure', () => {
    render(<Stat label="Billed" value="₦120,000" />);
    expect(screen.getByText('Billed')).toBeInTheDocument();
    expect(screen.getByText('₦120,000')).toBeInTheDocument();
  });

  it('shows a placeholder while loading, never a figure', () => {
    render(<Stat label="Billed" value="0" loading delta={{ value: 5, direction: 'up', label: 'vs' }} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading Billed' })).toBeInTheDocument();
    expect(screen.queryByText('vs')).not.toBeInTheDocument();
  });

  it('reads the change and its comparison period', () => {
    render(
      <Stat
        label="Visits"
        value="42"
        delta={{ value: 12.5, direction: 'up', label: 'vs same day last week', sentiment: 'good' }}
      />,
    );
    expect(screen.getByText('+13%')).toBeInTheDocument();
    expect(screen.getByText('vs same day last week')).toBeInTheDocument();
  });

  it('colours by sentiment, not by direction', () => {
    const { container } = render(
      <Stat
        label="Outstanding"
        value="₦9,000"
        delta={{ value: 30, direction: 'up', label: 'vs last week', sentiment: 'bad' }}
      />,
    );
    const delta = container.querySelector('[class*="delta"]')!;
    expect(delta.className).toMatch(/bad/);
    expect(delta.className).not.toMatch(/good/);
  });

  it('shows no percentage for a flat change', () => {
    render(<Stat label="Visits" value="0" delta={{ value: 0, direction: 'flat', label: 'no prior data' }} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByText('no prior data')).toBeInTheDocument();
  });

  it('becomes a link when given somewhere to go', () => {
    render(<Stat label="Waiting" value="3" href="/kano/lab" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/kano/lab');
    expect(link).toHaveTextContent('Waiting');
    expect(link).toHaveTextContent('3');
  });

  it('draws a sparkline only when there is a series to draw', () => {
    const { rerender } = render(<Stat label="Billed" value="1" spark={[1, 2, 3]} />);
    expect(screen.getByRole('img', { name: 'Billed, recent trend' })).toBeInTheDocument();
    rerender(<Stat label="Billed" value="1" spark={[1]} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('formatDelta', () => {
  it('keeps one decimal only for small changes', () => {
    expect(formatDelta(3.25)).toBe('+3.3%');
    expect(formatDelta(-12.7)).toBe('−13%');
    expect(formatDelta(0)).toBe('0%');
  });
});
