'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PortalLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpState, setOtpState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const res = await fetch('/api/portal/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to send code');

      setStep('otp');
      setOtpState(data.state || '');
      setInfo('A 6-digit verification code has been sent to your email.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/portal/otp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), state: otpState }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Verification failed');

      // Store session token
      localStorage.setItem('portal_token', data.token);
      localStorage.setItem('portal_email', data.email);

      router.push('/portal/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.bg}>
      {/* Background decorative elements */}
      <div style={styles.bgCircle1} />
      <div style={styles.bgCircle2} />

      <div style={styles.card}>
        {/* Logo / Branding */}
        <div style={styles.logoArea}>
          <div style={styles.logoIcon}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="16" fill="#0563c1" />
              <path d="M16 8v16M8 16h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 style={styles.orgName}>Amana Trust Diagnostics</h1>
            <p style={styles.portalLabel}>Patient Portal</p>
          </div>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleSendOtp} style={styles.form}>
            <h2 style={styles.heading}>Sign In to Your Portal</h2>
            <p style={styles.subheading}>
              Enter the email address you used when registering at our clinic. We'll send you a secure verification code.
            </p>

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="portal-email">Email Address</label>
              <input
                id="portal-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={styles.input}
                autoComplete="email"
              />
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              style={{ ...styles.btn, opacity: loading || !email.trim() ? 0.7 : 1 }}
            >
              {loading ? 'Sending Code…' : 'Send Verification Code →'}
            </button>

            <p style={styles.footerNote}>
              This portal is for viewing your diagnostic results and medical history only.
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={styles.form}>
            <h2 style={styles.heading}>Enter Verification Code</h2>
            <p style={styles.subheading}>
              We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.
            </p>

            {info && <div style={styles.infoBox}>{info}</div>}

            <div style={styles.fieldGroup}>
              <label style={styles.label} htmlFor="portal-otp">6-Digit Code</label>
              <input
                id="portal-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                required
                style={{ ...styles.input, ...styles.otpInput }}
                autoComplete="one-time-code"
                autoFocus
              />
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              style={{ ...styles.btn, opacity: loading || otp.length !== 6 ? 0.7 : 1 }}
            >
              {loading ? 'Verifying…' : 'Access My Portal →'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('email'); setOtp(''); setOtpState(''); setError(''); }}
              style={styles.backBtn}
            >
              ← Use a different email
            </button>

            <button
              type="button"
              onClick={() => { setOtp(''); handleSendOtp({ preventDefault: () => {} } as any); }}
              style={styles.resendBtn}
              disabled={loading}
            >
              Resend code
            </button>
          </form>
        )}
      </div>

      <p style={styles.bottomNote}>
        Need help? Contact us at{' '}
        <a href="mailto:amanatrust2022@gmail.com" style={styles.link}>
          amanatrust2022@gmail.com
        </a>
      </p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bg: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a1628 0%, #0c2347 50%, #111d3b 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    position: 'relative',
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    top: '-120px',
    right: '-120px',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(5, 99, 193, 0.25) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: '-80px',
    left: '-80px',
    width: '300px',
    height: '300px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(201, 151, 58, 0.15) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '0px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '460px',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
    animation: 'fadeIn 0.4s ease forwards',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  logoIcon: {
    flexShrink: 0,
  },
  orgName: {
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '700',
    fontFamily: '"Times New Roman", Times, serif',
    margin: '0',
    lineHeight: '1.2',
  },
  portalLabel: {
    color: '#85a9eb',
    fontSize: '11px',
    fontFamily: '"IBM Plex Sans", sans-serif',
    margin: '2px 0 0',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    fontWeight: '500',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  heading: {
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: '700',
    fontFamily: '"Times New Roman", Times, serif',
    margin: '0 0 10px',
  },
  subheading: {
    color: '#b0bcd4',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '0 0 28px',
    fontFamily: '"IBM Plex Sans", sans-serif',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '20px',
  },
  label: {
    color: '#85a9eb',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    fontFamily: '"IBM Plex Sans", sans-serif',
  },
  input: {
    background: 'rgba(255, 255, 255, 0.07)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '0px',
    padding: '14px 16px',
    color: '#ffffff',
    fontSize: '15px',
    fontFamily: '"IBM Plex Sans", sans-serif',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
  },
  otpInput: {
    fontSize: '28px',
    letterSpacing: '14px',
    textAlign: 'center',
    fontFamily: '"IBM Plex Mono", monospace',
    padding: '16px 16px',
  },
  errorBox: {
    background: 'rgba(192, 57, 43, 0.15)',
    border: '1px solid rgba(192, 57, 43, 0.4)',
    color: '#f5b7b1',
    padding: '12px 16px',
    fontSize: '14px',
    marginBottom: '16px',
    fontFamily: '"IBM Plex Sans", sans-serif',
    lineHeight: '1.5',
  },
  infoBox: {
    background: 'rgba(30, 126, 90, 0.15)',
    border: '1px solid rgba(30, 126, 90, 0.4)',
    color: '#a9dfbf',
    padding: '12px 16px',
    fontSize: '14px',
    marginBottom: '16px',
    fontFamily: '"IBM Plex Sans", sans-serif',
    lineHeight: '1.5',
  },
  btn: {
    background: 'linear-gradient(135deg, #0563c1 0%, #1e7e5a 100%)',
    color: '#ffffff',
    border: 'none',
    padding: '15px 24px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: '"IBM Plex Sans", sans-serif',
    letterSpacing: '0.3px',
    transition: 'transform 0.15s, box-shadow 0.15s',
    width: '100%',
    marginBottom: '12px',
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: '#85a9eb',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: '"IBM Plex Sans", sans-serif',
    padding: '4px 0',
    textDecoration: 'underline',
    marginBottom: '8px',
    textAlign: 'left',
  },
  resendBtn: {
    background: 'transparent',
    border: 'none',
    color: '#85a9eb',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: '"IBM Plex Sans", sans-serif',
    padding: '4px 0',
    textDecoration: 'underline',
    textAlign: 'left',
  },
  footerNote: {
    color: '#6b7fa0',
    fontSize: '12px',
    marginTop: '4px',
    fontFamily: '"IBM Plex Sans", sans-serif',
    lineHeight: '1.5',
    textAlign: 'center',
  },
  bottomNote: {
    color: '#6b7fa0',
    fontSize: '13px',
    marginTop: '24px',
    fontFamily: '"IBM Plex Sans", sans-serif',
    textAlign: 'center',
  },
  link: {
    color: '#85a9eb',
    textDecoration: 'underline',
  },
};
