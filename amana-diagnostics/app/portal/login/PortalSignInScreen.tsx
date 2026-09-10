'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, Button, Field, Input } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/lib/branding';
import { startPortalSession } from '@/lib/portalSession';

import styles from './login.module.css';

/**
 * The one portal screen that runs before anyone knows which clinic the visitor
 * belongs to — the email address is what identifies them, and it has not been
 * typed yet. So this screen carries no tenant branding at all, where it used
 * to show one particular clinic's logo to every patient of every clinic.
 */
export default function PortalSignInScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [otpState, setOtpState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function sendCode() {
    setLoading(true);
    setError('');
    setSent(false);
    try {
      const res = await fetch('/api/portal/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'We could not send a code to that address.');

      setStep('code');
      setOtpState(data.state || '');
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/otp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: code.trim(), state: otpState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'That code did not match. Check it and try again.');

      startPortalSession(data.token, data.email);
      router.push('/portal/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles['page']}>
      <div className={styles['card']}>
        <div className={styles['brand']}>
          <span className={styles['mark']} aria-hidden="true">
            {/* An envelope: what this screen does is send you something. */}
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </span>
          <span className={styles['brandText']}>Patient portal</span>
        </div>

        {step === 'email' ? (
          <form
            className={styles['form']}
            onSubmit={(e) => {
              e.preventDefault();
              void sendCode();
            }}
            noValidate
          >
            <div>
              <h1 className={styles['heading']}>See your results</h1>
              <p className={styles['sub']}>
                Enter the email address you gave your clinic. We will send a six-digit code
                to it — there is no password to remember.
              </p>
            </div>

            {error && (
              <Alert tone="critical" live>
                {error}
              </Alert>
            )}

            <Field label="Email address">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>

            <Button
              type="submit"
              intent="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={!email.trim()}
            >
              Send me a code
            </Button>
          </form>
        ) : (
          <form
            className={styles['form']}
            onSubmit={(e) => {
              e.preventDefault();
              void verifyCode();
            }}
            noValidate
          >
            <div>
              <h1 className={styles['heading']}>Check your email</h1>
              <p className={styles['sub']}>
                We sent a six-digit code to <strong>{email}</strong>. It expires in ten
                minutes.
              </p>
            </div>

            {sent && !error && (
              <Alert tone="success" live>
                Code sent. It may take a minute to arrive — check your spam folder if it
                does not.
              </Alert>
            )}

            {error && (
              <Alert tone="critical" live>
                {error}
              </Alert>
            )}

            <Field label="Six-digit code">
              <Input
                className={styles['code']}
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </Field>

            <Button
              type="submit"
              intent="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={code.length !== 6}
            >
              Sign in
            </Button>

            <div className={styles['alternatives']}>
              <Button
                intent="link"
                size="sm"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setOtpState('');
                  setError('');
                  setSent(false);
                }}
              >
                Use a different email
              </Button>
              <Button intent="link" size="sm" disabled={loading} onClick={() => { setCode(''); void sendCode(); }}>
                Send a new code
              </Button>
            </div>
          </form>
        )}
      </div>

      <p className={styles['help']}>
        {/* This read `mailto:{SUPPORT_EMAIL}` — a literal in the href, not the
          * constant — so the one link a stuck patient had opened a mail
          * composer addressed to nobody. */}
        Stuck? Write to <a className={styles['link']} href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </div>
  );
}
