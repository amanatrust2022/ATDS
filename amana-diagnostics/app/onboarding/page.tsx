'use client';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { RiCheckLine, RiTeamLine, RiRocketLine, RiMicroscopeLine } from '@remixicon/react';

const steps = [
  { icon: <RiMicroscopeLine size={22} />, title: 'Workspace created', desc: 'Your facility is registered on DiagnosticOS.' },
  { icon: <RiTeamLine size={22} />, title: 'Invite your staff', desc: 'Add your Lab Scientists, Radiologists, and Receptionists from the Admin panel.' },
  { icon: <RiRocketLine size={22} />, title: 'Go live', desc: 'Start registering patients and managing test results in real time.' },
];

export default function OnboardingPage() {
  const { organization, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !organization) router.push('/signup');
  }, [loading, organization]);

  if (loading || !organization) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'var(--font-body)' }}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(68,114,196,0.15)', border: '2px solid #4472c4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
          <RiCheckLine size={30} color="#4472c4" />
        </div>
        <h1 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Welcome, {profile?.full_name?.split(' ')[0]}! 🎉
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem', marginBottom: '2.5rem' }}>
          <strong style={{ color: '#7fa3e0' }}>{organization.name}</strong> workspace is ready. Here's what to do next:
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
          Your workspace URL: <strong>app/{organization.slug}/reception</strong>
        </div>

        <button
          onClick={() => router.push(`/${organization.slug}/admin/staff`)}
          style={{ background: '#4472c4', border: 'none', color: 'white', padding: '0.9rem 2rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', width: '100%', marginBottom: '0.75rem' }}
        >
          Invite staff & configure workspace →
        </button>
        <button
          onClick={() => router.push(`/${organization.slug}/reception`)}
          style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', padding: '0.75rem 2rem', borderRadius: 8, fontWeight: 500, fontSize: '0.88rem', cursor: 'pointer', width: '100%' }}
        >
          Skip and go to reception
        </button>
      </div>
    </div>
  );
}
