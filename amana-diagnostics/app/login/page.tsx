'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiLockPasswordLine, RiMailLine } from '@remixicon/react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    
    const isLocalMode = typeof window !== 'undefined'
      ? (localStorage.getItem('amana_local_mode') === 'true' || 
         window.location.hostname === 'localhost' || 
         window.location.hostname === '127.0.0.1' || 
         window.location.hostname.startsWith('192.168.') || 
         window.location.hostname.startsWith('10.') || 
         window.location.hostname.startsWith('172.'))
      : (process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true');

    try {
      // 1. Try Supabase Auth first
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (!error && data?.user) {
        // Successful online login! Cache credentials locally
        if (isLocalMode) {
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
        return;
      }

      // If it's a network/connection error AND we are in local mode, attempt local login fallback
      const isNetworkError = error?.message?.includes('fetch') || 
                             error?.message?.includes('network') || 
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
            // Cache the local session so AuthProvider loads it
            localStorage.setItem('amana_offline_session', JSON.stringify({
              user: localSession.user,
              profile: localSession.profile,
              organization: localSession.organization,
              session: null
            }));
            
            // Force a reload to let AuthProvider pick up the cached session
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
      setError(err.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) setError(error.message);
    else setResetSent(true);
    setLoading(false);
  };

  const inp: React.CSSProperties = { width: '100%', padding: '0.75rem 0.9rem 0.75rem 2.8rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: '0.9rem', outline: 'none' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', fontFamily: 'var(--font-body)' }}>
      <style>{`input::placeholder { color: rgba(255,255,255,0.2); } input:focus { border-color: #4472c4 !important; }`}</style>

      {/* Left panel - branding */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #111c3d 0%, #0a0f1e 100%)', padding: '3rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ background: '#4472c4', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RiMicroscopeLine size={18} color="white" />
          </div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>DiagnosticOS</span>
        </div>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.78rem', fontStyle: 'italic' }}>
            "We cut patient wait time by 40% in the first month."
          </p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', marginTop: '0.5rem' }}>— Admin, Northside Diagnostics</p>
        </div>
      </div>

      {/* Right panel - form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {resetSent ? (
            <div style={{ textAlign: 'center', color: 'white' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
              <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Check your email</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>We sent a password reset link to {email}</p>
              <button onClick={() => { setResetMode(false); setResetSent(false); }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.6rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>Back to sign in</button>
            </div>
          ) : (
            <>
              <h2 style={{ color: 'white', fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                {resetMode ? 'Reset password' : 'Sign in to your workspace'}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', marginBottom: '2rem' }}>
                {resetMode ? 'Enter your email to receive a reset link.' : 'Enter your credentials to continue.'}
              </p>
              <form onSubmit={resetMode ? handleReset : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ position: 'relative' }}>
                  <RiMailLine size={16} color="rgba(255,255,255,0.25)" style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Email address" style={inp} />
                </div>
                {!resetMode && (
                  <div style={{ position: 'relative' }}>
                    <RiLockPasswordLine size={16} color="rgba(255,255,255,0.25)" style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Password" style={inp} />
                  </div>
                )}
                {error && <p style={{ color: '#f87171', fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', padding: '0.6rem 0.9rem', borderRadius: 6 }}>{error}</p>}
                <button type="submit" disabled={loading} style={{ background: loading ? '#2a4a8a' : '#4472c4', border: 'none', color: 'white', padding: '0.8rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.25rem' }}>
                  {loading ? (resetMode ? 'Sending...' : 'Signing in...') : (resetMode ? 'Send reset link' : 'Sign in')}
                </button>
              </form>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                <button onClick={() => { setResetMode(!resetMode); setError(''); }} style={{ background: 'none', border: 'none', color: '#7fa3e0', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>
                  {resetMode ? '← Back to sign in' : 'Forgot password?'}
                </button>
                <a href="/signup" style={{ color: '#7fa3e0', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}>Create workspace →</a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
