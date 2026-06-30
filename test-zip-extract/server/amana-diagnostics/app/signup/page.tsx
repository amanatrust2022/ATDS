'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiArrowLeftLine, RiCheckLine, RiMailLine } from '@remixicon/react';

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Step = 1 | 2 | 'confirm';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [org, setOrg] = useState({ name: '', slug: '', address: '', phone: '', email: '', letterheadLine2: '' });
  const [admin, setAdmin] = useState({ fullName: '', email: '', password: '', confirm: '' });

  const [checkingOrg, setCheckingOrg] = useState(false);

  const handleOrgNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org.name || !org.slug) { setError('Organisation name and workspace ID are required.'); return; }
    if (!/^[a-z0-9-]+$/.test(org.slug)) { setError('Workspace ID can only contain lowercase letters, numbers, and hyphens.'); return; }
    
    setCheckingOrg(true);
    setError('');
    try {
      const { data: exists, error: checkErr } = await supabase.rpc('check_slug_exists', { p_slug: org.slug });
      if (checkErr) throw checkErr;
      if (exists) {
        setError('This Workspace ID (slug) is already taken. Please choose a different one.');
        return;
      }
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to verify Workspace ID availability. Please try again.');
    } finally {
      setCheckingOrg(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (admin.password !== admin.confirm) { setError('Passwords do not match.'); return; }
    if (admin.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true); setError('');

    let createdOrgId: string | null = null;
    try {
      localStorage.setItem('pending_org', JSON.stringify(org));

      // 1. Create organization to reserve the slug
      const { data: newOrg, error: orgErr } = await supabase.rpc('create_organization_for_signup', {
        p_name:    org.name,
        p_slug:    org.slug,
        p_address: org.address || null,
        p_phone:   org.phone   || null,
        p_email:   org.email   || null,
        p_letterhead_line2: org.letterheadLine2 || null,
      });

      if (orgErr) {
        if (orgErr.message.includes('SLUG_TAKEN')) {
          throw new Error('This Workspace ID (slug) is already taken. Please choose a different one.');
        } else {
          throw orgErr;
        }
      }
      createdOrgId = newOrg.id;

      // 2. Sign up user account with organization_id in metadata
      const { data, error: authErr } = await supabase.auth.signUp({
        email: admin.email,
        password: admin.password,
        options: {
          data: { 
            full_name: admin.fullName, 
            role: 'admin',
            organization_id: createdOrgId,
            pending_org_name: org.name,
            pending_org_slug: org.slug,
            pending_org_address: org.address,
            pending_org_phone: org.phone,
            pending_org_email: org.email,
            pending_org_letterhead_line2: org.letterheadLine2
          },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        }
      });

      if (authErr) throw authErr;

      // If user already exists, identities will be empty
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error('This email address is already registered. Please sign in instead.');
      }

      if (data.session) {
        router.push('/onboarding?new=1');
      } else {
        setStep('confirm');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during sign up.');
      
      // Rollback organization reservation if signup fails
      if (createdOrgId) {
        try {
          await supabase.rpc('delete_organization_rollback', { p_org_id: createdOrgId });
        } catch (rollbackErr) {
          console.warn('Rollback failed:', rollbackErr);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '0.7rem 0.9rem',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: 'white', fontSize: '0.9rem', outline: 'none',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'var(--font-body)' }}>
      <style>{`input::placeholder { color: rgba(255,255,255,0.2); } input:focus { border-color: #4472c4 !important; box-shadow: 0 0 0 3px rgba(68,114,196,0.15); }`}</style>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: '#4472c4', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <RiMicroscopeLine size={24} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700 }}>
            {step === 'confirm' ? 'Check your email' : 'Create your workspace'}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            {step === 'confirm' ? `We sent a confirmation link to ${admin.email}` : 'Start your free trial — no credit card required'}
          </p>
        </div>

        {/* ── Email confirm screen ── */}
        {step === 'confirm' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 72, height: 72, background: 'rgba(68,114,196,0.1)', border: '2px solid rgba(68,114,196,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <RiMailLine size={32} color="#4472c4" />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '2rem' }}>
              Click the link in your email to confirm your account and set up your workspace. The link will bring you back here automatically.
            </p>
            <div style={{ background: 'rgba(68,114,196,0.08)', border: '1px solid rgba(68,114,196,0.2)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: '#7fa3e0' }}>
              💡 Tip: Check your spam/junk folder if you don't see it within a minute.
            </div>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', padding: '0.6rem 1.5rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', width: '100%' }}>
              ← Resend or use a different email
            </button>
          </div>
        )}

        {/* ── Step indicator (steps 1 & 2 only) ── */}
        {step !== 'confirm' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            {(['Facility details', 'Admin account'] as const).map((label, i) => (
              <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ height: 3, borderRadius: 2, background: i < step ? '#4472c4' : 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: '0.68rem', color: i + 1 === step ? '#7fa3e0' : 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Step 1: Facility details ── */}
        {step === 1 && (
          <form onSubmit={handleOrgNext} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label style={lbl}>Facility / Organisation Name *</label>
              <input style={inp} value={org.name} onChange={e => setOrg({ ...org, name: e.target.value, slug: slugify(e.target.value) })} placeholder="e.g. Amana Trust Diagnostics" required />
            </div>
            <div>
              <label style={lbl}>Letterhead Second Line (Optional)</label>
              <input style={inp} value={org.letterheadLine2} onChange={e => setOrg({ ...org, letterheadLine2: e.target.value })} placeholder="e.g. AND CLINICAL SERVICES LTD" />
            </div>
            <div>
              <label style={lbl}>Workspace ID *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>app.com/</span>
                <input style={{ ...inp, paddingLeft: '5.5rem' }} value={org.slug} onChange={e => setOrg({ ...org, slug: slugify(e.target.value) })} placeholder="amana-trust" required />
              </div>
              <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.3rem' }}>Lowercase letters, numbers, hyphens only.</p>
            </div>
            <div><label style={lbl}>Address</label><input style={inp} value={org.address} onChange={e => setOrg({ ...org, address: e.target.value })} placeholder="No. 15 C Tudun Wada Bus Stop" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div><label style={lbl}>Phone</label><input style={inp} value={org.phone} onChange={e => setOrg({ ...org, phone: e.target.value })} placeholder="+234..." /></div>
              <div><label style={lbl}>Facility Email</label><input style={inp} type="email" value={org.email} onChange={e => setOrg({ ...org, email: e.target.value })} placeholder="info@facility.com" /></div>
            </div>
            {error && <p style={{ color: '#f87171', fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', padding: '0.6rem 0.9rem', borderRadius: 6 }}>{error}</p>}
            <button type="submit" disabled={checkingOrg} style={{ background: checkingOrg ? '#2a4a8a' : '#4472c4', border: 'none', color: 'white', padding: '0.8rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: checkingOrg ? 'not-allowed' : 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {checkingOrg ? 'Checking workspace ID...' : 'Continue to Admin Setup →'}
            </button>
          </form>
        )}

        {/* ── Step 2: Admin account ── */}
        {step === 2 && (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div><label style={lbl}>Your Full Name *</label><input style={inp} value={admin.fullName} onChange={e => setAdmin({ ...admin, fullName: e.target.value })} placeholder="e.g. Dr. Aisha Ibrahim" required /></div>
            <div><label style={lbl}>Email Address *</label><input style={inp} type="email" value={admin.email} onChange={e => setAdmin({ ...admin, email: e.target.value })} placeholder="admin@facility.com" required /></div>
            <div><label style={lbl}>Password *</label><input style={inp} type="password" value={admin.password} onChange={e => setAdmin({ ...admin, password: e.target.value })} placeholder="At least 8 characters" required /></div>
            <div><label style={lbl}>Confirm Password *</label><input style={inp} type="password" value={admin.confirm} onChange={e => setAdmin({ ...admin, confirm: e.target.value })} placeholder="Repeat password" required /></div>
            {error && <p style={{ color: '#f87171', fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', padding: '0.6rem 0.9rem', borderRadius: 6 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ background: loading ? '#2a4a8a' : '#4472c4', border: 'none', color: 'white', padding: '0.8rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {loading ? 'Creating account...' : <><RiCheckLine size={18} /> Create Workspace</>}
            </button>
            <button type="button" onClick={() => { setStep(1); setError(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
              <RiArrowLeftLine size={14} /> Back to facility details
            </button>
          </form>
        )}

        {step !== 'confirm' && (
          <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
            Already have a workspace? <a href="/login" style={{ color: '#7fa3e0', textDecoration: 'none', fontWeight: 600 }}>Sign in</a>
          </p>
        )}
      </div>
    </div>
  );
}
