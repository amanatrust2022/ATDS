import { describe, it, expect, vi } from 'vitest';
import { notifyChange, onChange, listenerCount } from './changeBus';

describe('The hub change bus', () => {
  it('rings every listener once, after the current turn of the event loop', async () => {
    const heard: number[] = [];
    const off = onChange((at) => heard.push(at));
    const other = vi.fn();
    const offOther = onChange(other);

    notifyChange();
    // Not yet: the caller's transaction may still be open.
    expect(heard).toHaveLength(0);

    await new Promise(r => setTimeout(r, 0));
    expect(heard).toHaveLength(1);
    expect(other).toHaveBeenCalledTimes(1);

    off();
    offOther();
  });

  it('forgets a listener that unsubscribed, and one that throws does not silence the rest', async () => {
    const gone = vi.fn();
    onChange(gone)();

    const bad = onChange(() => { throw new Error('dead stream'); });
    const good = vi.fn();
    const offGood = onChange(good);

    notifyChange();
    await new Promise(r => setTimeout(r, 0));

    expect(gone).not.toHaveBeenCalled();
    expect(good).toHaveBeenCalledTimes(1);

    bad();
    offGood();
    expect(listenerCount()).toBe(0);
  });
});
