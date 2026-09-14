import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { subscribeHubEvents, lastKnownSyncState } from './hubEvents';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  listeners: Record<string, Array<(e: any) => void>> = {};
  constructor(url: string) { this.url = url; FakeEventSource.instances.push(this); }
  addEventListener(event: string, fn: (e: any) => void) { (this.listeners[event] ||= []).push(fn); }
  emit(event: string, data?: string) { (this.listeners[event] || []).forEach((fn) => fn({ data })); }
  close() { this.closed = true; }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  (globalThis as any).EventSource = FakeEventSource;
});
afterEach(() => { delete (globalThis as any).EventSource; });

describe('the shared hub stream', () => {
  it('opens one connection per clinic per tab, however many listen', () => {
    const a: string[] = [];
    const b: string[] = [];
    const leaveA = subscribeHubEvents('org-1', { onChange: () => a.push('change') });
    const leaveB = subscribeHubEvents('org-1', { onChange: () => b.push('change') });

    expect(FakeEventSource.instances).toHaveLength(1);
    FakeEventSource.instances[0].emit('change');
    expect(a).toEqual(['change']);
    expect(b).toEqual(['change']);

    leaveA();
    expect(FakeEventSource.instances[0].closed).toBe(false);
    leaveB();
    expect(FakeEventSource.instances[0].closed).toBe(true);
  });

  it('tells a late listener the stream is already open, and what the engine last said', () => {
    subscribeHubEvents('org-2', {});
    const source = FakeEventSource.instances[0];
    source.onopen?.();
    source.emit('sync', JSON.stringify({ status: 'synced', pendingCount: 0 }));

    let opened = false;
    let seen: any = null;
    subscribeHubEvents('org-2', { onOpen: () => { opened = true; }, onSync: (s) => { seen = s; } });

    expect(opened).toBe(true);
    expect(seen?.status).toBe('synced');
    expect(lastKnownSyncState('org-2')?.status).toBe('synced');
  });

  it('ignores a sync event that is not JSON', () => {
    let seen: any = 'untouched';
    subscribeHubEvents('org-3', { onSync: (s) => { seen = s; } });
    FakeEventSource.instances[0].emit('sync', '{not json');
    expect(seen).toBe('untouched');
  });

  it('falls back at once where there is no EventSource', () => {
    delete (globalThis as any).EventSource;
    let errored = false;
    subscribeHubEvents('org-4', { onError: () => { errored = true; } });
    expect(errored).toBe(true);
  });
});
