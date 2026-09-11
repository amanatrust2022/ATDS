'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiLockPasswordLine, RiCheckLine, RiEyeLine, RiEyeOffLine } from '@remixicon/react';

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
  const supabase = createClient();
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (error) { setError(error.message); setLoading(false); return; }
      setDone(true);
      redirectTimer.current = setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError((err as { message?: string })?.message || 'An unexpected error occurred. Please try again.');
      setLoading(false);
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
              <p className={styles.sub}>Redirecting you to sign in…</p>
            </div>
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
