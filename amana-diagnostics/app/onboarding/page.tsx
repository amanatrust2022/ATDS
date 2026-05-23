'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { RiCheckLine, RiTeamLine, RiRocketLine, RiMicroscopeLine, RiLoader4Line } from '@remixicon/react';

// What the onboarding page is currently doing
type Status = 'loading' | 'creating' | 'no_data' | 'ready';

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function OnboardingPage() {
  const { organization, profile, loading, refreshOrg } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');

  // Fallback manual form (when no localStorage data found)
  const [org, setOrg] = useState({ name: '', slug: '', address: '', phone: '', email: '', letterheadLine2: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    
    // If we have no profile AND no user, they are truly logged out.
    // (RootWrapper actually handles this, but just in case)
    if (!profile) {
       setStatus('no_data'); 
       setError('We could not load your user profile. Please contact support or try logging out and back in.');
       return; 
    }
    
    if (organization) { setStatus('ready'); return; }

    // Authenticated but no org — try localStorage first
    const stored = localStorage.getItem('pending_org');
    if (stored) {
      createOrgFromData(JSON.parse(stored));
    } else {
      // No stored data — show manual entry form
      setStatus('no_data');
    }
  }, [loading, profile, organization]);

  const createOrgFromData = async (data: any) => {
    setStatus('creating');
    setError('');
    try {
      let orgId: string;

      const { data: newOrg, error: orgErr } = await supabase.rpc('create_organization_for_signup', {
        p_name:    data.name,
        p_slug:    data.slug,
        p_address: data.address || null,
        p_phone:   data.phone   || null,
        p_email:   data.email   || null,
        p_letterhead_line2: data.letterheadLine2 || null,
      });

      if (orgErr) {
        if (orgErr.message.includes('SLUG_TAKEN')) {
          // Already created — find it and link
          const { data: existing } = await supabase
            .from('organizations').select('id').eq('slug', data.slug).single();
          if (!existing) throw new Error('Workspace ID conflict. Please use a different ID.');
          orgId = existing.id;
        } else {
          throw orgErr;
        }
      } else {
        orgId = newOrg.id;
      }

      // Link profile to org
      const { error: updateErr } = await supabase
        .from('profiles').update({ organization_id: orgId }).eq('id', profile!.id);
      if (updateErr) throw updateErr;

      localStorage.removeItem('pending_org');
      await refreshOrg();
      // refreshOrg will update `organization` in context → useEffect fires again → status = 'ready'
    } catch (err: any) {
      setError(err.message);
      setStatus('no_data'); // Fall back to manual form
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org.name || !org.slug) return;
    setSubmitting(true);
    await createOrgFromData(org);
    setSubmitting(false);
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '0.7rem 0.9rem',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, color: 'white', fontSize: '0.88rem', outline: 'none',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '0.72rem', fontWeight: 600,
    color: 'rgba(255,255,255,0.45)', marginBottom: '0.35rem',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  const base = { minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'var(--font-body)' };

  // ── Loading / Creating ──
  if (status === 'loading' || status === 'creating') {
    return (
      <div style={{ ...base, flexDirection: 'column', gap: '1rem' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ animation: 'spin 1s linear infinite', color: '#4472c4' }}>
          <RiLoader4Line size={40} />
        </div>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.88rem' }}>
          {status === 'creating' ? 'Setting up your workspace...' : 'Loading your account...'}
        </p>
      </div>
    );
  }

  // ── No stored data — show manual facility entry form ──
  if (status === 'no_data') {
    return (
      <div style={base}>
        <style>{`input::placeholder { color: rgba(255,255,255,0.2); } input:focus { border-color: #4472c4 !important; }`}</style>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ background: '#4472c4', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
              <RiMicroscopeLine size={24} color="white" />
            </div>
            <h1 style={{ color: 'white', fontSize: '1.4rem', fontWeight: 700 }}>Set up your facility</h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
              Account confirmed! Now let's create your workspace.
            </p>
          </div>

          {error && <p style={{ color: '#f87171', fontSize: '0.82rem', background: 'rgba(248,113,113,0.1)', padding: '0.6rem 0.9rem', borderRadius: 6, marginBottom: '1rem' }}>{error}</p>}

          <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={lbl}>Facility / Organisation Name *</label>
              <input style={inp} value={org.name} onChange={e => setOrg({ ...org, name: e.target.value, slug: slugify(e.target.value) })} placeholder="e.g. Amana Trust Diagnostics" required />
            </div>
            <div>
              <label style={lbl}>Letterhead Second Line (Optional)</label>
              <input style={inp} value={org.letterheadLine2} onChange={e => setOrg({ ...org, letterheadLine2: e.target.value })} placeholder="e.g. AND CLINICAL SERVICES LIMITED" />
            </div>
            <div>
              <label style={lbl}>Workspace ID *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: '0.82rem' }}>app.com/</span>
                <input style={{ ...inp, paddingLeft: '5.2rem' }} value={org.slug} onChange={e => setOrg({ ...org, slug: slugify(e.target.value) })} placeholder="amana-trust" required />
              </div>
            </div>
            <div><label style={lbl}>Address</label><input style={inp} value={org.address} onChange={e => setOrg({ ...org, address: e.target.value })} placeholder="No. 15 C Tudun Wada Bus Stop" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div><label style={lbl}>Phone</label><input style={inp} value={org.phone} onChange={e => setOrg({ ...org, phone: e.target.value })} placeholder="+234..." /></div>
              <div><label style={lbl}>Email</label><input style={inp} type="email" value={org.email} onChange={e => setOrg({ ...org, email: e.target.value })} placeholder="info@facility.com" /></div>
            </div>
            <button type="submit" disabled={submitting} style={{ background: submitting ? '#2a4a8a' : '#4472c4', border: 'none', color: 'white', padding: '0.8rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: submitting ? 'not-allowed' : 'pointer', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {submitting ? 'Creating...' : <><RiCheckLine size={18} /> Create Workspace</>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Ready — workspace exists ──
  if (!organization) return null;

  const steps = [
    { icon: <RiMicroscopeLine size={22} />, title: 'Workspace created', desc: 'Your facility is registered on DiagnosticOS.' },
    { icon: <RiTeamLine size={22} />, title: 'Invite your staff', desc: 'Add Lab Scientists, Radiologists, and Receptionists from the Admin panel.' },
    { icon: <RiRocketLine size={22} />, title: 'Go live', desc: 'Start registering patients and managing test results in real time.' },
  ];

  return (
    <div style={base}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(68,114,196,0.15)', border: '2px solid #4472c4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <RiCheckLine size={30} color="#4472c4" />
        </div>
        <h1 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Welcome, {profile?.full_name?.split(' ')[0]}! 🎉
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', marginBottom: '2.5rem' }}>
          <strong style={{ color: '#7fa3e0' }}>{organization.name}</strong> is ready. Here's what to do next:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem', textAlign: 'left' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '1rem 1.25rem' }}>
              <div style={{ color: '#4472c4', flexShrink: 0, paddingTop: 2 }}>{s.icon}</div>
              <div>
                <p style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{s.title}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(68,114,196,0.08)', border: '1px solid rgba(68,114,196,0.2)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '2rem', fontSize: '0.8rem', color: '#7fa3e0' }}>
          Your workspace: <strong>/{organization.slug}/reception</strong>
        </div>

        <button onClick={() => router.push(`/${organization.slug}/admin/staff`)}
          style={{ background: '#4472c4', border: 'none', color: 'white', padding: '0.9rem 2rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', width: '100%', marginBottom: '0.75rem' }}>
          Invite staff & configure workspace →
        </button>
        <button onClick={() => router.push(`/${organization.slug}/reception`)}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', padding: '0.75rem 2rem', borderRadius: 8, fontWeight: 500, fontSize: '0.88rem', cursor: 'pointer', width: '100%' }}>
          Skip and go to reception
        </button>
      </div>
    </div>
  );
}
