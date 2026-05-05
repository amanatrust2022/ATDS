'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiArrowLeftLine, RiCheckLine } from '@remixicon/react';

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Step = 1 | 2;

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [org, setOrg] = useState({ name: '', slug: '', address: '', phone: '', email: '' });
  const [admin, setAdmin] = useState({ fullName: '', email: '', password: '', confirm: '' });

  const handleOrgNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!org.name || !org.slug) { setError('Organisation name and workspace ID are required.'); return; }
    if (!/^[a-z0-9-]+$/.test(org.slug)) { setError('Workspace ID can only contain lowercase letters, numbers, and hyphens.'); return; }
    setError('');
    setStep(2);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (admin.password !== admin.confirm) { setError('Passwords do not match.'); return; }
    if (admin.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true); setError('');

    try {
      // Use SECURITY DEFINER RPC — works for unauthenticated (anon) callers
      const { data: orgData, error: orgErr } = await supabase.rpc('create_organization_for_signup', {
        p_name:    org.name,
        p_slug:    org.slug,
        p_address: org.address || null,
        p_phone:   org.phone   || null,
        p_email:   org.email   || admin.email,
      });

      if (orgErr) {
        const msg = orgErr.message.includes('SLUG_TAKEN')
          ? 'That workspace ID is already taken. Please choose another.'
          : orgErr.message;
        throw new Error(msg);
      }

      // Create auth user — trigger attaches profile with role=admin + org_id
      const { error: authErr } = await supabase.auth.signUp({
        email: admin.email,
        password: admin.password,
        options: {
          data: {
            full_name:       admin.fullName,
            role:            'admin',
            organization_id: orgData.id,
          },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        }
      });

      if (authErr) throw authErr;
      router.push('/onboarding?new=1');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = { width: '100%', padding: '0.7rem 0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: '0.9rem', outline: 'none' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'var(--font-body)' }}>
      <style>{`input::placeholder { color: rgba(255,255,255,0.2); } input:focus { border-color: #4472c4 !important; box-shadow: 0 0 0 3px rgba(68,114,196,0.15); }`}</style>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: '#4472c4', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <RiMicroscopeLine size={24} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700 }}>Create your workspace</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            Start your free trial — no credit card required
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          {(['Facility details', 'Admin account'] as const).map((label, i) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ height: 3, borderRadius: 2, background: i < step ? '#4472c4' : 'rgba(255,255,255,0.1)' }} />
              <span style={{ fontSize: '0.68rem', color: i + 1 === step ? '#7fa3e0' : 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <form onSubmit={handleOrgNext} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label style={lbl}>Facility / Organisation Name *</label>
              <input style={inp} value={org.name} onChange={e => { setOrg({ ...org, name: e.target.value, slug: slugify(e.target.value) }); }} placeholder="e.g. Amana Trust Diagnostics" required />
            </div>
            <div>
              <label style={lbl}>Workspace ID *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>app.com/</span>
                <input style={{ ...inp, paddingLeft: '5.5rem' }} value={org.slug} onChange={e => setOrg({ ...org, slug: slugify(e.target.value) })} placeholder="amana-trust" required />
              </div>
              <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.3rem' }}>Lowercase letters, numbers, hyphens only. Cannot be changed later.</p>
            </div>
            <div><label style={lbl}>Address</label><input style={inp} value={org.address} onChange={e => setOrg({ ...org, address: e.target.value })} placeholder="No. 15 C Tudun Wada Bus Stop" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div><label style={lbl}>Phone</label><input style={inp} value={org.phone} onChange={e => setOrg({ ...org, phone: e.target.value })} placeholder="+234..." /></div>
              <div><label style={lbl}>Facility Email</label><input style={inp} type="email" value={org.email} onChange={e => setOrg({ ...org, email: e.target.value })} placeholder="info@facility.com" /></div>
            </div>
            {error && <p style={{ color: '#f87171', fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', padding: '0.6rem 0.9rem', borderRadius: 6 }}>{error}</p>}
            <button type="submit" style={{ background: '#4472c4', border: 'none', color: 'white', padding: '0.8rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', marginTop: '0.5rem' }}>
              Continue to Admin Setup →
            </button>
          </form>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div><label style={lbl}>Your Full Name *</label><input style={inp} value={admin.fullName} onChange={e => setAdmin({ ...admin, fullName: e.target.value })} placeholder="e.g. Dr. Aisha Ibrahim" required /></div>
            <div><label style={lbl}>Email Address *</label><input style={inp} type="email" value={admin.email} onChange={e => setAdmin({ ...admin, email: e.target.value })} placeholder="admin@facility.com" required /></div>
            <div><label style={lbl}>Password *</label><input style={inp} type="password" value={admin.password} onChange={e => setAdmin({ ...admin, password: e.target.value })} placeholder="At least 8 characters" required /></div>
            <div><label style={lbl}>Confirm Password *</label><input style={inp} type="password" value={admin.confirm} onChange={e => setAdmin({ ...admin, confirm: e.target.value })} placeholder="Repeat password" required /></div>
            {error && <p style={{ color: '#f87171', fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', padding: '0.6rem 0.9rem', borderRadius: 6 }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ background: loading ? '#2a4a8a' : '#4472c4', border: 'none', color: 'white', padding: '0.8rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {loading ? 'Creating workspace...' : <><RiCheckLine size={18} /> Create Workspace</>}
            </button>
            <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
              <RiArrowLeftLine size={14} /> Back to facility details
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
          Already have a workspace? <a href="/login" style={{ color: '#7fa3e0', textDecoration: 'none', fontWeight: 600 }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
