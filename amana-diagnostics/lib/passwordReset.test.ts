import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * The reset link "never worked". These pin down the three reasons and that
 * each is now handled: the link works on any device (implicit flow), it
 * returns to an address Supabase will redirect to (the cloud, from a hub),
 * and the screen reads what the link left in the address bar itself.
 */

const resetPasswordForEmail = vi.fn<(...a: any[]) => any>();
const bareOptions: any[] = [];
vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, _key: string, options: any) => {
    bareOptions.push(options);
    return { auth: { resetPasswordForEmail } };
  },
}));

const setSession = vi.fn<(...a: any[]) => any>();
const exchangeCodeForSession = vi.fn<(...a: any[]) => any>();
const getSession = vi.fn<(...a: any[]) => any>();
vi.mock('@/lib/supabase', () => ({
  supabaseConfig: () => ({ url: 'https://x.supabase.co', anonKey: 'anon' }),
  createClient: () => ({ auth: { setSession, exchangeCodeForSession, getSession } }),
}));

let mode: 'local' | 'cloud' = 'cloud';
vi.mock('@/lib/runtimeMode', () => ({ getRuntimeMode: () => mode }));
vi.mock('@/lib/cloudOrigin', () => ({
  CLOUD_ORIGIN: 'https://clinic.example',
  isDetachedOrigin: (o: string) => o.startsWith('tauri://'),
}));

import { sendPasswordReset, passwordResetRedirect, readRecoveryLink, isRecoveryLink, claimRecoveryLink } from './passwordReset';

beforeEach(() => {
  mode = 'cloud';
  bareOptions.length = 0;
  resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  setSession.mockReset().mockResolvedValue({ error: null });
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  getSession.mockReset().mockResolvedValue({ data: { session: null } });
});

describe('sending the reset email', () => {
  it('uses the implicit flow, so the link works on any device', async () => {
    await sendPasswordReset(' aisha@clinic.ng ');
    expect(bareOptions[0].auth).toMatchObject({ flowType: 'implicit', persistSession: false });
    expect(resetPasswordForEmail).toHaveBeenCalledWith('aisha@clinic.ng', { redirectTo: expect.stringMatching(/\/update-password$/) });
  });

  it('returns to the page’s own origin on the cloud', () => {
    expect(passwordResetRedirect()).toBe(`${window.location.origin}/update-password`);
  });

  it('returns to the cloud from a hub, whose own address means nothing elsewhere', () => {
    mode = 'local';
    expect(passwordResetRedirect()).toBe('https://clinic.example/update-password');
  });
});

describe('reading the link', () => {
  it('finds the tokens an implicit link carries', () => {
    expect(readRecoveryLink('https://clinic.example/update-password#access_token=a&refresh_token=r&type=recovery'))
      .toEqual({ kind: 'tokens', accessToken: 'a', refreshToken: 'r' });
  });

  it('finds the code an older PKCE link carries', () => {
    expect(readRecoveryLink('https://clinic.example/update-password?code=abc')).toEqual({ kind: 'code', code: 'abc' });
  });

  it('reads the error Supabase attaches to an expired link', () => {
    const link = readRecoveryLink('https://clinic.example/update-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(link).toMatchObject({ kind: 'error', code: 'otp_expired' });
  });

  it('recognises a recovery link that landed on the wrong page', () => {
    expect(isRecoveryLink('https://clinic.example/#access_token=a&refresh_token=r&type=recovery')).toBe(true);
    expect(isRecoveryLink('https://clinic.example/#error_code=otp_expired')).toBe(true);
    expect(isRecoveryLink('https://clinic.example/login')).toBe(false);
  });
});

describe('claiming the link', () => {
  it('turns the tokens into a session', async () => {
    const out = await claimRecoveryLink('https://clinic.example/update-password#access_token=a&refresh_token=r&type=recovery');
    expect(out).toEqual({ ok: true });
    expect(setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
  });

  it('says an expired link is expired', async () => {
    const out = await claimRecoveryLink('https://clinic.example/update-password#error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(out).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('explains a PKCE link opened on another device', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'PKCE code verifier not found in storage' } });
    const out = await claimRecoveryLink('https://clinic.example/update-password?code=abc');
    expect(out).toMatchObject({ ok: false, reason: 'wrong_device' });
  });

  it('with no link, accepts a session already here and refuses otherwise', async () => {
    expect(await claimRecoveryLink('https://clinic.example/update-password')).toMatchObject({ ok: false, reason: 'no_link' });
    getSession.mockResolvedValue({ data: { session: { user: {} } } });
    expect(await claimRecoveryLink('https://clinic.example/update-password')).toEqual({ ok: true });
  });
});
