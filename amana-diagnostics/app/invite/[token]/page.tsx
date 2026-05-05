'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { RiMicroscopeLine, RiCheckLine, RiShieldCheckLine } from '@remixicon/react';

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();
  const supabase = createClient();

  const [invite, setInvite] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [form, setForm] = useState({ fullName: '', password: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchInvite = async () => {
      const { data, error } = await supabase
        .from('invitations')
        .select('*, organizations(*)')
        .eq('token', token)
        .single();

      if (error || !data || data.accepted_at) {
        setInvalid(true);
      } else {
        setInvite(data);
        setOrg(data.organizations);
      }
      setLoading(false);
    };
    if (token) fetchInvite();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSubmitting(true); setError('');

    try {
      // Create auth user with org + role from invite in metadata
      const { error: signUpErr } = await supabase.auth.signUp({
        email: invite.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            role: invite.role,
            organization_id: invite.organization_id,
          }
        }
      });

      if (signUpErr) throw signUpErr;

      // Mark invite as accepted
      await supabase.from('invitations').update({ accepted_at: new Date().toISOString() }).eq('token', token);

      // Redirect to login
      router.push(`/login?message=Account created! Please sign in.`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '0.7rem 0.9rem',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: 'white', fontSize: '0.9rem', outline: 'none'
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600,
    color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem',
    textTransform: 'uppercase', letterSpacing: '0.05em'
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-body)' }}>
      Verifying invite link...
    </div>
  );

  if (invalid) return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', padding: '2rem' }}>
      <div style={{ textAlign: 'center', color: 'white', maxWidth: 400 }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
        <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Invalid or expired link</h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          This invite link has already been used or has expired. Please contact your administrator for a new invite.
        </p>
        <a href="/login" style={{ color: '#7fa3e0', textDecoration: 'none', fontWeight: 600 }}>← Back to sign in</a>
      </div>
    </div>
  );

  const roleLabels: Record<string, string> = {
    reception: 'Receptionist', lab: 'Lab Scientist', radiology: 'Radiologist', admin: 'Administrator'
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'var(--font-body)' }}>
      <style>{`input::placeholder { color: rgba(255,255,255,0.2); } input:focus { border-color: #4472c4 !important; }`}</style>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ background: '#4472c4', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <RiMicroscopeLine size={24} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700 }}>You've been invited!</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            Join <strong style={{ color: '#7fa3e0' }}>{org?.name}</strong> as {roleLabels[invite.role] || invite.role}
          </p>
        </div>

        <div style={{ background: 'rgba(68,114,196,0.08)', border: '1px solid rgba(68,114,196,0.2)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#7fa3e0' }}>
          <RiShieldCheckLine size={16} />
          Signing in as: <strong>{invite.email}</strong>
        </div>

        <form onSubmit={handleAccept} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label style={lbl}>Your Full Name *</label><input style={inp} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. MLS Abdullahi Shehu" required /></div>
          <div><label style={lbl}>Create Password *</label><input type="password" style={inp} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" required /></div>
          <div><label style={lbl}>Confirm Password *</label><input type="password" style={inp} value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} placeholder="Repeat password" required /></div>
          {error && <p style={{ color: '#f87171', fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', padding: '0.6rem 0.9rem', borderRadius: 6 }}>{error}</p>}
          <button type="submit" disabled={submitting} style={{ background: submitting ? '#2a4a8a' : '#4472c4', border: 'none', color: 'white', padding: '0.85rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            {submitting ? 'Creating account...' : <><RiCheckLine size={18} /> Accept Invite & Create Account</>}
          </button>
        </form>
      </div>
    </div>
  );
}
