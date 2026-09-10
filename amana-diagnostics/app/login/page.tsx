'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiLockPasswordLine, RiMailLine, RiEyeLine, RiEyeOffLine, RiComputerLine } from '@remixicon/react';
import styles from './login.module.css';

async function withTimeout(promise: any, ms: number, onWarning: () => void): Promise<any> {
  const timer = setTimeout(onWarning, ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

export default function LoginPage() {
  const isLocalMode = typeof window !== 'undefined'
    ? (localStorage.getItem('amana_local_mode') === null
        ? (window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' || 
           window.location.hostname.startsWith('192.168.') || 
           window.location.hostname.startsWith('10.') || 
           window.location.hostname.startsWith('172.'))
        : localStorage.getItem('amana_local_mode') === 'true')
    : (process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Signing in...');
  const [error, setError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showLanGuide, setShowLanGuide] = useState(false);
  const [serverIp, setServerIp] = useState('127.0.0.1:3000');
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (isLocalMode) {
      fetch('/api/config')
        .then(res => res.json())
        .then(data => {
          if (data.serverIp) setServerIp(data.serverIp);
        })
        .catch(err => console.error('Failed to load server IP:', err));
    }
  }, [isLocalMode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    localStorage.removeItem('amana_offline_session');
    setStatusText('Checking local database...');

    // 1. In Local Mode, prioritize local sqlite verification first (takes ~10ms)
    if (isLocalMode) {
      try {
        const localRes = await fetch('/api/auth/local-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        if (localRes.ok) {
          const localSession = await localRes.json();
          localStorage.setItem('amana_offline_session', JSON.stringify({
            user: localSession.user,
            profile: localSession.profile,
            organization: localSession.organization,
            session: null
          }));
          
          // Asynchronously perform background cloud login check to cache/sync session
          supabase.auth.signInWithPassword({ email, password }).then((res: any) => {
            if (res && !res.error && res.data?.user) {
              fetch('/api/auth/save-credentials', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, userId: res.data.user.id })
              }).catch(console.error);
            }
          }).catch(console.error);

          window.location.reload();
          return;
        }
      } catch (localLoginErr) {
        console.warn('Local check failed or local server not running, falling back to cloud login:', localLoginErr);
      }
    }

    // 2. Cloud login - with responsive progress steps to keep UI feeling instantaneous and alive
    setStatusText('Connecting to cloud server...');
    const timer1 = setTimeout(() => setStatusText('Verifying credentials on cloud...'), 1200);
    const timer2 = setTimeout(() => setStatusText('Syncing clinical workspace...'), 3200);

    try {
      let data, error;
      try {
        const res = await supabase.auth.signInWithPassword({ email, password });
        data = res.data;
        error = res.error;
      } catch (err: any) {
        error = { message: err.message || 'Connection failed.', status: 0 };
      }
      
      clearTimeout(timer1);
      clearTimeout(timer2);

      if (!error && data?.user) {
        // Success — clear stale cache first (prevents old profile from showing during reload)
        // then do a full page reload so AuthProvider starts fresh with the new Supabase tokens.
        //
        // WHY reload instead of relying on onAuthStateChange:
        //   Supabase's SDK may NOT fire SIGNED_IN if the browser already has an active session
        //   (e.g. on 2nd+ logins in the same browser). Reloading always gives us a clean boot.
        localStorage.removeItem('amana_offline_session');

        if (isLocalMode) {
          // Local Mode: also save credentials to local SQLite for offline auth
          try {
            await fetch('/api/auth/save-credentials', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, userId: data.user.id })
            });
          } catch (saveErr) {
            console.error('Failed to save credentials locally:', saveErr);
          }
        }

        // Reload for both modes — Supabase's own tokens are in its storage and will be picked up.
        // Use a full navigation so the auth provider gets a fresh boot in cloud mode.
        console.log('[LoginPage] sign-in succeeded, navigating to home');
        window.location.assign('/');

        return;
      }

      const isNetworkError = error?.message?.includes('fetch') || 
                             error?.message?.includes('network') || 
                             error?.message?.includes('timed out') || 
                             error?.status === 0 || 
                             (error && typeof window !== 'undefined' && !window.navigator.onLine);

      if (isLocalMode && isNetworkError) {
        try {
          const localRes = await fetch('/api/auth/local-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          
          if (localRes.ok) {
            const localSession = await localRes.json();
            localStorage.setItem('amana_offline_session', JSON.stringify({
              user: localSession.user,
              profile: localSession.profile,
              organization: localSession.organization,
              session: null
            }));
            
            window.location.reload();
            return;
          } else {
            const localErr = await localRes.json();
            setError(localErr.error || 'Invalid credentials');
            setLoading(false);
            return;
          }
        } catch (localLoginErr) {
          console.error('Local login execution failed:', localLoginErr);
        }
      }

      setError(error ? error.message : 'Login failed');
      setLoading(false);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const resetPromise = supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      const { error } = await withTimeout(
        resetPromise,
        10000,
        () => setError('Slow network connection detected. Still sending password reset email... please wait.')
      );
      if (error) setError(error.message);
      else setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Connection timed out. Please try again.');
    }
    setLoading(false);
  };

  const submitting = loading;

  return (
    <div className={styles.page}>
      {/* --- Brand panel --- */}
      <aside className={styles.aside}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <RiMicroscopeLine size={19} />
          </span>
          <span className={styles.brandName}>DiagnosticOS</span>
          <span className={styles.version}>v1.2.20</span>
        </div>

        <div className={styles.pitch}>
          <h2 className={styles.pitchHead}>Reception, lab and radiology on one record.</h2>
          <p className={styles.pitchBody}>
            Built for diagnostic centres that cannot depend on the internet staying up.
          </p>
          <ul className={styles.points}>
            <li className={styles.point}>
              <span className={styles.pointMark} aria-hidden="true">&bull;</span>
              Keeps working offline, and syncs when the connection returns
            </li>
            <li className={styles.point}>
              <span className={styles.pointMark} aria-hidden="true">&bull;</span>
              Results flagged against their reference range as they are typed
            </li>
            <li className={styles.point}>
              <span className={styles.pointMark} aria-hidden="true">&bull;</span>
              Patients collect their own reports from the portal
            </li>
          </ul>
        </div>

        <p className={styles.asideFoot}>
          Every device on the clinic network works from the same records.
        </p>
      </aside>

      {/* --- Form panel --- */}
      <main className={styles.main}>
        {resetSent ? (
          <div className={styles.form}>
            <div className={styles.sent}>
              <span className={styles.sentMark} aria-hidden="true">
                <RiMailLine size={20} />
              </span>
              <h1 className={styles.heading}>Check your email</h1>
              <p className={styles.sub}>
                If {email} has an account, a link to set a new password is on its way.
                It expires in an hour.
              </p>
              <button
                type="button"
                className={styles.link}
                onClick={() => { setResetMode(false); setResetSent(false); }}
              >
                Back to sign in
              </button>
            </div>
          </div>
        ) : (
          <form
            className={styles.form}
            onSubmit={resetMode ? handleReset : handleLogin}
            noValidate
          >
            <div className={styles.mobileBrand}>
              <span className={styles.brandMark} aria-hidden="true">
                <RiMicroscopeLine size={17} />
              </span>
              <span className={styles.brandName}>DiagnosticOS</span>
            </div>

            <div>
              <h1 className={styles.heading}>
                {resetMode ? 'Reset your password' : 'Sign in'}
              </h1>
              <p className={styles.sub}>
                {resetMode
                  ? 'We will email you a link to set a new one.'
                  : 'Use the address your centre registered you with.'}
              </p>
            </div>

            {/* role="alert" so a failed sign-in is announced when it happens,
              * not only when the field is next focused. */}
            {error && (
              <p className={styles.error} role="alert">
                <span className={styles.errorMark} aria-hidden="true">!</span>
                <span>{error}</span>
              </p>
            )}

            <div>
              <label className={styles.label} htmlFor="login-email">Email address</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <RiMailLine size={16} />
                </span>
                <input
                  id="login-email"
                  className={styles.input}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@centre.example"
                  required
                  aria-invalid={error ? true : undefined}
                />
              </div>
            </div>

            {!resetMode && (
              <div>
                <label className={styles.label} htmlFor="login-password">Password</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <RiLockPasswordLine size={16} />
                  </span>
                  <input
                    id="login-password"
                    className={styles.input}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Your password"
                    required
                    aria-invalid={error ? true : undefined}
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
            )}

            <button type="submit" className={styles.submit} disabled={submitting} aria-busy={submitting}>
              {submitting
                ? (resetMode ? 'Sending the link…' : statusText)
                : (resetMode ? 'Email me a reset link' : 'Sign in')}
            </button>

            <div className={styles.row}>
              <button
                type="button"
                className={styles.link}
                onClick={() => { setResetMode(!resetMode); setError(''); }}
              >
                {resetMode ? 'Back to sign in' : 'Forgotten your password?'}
              </button>
              <a href="/signup" className={styles.link}>Create a workspace</a>
            </div>

            {isLocalMode && (
              <div className={styles.lan}>
                <button
                  type="button"
                  className={styles.lanToggle}
                  onClick={() => setShowLanGuide(!showLanGuide)}
                  aria-expanded={showLanGuide}
                  aria-controls="lan-guide"
                >
                  <RiComputerLine size={15} aria-hidden="true" />
                  Connect another device in the clinic
                </button>

                {showLanGuide && (
                  <div className={styles.lanBody} id="lan-guide">
                    <p><strong>To use reception, lab or radiology from another device:</strong></p>
                    <ol className={styles.lanSteps}>
                      <li>Put the device on the same Wi-Fi or network cable as this computer.</li>
                      <li>
                        Open its browser and go to:
                        <code className={styles.address}>http://{serverIp}</code>
                      </li>
                      <li>Bookmark it, so tomorrow is one tap.</li>
                    </ol>
                    <p className={styles.lanNote}>
                      This computer has to stay on and running DiagnosticOS for the others to reach it.
                    </p>
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </main>
    </div>
  );
}
