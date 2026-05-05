'use client';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiTestTubeLine, RiRadarLine, RiHospitalLine, RiShieldCheckLine, RiCloudLine, RiPrinterLine, RiTeamLine } from '@remixicon/react';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', color: 'white', fontFamily: 'var(--font-body)' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .hero-animate { animation: fadeUp 0.7s ease forwards; }
        .hero-animate-delay { animation: fadeUp 0.7s 0.2s ease both; }
        .feature-card:hover { transform: translateY(-4px); border-color: #4472c4 !important; }
        .feature-card { transition: all 0.25s ease; }
        .cta-btn:hover { background: #3461b3 !important; transform: translateY(-1px); }
        .cta-btn { transition: all 0.2s ease; }
        .outline-btn:hover { background: rgba(255,255,255,0.08) !important; }
        .outline-btn { transition: all 0.2s ease; }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,15,30,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ background: '#4472c4', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RiMicroscopeLine size={18} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>DiagnosticOS</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => router.push('/login')} className="outline-btn" style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '0.5rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>Sign In</button>
          <button onClick={() => router.push('/signup')} className="cta-btn" style={{ background: '#4472c4', border: 'none', color: 'white', padding: '0.5rem 1.25rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Start Free Trial</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: '7rem 2rem 5rem', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div className="hero-animate" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(68,114,196,0.12)', border: '1px solid rgba(68,114,196,0.3)', borderRadius: 100, padding: '0.35rem 1rem', fontSize: '0.78rem', color: '#7fa3e0', marginBottom: '2rem', fontWeight: 600 }}>
          <RiShieldCheckLine size={14} /> Cloud-based LIS for diagnostic centres
        </div>
        <h1 className="hero-animate" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: '1.5rem', background: 'linear-gradient(135deg, #fff 0%, #a0b8e0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          The complete diagnostic<br />management platform
        </h1>
        <p className="hero-animate-delay" style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.5)', maxWidth: 600, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Reception, Lab, Radiology, and Results — all connected in real time. Built for diagnostic centres that want to move fast without the paperwork.
        </p>
        <div className="hero-animate-delay" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/signup')} className="cta-btn" style={{ background: '#4472c4', border: 'none', color: 'white', padding: '0.85rem 2rem', borderRadius: 10, cursor: 'pointer', fontSize: '0.95rem', fontWeight: 700 }}>
            Start Free Trial — No credit card
          </button>
          <button onClick={() => router.push('/login')} className="outline-btn" style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.85rem 1.75rem', borderRadius: 10, cursor: 'pointer', fontSize: '0.95rem', fontWeight: 500 }}>
            Sign in to workspace
          </button>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '4rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: '#4472c4', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>Everything you need</p>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, marginBottom: '3rem', color: 'rgba(255,255,255,0.9)' }}>One platform for your entire facility</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {[
            { icon: <RiHospitalLine size={22} />, title: 'Smart Reception', desc: 'Register patients in seconds. Auto-generate numbered slips, multi-test selection, and live preview before printing.' },
            { icon: <RiTestTubeLine size={22} />, title: 'Laboratory Module', desc: 'Queue management, structured result entry, reference ranges, and automatic flagging of abnormal values.' },
            { icon: <RiRadarLine size={22} />, title: 'Radiology Module', desc: 'Imaging request tracking with department-specific workflows and report entry forms.' },
            { icon: <RiPrinterLine size={22} />, title: 'Thermal Print Ready', desc: '80mm thermal printer optimized slips and formatted result reports — no extra configuration needed.' },
            { icon: <RiCloudLine size={22} />, title: 'Real-time Sync', desc: 'Every update is instantly visible across all departments. No refreshing, no missed results.' },
            { icon: <RiTeamLine size={22} />, title: 'Role-Based Access', desc: 'Reception, Lab, Radiology, and Admin each see only what they need. Invite staff with one click.' },
          ].map(f => (
            <div key={f.title} className="feature-card" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.5rem' }}>
              <div style={{ color: '#4472c4', marginBottom: '0.75rem' }}>{f.icon}</div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>{f.title}</h3>
              <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{ padding: '4rem 2rem', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(68,114,196,0.15) 0%, rgba(68,114,196,0.05) 100%)', border: '1px solid rgba(68,114,196,0.25)', borderRadius: 20, padding: '3rem 2rem' }}>
          <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', fontWeight: 700, marginBottom: '1rem' }}>Ready to go paperless?</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '2rem', fontSize: '0.9rem' }}>Set up your facility workspace in under 5 minutes. Free trial, no credit card required.</p>
          <button onClick={() => router.push('/signup')} className="cta-btn" style={{ background: '#4472c4', border: 'none', color: 'white', padding: '0.9rem 2.5rem', borderRadius: 10, cursor: 'pointer', fontSize: '1rem', fontWeight: 700 }}>
            Create your workspace →
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '0.78rem' }}>
        DiagnosticOS · Built for African diagnostic centres · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
