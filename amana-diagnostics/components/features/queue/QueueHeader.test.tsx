import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { QueueHeader } from './QueueHeader';
import { useQueueStore } from '@/lib/store/useQueueStore';

/**
 * Characterisation tests for the queue's filter bar. Written before the
 * rebuild (decision #28).
 */

beforeEach(() => {
  useQueueStore.setState({ searchQuery: '', deptFilter: 'all', dateFilter: 'today' });
});

describe('Queue filter bar', () => {
  /**
   * The search box had a placeholder and nothing else — no label, no
   * aria-label — so a screen reader reached the first control on the queue
   * with no name for it.
   */
  it('names the search box', () => {
    render(<QueueHeader />);

    expect(screen.getByRole('searchbox', { name: /search the queue/i })).toBeInTheDocument();
  });

  /**
   * Both filter rows carried their selection in fill alone: a white pill for
   * the date window, a solid teal one for the department. Nothing was pressed,
   * nothing was grouped, and nothing said out loud which window the queue was
   * currently showing.
   */
  it('reports which date window is in force', () => {
    render(<QueueHeader />);

    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Last 7 Days' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports which department filter is in force', () => {
    render(<QueueHeader />);

    expect(screen.getByRole('button', { name: /^all$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /radiology/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('names the two groups of filters', () => {
    render(<QueueHeader />);

    expect(screen.getByRole('group', { name: /date/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /department/i })).toBeInTheDocument();
  });

  // Behaviour guards. These held before; kept so the rebuild does not lose
  // the filtering itself.
  it('records what the receptionist searches for', () => {
    render(<QueueHeader />);

    fireEvent.change(screen.getByPlaceholderText('Search by name or slip number...'), {
      target: { value: 'Musa' },
    });

    expect(useQueueStore.getState().searchQuery).toBe('Musa');
  });

  it('widens the date window when asked', () => {
    render(<QueueHeader />);

    fireEvent.click(screen.getByRole('button', { name: 'Last 30 Days' }));

    expect(useQueueStore.getState().dateFilter).toBe('thirty_days');
  });

  it('hides the department filter on the results tab', () => {
    render(<QueueHeader isResultsTab />);

    expect(screen.queryByRole('button', { name: /radiology/i })).not.toBeInTheDocument();
  });
});
