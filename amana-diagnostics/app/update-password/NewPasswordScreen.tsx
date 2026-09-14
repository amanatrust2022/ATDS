'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { claimRecoveryLink, sendPasswordReset } from '@/lib/passwordReset';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiLockPasswordLine, RiCheckLine, RiEyeLine, RiEyeOffLine, RiMailLine } from '@remixicon/react';

import styles from '../login/login.module.css';

/**
 * Set new password: the last step of a reset, reached from an emailed link.
 *
 * Shares the sign-in screen's stylesheet — it is the same front door and
 * commits to the same single dark treatment.
 *
 * What the old screen owed a keyboard user: two password fields with no label
 * (a placeholder is not one), two reveal buttons with no name, an error painted
 * red that nothing announced, and password fields that did not tell the browser
 * they were new credentials. And its success redirect was a bare setTimeout
 * with nothing to cancel it if the screen left first.
 *
 * The screen also owed everyone one more thing: to read the emailed link
 * itself. It used to assume a session had arrived and only found out it had
 * not when the submit failed. Now the link is claimed first
 * (lib/passwordReset.ts); an expired or used link is said so, with a way to
 * ask for a fresh one right here.
 */

const cx = (...names: Array<string | undefined | false>) => names.filter(Boolean).join(' ');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withTimeout(promise: any, ms: number, onWarning: () => void): Promise<any> {
  const timer = setTimeout(onWarning, ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [link, setLink] = useState<{ state: 'checking' } | { state: 'ready' } | { state: 'blocked'; message: string }>({ state: 'checking' });
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Claim the link before showing a form that could not work without it.
  useEffect(() => {
    let cancelled = false;
    claimRecoveryLink(window.location.href).then((outcome) => {
      if (cancelled) return;
      setLink(outcome.ok ? { state: 'ready' } : { state: 'blocked', message: outcome.message });
    });
    return () => { cancelled = true; };
  }, []);

  // If the screen leaves before the redirect fires, cancel it.
  useEffect(() => () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true); setError('');
    try {
      const updatePromise = supabase.auth.updateUser({ password });
      const { error } = await withTimeout(
        updatePromise,
        10000,
        () => setError('Slow network connection detected. Still updating password… please wait.')
      );
      if (error) {
        setError(/session/i.test(error.message) ? 'The reset link is no longer valid. Ask for a new one below.' : error.message);
        if (/session/i.test(error.message)) setLink({ state: 'blocked', message: 'This link has expired or was already used.' });
        setLoading(false);
        return;
      }
      setDone(true);
      redirectTimer.current = setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError((err as { message?: string })?.message || 'An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) { setError('Enter the email address of your account.'); return; }
    setResending(true); setError('');
    try {
      const { error } = await sendPasswordReset(resendEmail);
      if (error) setError(error.message);
      else setResent(true);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={cx(styles.page, styles.single)}>
      <main className={styles.main}>
        <div className={styles.form}>
          <div className={styles.centred}>
            <span className={styles.brandMark} aria-hidden="true">
              <RiMicroscopeLine size={20} />
            </span>
            <h1 className={styles.heading}>Set new password</h1>
            <p className={styles.sub}>Choose a strong password for your account.</p>
          </div>

          {done ? (
            <div className={styles.sent} role="status">
              <span className={styles.sentMark} aria-hidden="true">
                <RiCheckLine size={22} />
              </span>
              <p className={styles.heading}>Password updated</p>
              <p className={styles.sub}>Taking you to your workspace…</p>
            </div>
          ) : link.state === 'checking' ? (
            <p className={styles.sub} role="status">Checking your link…</p>
          ) : link.state === 'blocked' ? (
            resent ? (
              <div className={styles.sent} role="status">
                <span className={styles.sentMark} aria-hidden="true">
                  <RiCheckLine size={22} />
                </span>
                <p className={styles.heading}>New link sent</p>
                <p className={styles.sub}>Check {resendEmail.trim()} and open the link on any device.</p>
              </div>
            ) : (
              <form onSubmit={handleResend} className={styles.form} noValidate>
                <p className={styles.error} role="alert">
                  <span className={styles.errorMark} aria-hidden="true">!</span>
                  <span>{error || link.message}</span>
                </p>
                <div>
                  <label className={styles.label} htmlFor="np-email">Email address</label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon} aria-hidden="true">
                      <RiMailLine size={16} />
                    </span>
                    <input
                      id="np-email"
                      className={styles.input}
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="you@clinic.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className={styles.submit} disabled={resending} aria-busy={resending}>
                  {resending ? 'Sending…' : 'Send me a new link'}
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleUpdate} className={styles.form} noValidate>
              {error && (
                <p className={styles.error} role="alert">
                  <span className={styles.errorMark} aria-hidden="true">!</span>
                  <span>{error}</span>
                </p>
              )}

              <div>
                <label className={styles.label} htmlFor="np-password">New password</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <RiLockPasswordLine size={16} />
                  </span>
                  <input
                    id="np-password"
                    className={styles.input}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    aria-invalid={error ? true : undefined}
                    required
                  />
                  <button
                    type="button"
                    className={styles.reveal}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className={styles.label} htmlFor="np-confirm">Confirm new password</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <RiLockPasswordLine size={16} />
                  </span>
                  <input
                    id="np-confirm"
                    className={styles.input}
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    aria-invalid={error ? true : undefined}
                    required
                  />
                  <button
                    type="button"
                    className={styles.reveal}
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    aria-pressed={showConfirm}
                  >
                    {showConfirm ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className={styles.submit} disabled={loading} aria-busy={loading}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
