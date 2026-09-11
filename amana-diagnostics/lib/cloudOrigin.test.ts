import { describe, it, expect } from 'vitest';

import { isDetachedOrigin } from './cloudOrigin';

/**
 * The rule that decides whether a link can be shared.
 *
 * This was three different conditions written across seven call sites, and two
 * of them were wrong in ways nobody would notice from a browser: the desktop
 * app's own `tauri://localhost` failed one test, and a cloud deployment on any
 * other domain failed another. The cases below are those origins.
 */
describe('which origins cannot be shared', () => {
  it.each([
    'tauri://localhost',
    'http://localhost:1420',
    'https://localhost:1420',
  ])('%s is detached — a link to it means nothing to anyone else', (origin) => {
    expect(isDetachedOrigin(origin)).toBe(true);
  });

  it.each([
    'https://app.example.com',
    'http://localhost:3000',
    'http://192.168.1.40:3000',
  ])('%s can be shared as it stands', (origin) => {
    expect(isDetachedOrigin(origin)).toBe(false);
  });

  it('does not mistake the LAN hub on port 3000 for the desktop dev shell', () => {
    // A clinic machine serving the hub to the ward is reachable by every other
    // machine on that network, and its invite links must keep its own address.
    expect(isDetachedOrigin('http://10.0.0.5:3000')).toBe(false);
  });
});
