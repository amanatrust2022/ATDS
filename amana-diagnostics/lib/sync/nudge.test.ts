import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nudgeSync, onSyncNudge } from './nudge';
import { postJson } from '@/lib/repositories/localHttp';

describe('Asking the cloud sync to run now', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('reaches whoever is listening, and stops when they stop', () => {
    const run = vi.fn();
    const stop = onSyncNudge(run);

    nudgeSync();
    expect(run).toHaveBeenCalledTimes(1);

    stop();
    nudgeSync();
    expect(run).toHaveBeenCalledTimes(1);
  });

  // A result saved on the bench used to sit on the hub for up to fifteen
  // seconds before anything sent it to the cloud. The write is the moment.
  it('is rung by every write the hub accepts, and not by one it refused', async () => {
    const run = vi.fn();
    const stop = onSyncNudge(run);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await postJson('/api/patients', { action: 'updateTestResult' }, 'failed');
    expect(run).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'no' }) });
    await expect(postJson('/api/patients', { action: 'updateTestResult' }, 'failed')).rejects.toThrow('no');
    expect(run).toHaveBeenCalledTimes(1);

    stop();
  });
});
