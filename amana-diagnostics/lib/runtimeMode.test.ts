import { describe, it, expect } from 'vitest';
import { decideRuntimeMode, isPrivateHostname } from './runtimeMode';

describe('isPrivateHostname', () => {
  it('knows the loopback and the three private ranges', () => {
    for (const h of ['localhost', '127.0.0.1', '192.168.0.122', '10.0.0.5', '172.16.0.1', '172.31.255.254', 'hub.local']) {
      expect(isPrivateHostname(h), h).toBe(true);
    }
  });

  it('does not treat every 172.x address as private', () => {
    // 172.16/12 is the private block. 172.32+ and 172.0-15 are public.
    expect(isPrivateHostname('172.32.0.1')).toBe(false);
    expect(isPrivateHostname('172.15.0.1')).toBe(false);
    expect(isPrivateHostname('172.217.16.14')).toBe(false);
  });

  it('treats a public host as the cloud', () => {
    expect(isPrivateHostname('amanadiagnostics.com')).toBe(false);
    expect(isPrivateHostname('app.vercel.app')).toBe(false);
  });
});

describe('decideRuntimeMode', () => {
  it('follows the stored flag on a private host', () => {
    expect(decideRuntimeMode({ hostname: 'localhost', storedFlag: 'false' })).toBe('cloud');
    expect(decideRuntimeMode({ hostname: '192.168.0.2', storedFlag: 'true' })).toBe('local');
  });

  it('ignores a stale "hub" flag on a public host', () => {
    // The same browser was on the hub yesterday and the web app today.
    expect(decideRuntimeMode({ hostname: 'amanadiagnostics.com', storedFlag: 'true' })).toBe('cloud');
  });

  it('decides by hostname when nothing is stored', () => {
    expect(decideRuntimeMode({ hostname: '10.1.1.1', storedFlag: null })).toBe('local');
    expect(decideRuntimeMode({ hostname: 'amanadiagnostics.com', storedFlag: null })).toBe('cloud');
  });

  it('knows the desktop shell always embeds a hub', () => {
    expect(decideRuntimeMode({ hostname: 'localhost', isTauri: true })).toBe('local');
  });

  it('uses the process environment on the server', () => {
    expect(decideRuntimeMode({ serverLocal: true })).toBe('local');
    expect(decideRuntimeMode({ serverLocal: false })).toBe('cloud');
  });
});
