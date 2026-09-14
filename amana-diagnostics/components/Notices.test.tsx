import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NoticeProvider, useNotices } from './Notices';
import type { NoticeOptions } from './Notices';

function Trigger({ message, options }: { message: string; options?: NoticeOptions }) {
  const { notify } = useNotices();
  return (
    <button type="button" onClick={() => notify(message, options ?? 'success')}>
      go
    </button>
  );
}

describe('notify with an action', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the action and runs it, then clears the card', async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    render(
      <NoticeProvider>
        <Trigger message="Role changed" options={{ tone: 'success', action: { label: 'Undo', run } }} />
      </NoticeProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByText('Role changed')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Role changed')).not.toBeInTheDocument();
  });

  it('stays longer than a plain notice so there is time to reach it', () => {
    render(
      <NoticeProvider>
        <Trigger message="With undo" options={{ action: { label: 'Undo', run: () => {} } }} />
      </NoticeProvider>,
    );
    fireEvent.click(screen.getByText('go'));

    act(() => {
      vi.advanceTimersByTime(4600);
    });
    expect(screen.getByText('With undo')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.queryByText('With undo')).not.toBeInTheDocument();
  });

  it('still takes a bare tone, the way every existing call site passes it', () => {
    render(
      <NoticeProvider>
        <Trigger message="Plain" />
      </NoticeProvider>,
    );
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByText('Plain')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4600);
    });
    expect(screen.queryByText('Plain')).not.toBeInTheDocument();
  });

  it('reports an action that fails as an error notice', async () => {
    const run = vi.fn().mockRejectedValue(new Error('the cloud said no'));
    render(
      <NoticeProvider>
        <Trigger message="Settled" options={{ action: { label: 'Undo', run } }} />
      </NoticeProvider>,
    );
    fireEvent.click(screen.getByText('go'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });
    expect(screen.queryByText('Settled')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Undo did not go through: the cloud said no');
  });
});
