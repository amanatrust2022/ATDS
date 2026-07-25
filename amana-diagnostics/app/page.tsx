'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useState, useEffect, useRef } from 'react';
import {
  RiMicroscopeLine, RiTestTubeLine, RiRadarLine, RiHospitalLine,
  RiShieldCheckLine, RiCloudLine, RiPrinterLine, RiTeamLine,
  RiDownloadLine, RiCheckLine, RiStarFill, RiWifiOffLine,
  RiArrowRightLine, RiLockPasswordLine,
} from '@remixicon/react';

export default function LandingPage() {
  const router = useRouter();
  const { user, profile, organization, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const statsRef = useRef<HTMLElement>(null);

  const isLocalMode = typeof window !== 'undefined'
    ? (localStorage.getItem('amana_local_mode') === null
        ? (
            ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined) ||
            (process.env.NODE_ENV !== 'development' && (
              window.location.hostname === 'localhost' || 
              window.location.hostname === '127.0.0.1' || 
              window.location.hostname.startsWith('192.168.') || 
              window.location.hostname.startsWith('10.') || 
              window.location.hostname.startsWith('172.')
            ))
          )
        : localStorage.getItem('amana_local_mode') === 'true')
    : (process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (isLocalMode && !loading) {
      if (user) {
        router.replace(getDashboardUrl());
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, isLocalMode]);

  if (isLocalMode) {
    return (
      <div style={{ minHeight: '100vh', background: '#07090f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#7fa3e0', fontSize: '1.2rem', fontFamily: 'sans-serif' }}>
          Redirecting to clinic portal...
        </div>
      </div>
    );
  }

  const getDashboardUrl = () => {
    if (!organization) return '/onboarding';
    switch (profile?.role) {
      case 'lab': 
      case 'lab_tech': return `/${organization.slug}/lab`;
      case 'radiology': return `/${organization.slug}/radiology`;
      case 'admin': return `/${organization.slug}/admin`;
      default: return `/${organization.slug}/reception`;
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07090f', color: 'white', fontFamily: '"IBM Plex Sans", -apple-system, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: .35; transform: scale(1); }
          50%       { opacity: .65; transform: scale(1.06); }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-14px); }
        }
        @keyframes pingRing {
          0%   { transform: scale(1); opacity: .7; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes lineSlide {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes borderGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(68,114,196,.15); }
          50%       { box-shadow: 0 0 40px rgba(68,114,196,.35); }
        }

        .hero-s1  { animation: fadeUp .85s .00s ease both; }
        .hero-s2  { animation: fadeUp .85s .12s ease both; }
        .hero-s3  { animation: fadeUp .85s .25s ease both; }
        .hero-s4  { animation: fadeUp .85s .38s ease both; }

        .float { animation: floatY 7s ease-in-out infinite; }
        .orb   { animation: glowPulse 5s ease-in-out infinite; }

        /* NAV LINKS */
        .nl { color: rgba(255,255,255,.5); text-decoration: none; font-size:.875rem; font-weight:500; transition:color .2s; }
        .nl:hover { color: rgba(255,255,255,.9); }

        /* BUTTONS */
        .btn-p {
          background: linear-gradient(135deg,#4472c4 0%,#5e8cd4 100%);
          border: none; color: #fff; cursor: pointer;
          font-family: inherit; font-weight: 700; border-radius: 10px;
          box-shadow: 0 4px 22px rgba(68,114,196,.4);
          transition: all .22s ease;
        }
        .btn-p:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(68,114,196,.55); filter: brightness(1.1); }
        .btn-p:active { transform: translateY(0); }

        .btn-g {
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.13);
          color: rgba(255,255,255,.75); cursor: pointer;
          font-family: inherit; font-weight: 500; border-radius: 10px;
          transition: all .22s ease;
        }
        .btn-g:hover { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.25); color: #fff; }

        .btn-d {
          background: linear-gradient(135deg,rgba(20,45,100,.95) 0%,rgba(68,114,196,.8) 100%);
          border: 1px solid rgba(68,114,196,.45);
          color: #fff; cursor: pointer;
          font-family: inherit; font-weight: 700; border-radius: 10px;
          box-shadow: 0 4px 24px rgba(68,114,196,.2);
          transition: all .22s ease;
        }
        .btn-d:hover { transform: translateY(-2px); box-shadow: 0 8px 36px rgba(68,114,196,.45); }

        /* CARDS */
        .f-card {
          background: rgba(255,255,255,.025);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 16px; padding: 1.75rem;
          transition: all .3s ease;
        }
        .f-card:hover {
          background: rgba(68,114,196,.06);
          border-color: rgba(68,114,196,.3);
          transform: translateY(-5px);
          box-shadow: 0 12px 40px rgba(68,114,196,.12);
        }

        .t-card {
          background: rgba(255,255,255,.025);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 16px; padding: 1.75rem;
          transition: border-color .3s;
        }
        .t-card:hover { border-color: rgba(68,114,196,.3); }

        .stat-c {
          background: rgba(255,255,255,.025);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 14px; padding: 1.5rem 1.25rem;
          text-align: center; transition: all .3s;
        }
        .stat-c:hover { border-color: rgba(68,114,196,.4); background: rgba(68,114,196,.05); }

        /* GRADIENT TEXT */
        .gt {
          background: linear-gradient(135deg,#fff 0%,#a8c4ee 60%,#7fa3e0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .gt-blue {
          background: linear-gradient(135deg,#7fa3e0 0%,#4472c4 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* SECTION BADGE */
        .sbadge {
          display: inline-flex; align-items: center; gap: .45rem;
          background: rgba(68,114,196,.1); border: 1px solid rgba(68,114,196,.25);
          border-radius: 100px; padding: .3rem .95rem;
          font-size: .72rem; font-weight: 700; color: #7fa3e0;
          text-transform: uppercase; letter-spacing: .09em;
          margin-bottom: 1.25rem;
        }

        /* CHECK ROW */
        .chk { display: flex; align-items: flex-start; gap: .65rem; margin-bottom: .75rem; }
        .chk-ico {
          width: 18px; height: 18px; flex-shrink: 0;
          border-radius: 50%; background: rgba(68,114,196,.15);
          display: flex; align-items: center; justify-content: center; margin-top: 1px;
        }

        /* HUB FEATURE ROW */
        .hub-row { display: flex; align-items: flex-start; gap: .9rem; margin-bottom: 1.2rem; }
        .hub-ico {
          width: 34px; height: 34px; flex-shrink: 0;
          border-radius: 8px; background: rgba(68,114,196,.12);
          border: 1px solid rgba(68,114,196,.22);
          display: flex; align-items: center; justify-content: center;
        }

        /* HUB DIAGRAM */
        .hub-device {
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 8px; padding: .4rem .75rem;
          font-size: .7rem; color: rgba(255,255,255,.55);
          white-space: nowrap;
        }

        /* PING DOT */
        .ping-wrap { position: relative; display: inline-flex; }
        .ping-wrap::before {
          content: ''; position: absolute; inset: 0; border-radius: 50%;
          background: #22c55e; animation: pingRing 2s ease-out infinite;
        }

        /* PRICING CARDS */
        .pc-std {
          border-radius: 20px; padding: 2rem;
          background: rgba(255,255,255,.025);
          border: 1px solid rgba(255,255,255,.08);
          transition: transform .3s;
        }
        .pc-std:hover { transform: translateY(-5px); }
        .pc-pro {
          border-radius: 20px; padding: 2rem;
          background: linear-gradient(145deg,rgba(15,30,75,.95) 0%,rgba(30,55,120,.6) 100%);
          border: 1px solid rgba(68,114,196,.45);
          transition: transform .3s;
          animation: borderGlow 4s ease-in-out infinite;
        }
        .pc-pro:hover { transform: translateY(-5px); }

        /* MOBILE */
        @media (max-width:768px) {
          .mhide { display:none !important; }
          .mstack { flex-direction:column !important; }
          .mfull { width:100% !important; }
          .mcenter { text-align:center !important; justify-content:center !important; align-items:center !important; }
        }
      `}</style>

      {/* ─── FIXED NAV ─────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(7,9,15,.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,.06)' : '1px solid transparent',
        padding: '0 2rem', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'all .3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer' }} onClick={() => router.push('/')}>
            <div style={{ background: 'linear-gradient(135deg,#4472c4,#6b97e4)', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(68,114,196,.45)' }}>
              <RiMicroscopeLine size={18} color="white" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-.03em' }}>DiagnosticOS</span>
          </div>
          <div className="mhide" style={{ display: 'flex', gap: '1.5rem' }}>
            <a href="#features" className="nl">Features</a>
            <a href="#local-hub" className="nl">Local Hub</a>
            <a href="#how-it-works" className="nl">How it Works</a>
            <a href="#pricing" className="nl">Pricing</a>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.7rem', alignItems: 'center' }}>
          {!loading && user ? (
            <button onClick={() => router.push(getDashboardUrl())} className="btn-p" style={{ padding: '.5rem 1.25rem', fontSize: '.85rem' }}>
              Go to Workspace →
            </button>
          ) : (
            <>
              <button onClick={() => router.push('/portal/login')} className="btn-g mhide" style={{ padding: '.5rem 1.2rem', fontSize: '.85rem', borderColor: 'rgba(100,180,130,0.4)', color: '#a9dfbf' }}>Patient Portal</button>
              <button onClick={() => router.push('/login')} className="btn-g mhide" style={{ padding: '.5rem 1.2rem', fontSize: '.85rem' }}>Sign In</button>
              <button onClick={() => router.push('/signup')} className="btn-p" style={{ padding: '.5rem 1.2rem', fontSize: '.85rem' }}>Start Free Trial</button>
            </>
          )}
        </div>
      </nav>

      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section style={{ position: 'relative', padding: '10rem 2rem 5rem', maxWidth: 1100, margin: '0 auto', textAlign: 'center', overflow: 'hidden' }}>
        {/* Background radial orbs */}
        <div className="orb" style={{ position: 'absolute', top: '-5%', left: '5%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle,rgba(68,114,196,.13) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
        <div className="orb" style={{ position: 'absolute', top: '0%', right: '0%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle,rgba(120,170,255,.07) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'relative', zIndex: 1 }}>

          {/* Badge */}
          <div className="hero-s1" style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '.6rem', background: 'rgba(68,114,196,.1)', border: '1px solid rgba(68,114,196,.28)', borderRadius: 100, padding: '.32rem .9rem .32rem .6rem', fontSize: '.75rem', color: '#7fa3e0', fontWeight: 600 }}>
              <span className="ping-wrap" style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
              Offline-First Local Hub · Works without internet · Auto-updates silently
            </div>
          </div>

          {/* H1 */}
          <h1 className="hero-s2 gt" style={{ fontSize: 'clamp(2.8rem,6.5vw,5rem)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-.045em', marginBottom: '1.5rem' }}>
            Run your diagnostic centre.<br />Even without internet.
          </h1>

          {/* Subheadline */}
          <p className="hero-s3" style={{ fontSize: 'clamp(1rem,1.8vw,1.2rem)', color: 'rgba(255,255,255,.45)', maxWidth: 640, margin: '0 auto 2.5rem', lineHeight: 1.8 }}>
            DiagnosticOS connects Reception, Lab, and Radiology in real time — on cloud or completely offline. Built for African diagnostics where reliable internet is a privilege, not a guarantee.
          </p>

          {/* CTAs */}
          <div className="hero-s4" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {!loading && user ? (
              <button onClick={() => router.push(getDashboardUrl())} className="btn-p" style={{ padding: '.9rem 2.25rem', fontSize: '1rem' }}>
                Open Workspace →
              </button>
            ) : (
              <>
                <button id="hero-signup" onClick={() => router.push('/signup')} className="btn-p" style={{ padding: '.9rem 2.25rem', fontSize: '1rem' }}>
                  Start Free Trial — No credit card
                </button>
                <button id="hero-download" onClick={() => router.push('/download')} className="btn-g" style={{ padding: '.9rem 1.75rem', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}>
                  <RiDownloadLine size={18} /> Download Local Hub
                </button>
              </>
            )}
          </div>

          {/* Hero visual: Dashboard preview mock */}
          <div className="float mhide" style={{ marginTop: '4rem', maxWidth: 800, margin: '4rem auto 0', position: 'relative' }}>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04)' }}>
              {/* Browser chrome bar */}
              <div style={{ background: 'rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '.75rem 1rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
                <div style={{ flex: 1, background: 'rgba(255,255,255,.05)', borderRadius: 6, height: 22, marginLeft: '.5rem', display: 'flex', alignItems: 'center', paddingLeft: '0.75rem' }}>
                  <span style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.3)' }}>localhost:3000/kano-diagnostics/reception</span>
                </div>
              </div>
              {/* Dashboard simulation */}
              <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.25rem', minHeight: 260 }}>
                {/* Sidebar */}
                <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '1rem' }}>
                  {['Reception', 'Lab Queue', 'Radiology', 'Reports', 'Admin'].map((item, i) => (
                    <div key={item} style={{ padding: '.5rem .75rem', borderRadius: 6, marginBottom: '.3rem', background: i === 0 ? 'rgba(68,114,196,.2)' : 'transparent', color: i === 0 ? '#7fa3e0' : 'rgba(255,255,255,.3)', fontSize: '.75rem', fontWeight: i === 0 ? 600 : 400 }}>
                      {item}
                    </div>
                  ))}
                </div>
                {/* Main content */}
                <div>
                  <div style={{ display: 'flex', gap: '.75rem', marginBottom: '1rem' }}>
                    {[{ label: 'Patients Today', val: '47', color: '#4472c4' }, { label: 'Lab Pending', val: '12', color: '#f59e0b' }, { label: 'Results Ready', val: '31', color: '#22c55e' }].map(s => (
                      <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,.03)', border: `1px solid ${s.color}22`, borderRadius: 8, padding: '.75rem' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color }}>{s.val}</div>
                        <div style={{ fontSize: '.65rem', color: 'rgba(255,255,255,.35)', marginTop: '.15rem' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Patient rows */}
                  {['Ibrahim Al-Hassan · Blood Panel · Lab', 'Aisha Musa · Chest X-Ray · Radiology', 'Emeka Obi · Malaria RDT · Lab'].map((row, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.55rem .75rem', background: 'rgba(255,255,255,.025)', borderRadius: 7, marginBottom: '.35rem' }}>
                      <span style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.55)' }}>{row}</span>
                      <span style={{ fontSize: '.6rem', padding: '.2rem .55rem', borderRadius: 100, background: i === 2 ? 'rgba(34,197,94,.15)' : 'rgba(245,158,11,.12)', color: i === 2 ? '#4ade80' : '#fbbf24', fontWeight: 600 }}>{i === 2 ? 'Ready' : 'Pending'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Glow under the preview */}
            <div style={{ position: 'absolute', bottom: -40, left: '20%', right: '20%', height: 60, background: 'radial-gradient(ellipse,rgba(68,114,196,.3) 0%,transparent 70%)', filter: 'blur(20px)', pointerEvents: 'none' }} />
          </div>
        </div>
      </section>

      {/* ─── STATS ────────────────────────────────────────────── */}
      <section ref={statsRef} style={{ padding: '3rem 2rem 5rem', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '1rem' }}>
          {[
            { num: '100+', label: 'Diagnostic centres', sub: 'across Africa' },
            { num: '< 5 min', label: 'Setup time', sub: 'from signup to live' },
            { num: '99.9%', label: 'Cloud uptime', sub: 'Supabase-backed' },
            { num: 'Free', label: 'Local Hub', sub: 'forever, no lock-in' },
          ].map(s => (
            <div key={s.num} className="stat-c">
              <div style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-.04em', color: '#fff' }}>{s.num}</div>
              <div style={{ fontSize: '.83rem', color: 'rgba(255,255,255,.65)', fontWeight: 600, marginTop: '.25rem' }}>{s.label}</div>
              <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.28)', marginTop: '.1rem' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────────────── */}
      <section id="features" style={{ padding: '5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div className="sbadge"><RiShieldCheckLine size={13} /> One complete platform</div>
          <h2 style={{ fontSize: 'clamp(1.8rem,3.5vw,2.6rem)', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1.15 }}>
            Every department. <span className="gt-blue">One system.</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,.38)', marginTop: '1rem', fontSize: '.95rem', maxWidth: 520, margin: '1rem auto 0', lineHeight: 1.8 }}>
            No more scattered spreadsheets or paper forms. DiagnosticOS unifies your entire facility in a single, beautiful workspace.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '1.15rem' }}>
          {[
            { icon: <RiHospitalLine size={22} />, title: 'Smart Reception', badge: null, desc: 'Register patients in seconds. Auto-generate numbered slips, multi-test selection, and live preview before printing. Handles walk-ins and referrals seamlessly.' },
            { icon: <RiTestTubeLine size={22} />, title: 'Laboratory Module', badge: null, desc: 'Queue management, structured result entry, customisable reference ranges, and automatic flagging of critical and abnormal values.' },
            { icon: <RiRadarLine size={22} />, title: 'Radiology Module', badge: null, desc: 'Imaging request tracking with department-specific workflows, report entry forms, and instant result availability to referring departments.' },
            { icon: <RiPrinterLine size={22} />, title: 'Thermal Print Ready', badge: 'Built in', desc: '80mm thermal printer optimised slips and formatted result reports with letterhead. No extra configuration or special drivers needed.' },
            { icon: <RiCloudLine size={22} />, title: 'Real-time Sync', badge: null, desc: 'Every update — patient registered, result entered, report completed — is instantly visible across all departments. No page refreshing.' },
            { icon: <RiTeamLine size={22} />, title: 'Role-Based Access', badge: null, desc: 'Reception, Lab, Radiology, and Admin each see only what matters to them. Invite your entire staff with one click and set permissions instantly.' },
          ].map(f => (
            <div key={f.title} className="f-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(68,114,196,.1)', border: '1px solid rgba(68,114,196,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7fa3e0' }}>
                  {f.icon}
                </div>
                {f.badge && (
                  <span style={{ background: 'rgba(34,197,94,.12)', border: '1px solid rgba(34,197,94,.25)', color: '#4ade80', fontSize: '.63rem', fontWeight: 700, padding: '.2rem .6rem', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '.06em' }}>{f.badge}</span>
                )}
              </div>
              <h3 style={{ fontSize: '.97rem', fontWeight: 700, marginBottom: '.45rem', color: 'rgba(255,255,255,.88)' }}>{f.title}</h3>
              <p style={{ fontSize: '.83rem', color: 'rgba(255,255,255,.38)', lineHeight: 1.75 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── LOCAL HUB ────────────────────────────────────────── */}
      <section id="local-hub" style={{ padding: '4rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(7,18,48,.95) 0%,rgba(20,42,95,.55) 100%)', border: '1px solid rgba(68,114,196,.22)', borderRadius: 24, padding: 'clamp(2rem,5vw,4rem)', position: 'relative', overflow: 'hidden' }}>
          {/* bg orb */}
          <div style={{ position: 'absolute', right: -120, top: -120, width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle,rgba(68,114,196,.14) 0%,transparent 70%)', pointerEvents: 'none' }} />

          <div className="mstack" style={{ display: 'flex', gap: '4rem', alignItems: 'center', position: 'relative', zIndex: 1 }}>
            {/* Left: text */}
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="sbadge"><RiWifiOffLine size={13} /> Offline-First Local Hub</div>
              <h2 style={{ fontSize: 'clamp(1.7rem,3vw,2.3rem)', fontWeight: 800, letterSpacing: '-.04em', lineHeight: 1.15, marginBottom: '1.1rem' }}>
                Works when your internet doesn't.
              </h2>
              <p style={{ color: 'rgba(255,255,255,.42)', lineHeight: 1.8, fontSize: '.93rem', marginBottom: '2rem' }}>
                Install the Local Hub on one Windows PC in your clinic. Every device — phone, tablet, or laptop — connects over the clinic Wi-Fi with <em>zero internet required</em>. When connectivity returns, everything syncs to the cloud automatically.
              </p>

              {[
                { title: 'Zero-config LAN collaboration', desc: 'All staff connect via the same Wi-Fi router — no cables, no IT.' },
                { title: 'Auto-discovery (mDNS/Bonjour)', desc: 'Devices find the hub automatically. No IP address typing, ever.' },
                { title: 'One-click Windows installer', desc: 'A simple .exe. Ready in under 2 minutes on any Windows 10/11 PC.' },
                { title: 'Silent overnight auto-updates', desc: 'The app improves itself whenever internet is available. No manual steps.' },
              ].map(item => (
                <div key={item.title} className="hub-row">
                  <div className="hub-ico"><RiCheckLine size={16} color="#7fa3e0" /></div>
                  <div>
                    <div style={{ fontSize: '.88rem', fontWeight: 600, color: 'rgba(255,255,255,.82)', marginBottom: '.18rem' }}>{item.title}</div>
                    <div style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.35)' }}>{item.desc}</div>
                  </div>
                </div>
              ))}

              <button id="hub-download-btn" onClick={() => router.push('/download')} className="btn-d" style={{ marginTop: '2rem', padding: '.9rem 2rem', fontSize: '.93rem', display: 'inline-flex', alignItems: 'center', gap: '.6rem' }}>
                <RiDownloadLine size={18} /> Download Local Hub for Windows
              </button>
              <div style={{ marginTop: '.7rem', fontSize: '.73rem', color: 'rgba(255,255,255,.22)' }}>
                Windows 10/11 · Free forever · Installs in &lt; 2 minutes
              </div>
            </div>

            {/* Right: network diagram */}
            <div className="mhide float" style={{ flexShrink: 0, width: 250 }}>
              <div style={{ position: 'relative' }}>
                {/* Hub PC */}
                <div style={{ background: 'rgba(68,114,196,.18)', border: '2px solid rgba(68,114,196,.5)', borderRadius: 16, padding: '1.25rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '2.25rem', marginBottom: '.3rem' }}>🖥️</div>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#7fa3e0' }}>Local Hub PC</div>
                  <div style={{ fontSize: '.63rem', color: 'rgba(255,255,255,.3)', marginTop: '.15rem' }}>DiagnosticOS · Port 3000+</div>
                </div>
                {/* Devices */}
                {[{ emoji: '📱', label: 'Reception Tablet' }, { emoji: '💻', label: 'Lab Laptop' }, { emoji: '🖥️', label: 'Radiology PC' }].map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '.55rem', marginBottom: '.6rem' }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(68,114,196,.3)' }} />
                    <div className="hub-device">{d.emoji} {d.label}</div>
                  </div>
                ))}
                {/* Cloud sync badge */}
                <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.22)', borderRadius: 8, padding: '.55rem .75rem' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '.68rem', color: '#4ade80', fontWeight: 600 }}>Syncing to cloud when online</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '5rem 2rem', maxWidth: 950, margin: '0 auto', textAlign: 'center' }}>
        <div className="sbadge" style={{ display: 'inline-flex' }}>Get started in minutes</div>
        <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.35rem)', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '3.5rem' }}>
          Up and running in 3 steps
        </h2>
        <div className="mstack" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', justifyContent: 'center' }}>
          {[
            { step: '01', title: 'Create your workspace', desc: 'Sign up with your facility name and email. Your private multi-department workspace is live in under 30 seconds.' },
            { step: '02', title: 'Invite your team', desc: 'Add staff as Reception, Lab, or Radiology users. Each person gets a tailored, role-specific view instantly.' },
            { step: '03', title: 'Start seeing patients', desc: 'Register your first patient and watch results flow instantly across every department in real time — or offline.' },
          ].map((s, i) => (
            <div key={s.step} style={{ flex: 1, minWidth: 200 }}>
              <div style={{ width: 50, height: 50, borderRadius: 13, background: 'linear-gradient(135deg,rgba(68,114,196,.2),rgba(68,114,196,.06))', border: '1px solid rgba(68,114,196,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.3rem', fontSize: '.85rem', fontWeight: 800, color: '#7fa3e0', letterSpacing: '-.02em' }}>
                {s.step}
              </div>
              <h3 style={{ fontSize: '.97rem', fontWeight: 700, marginBottom: '.55rem', color: 'rgba(255,255,255,.88)' }}>{s.title}</h3>
              <p style={{ fontSize: '.83rem', color: 'rgba(255,255,255,.36)', lineHeight: 1.75 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TESTIMONIALS ─────────────────────────────────────── */}
      <section style={{ padding: '5rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div className="sbadge" style={{ display: 'inline-flex' }}>
            <RiStarFill size={12} color="#f59e0b" /> Trusted across Africa
          </div>
          <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.35rem)', fontWeight: 800, letterSpacing: '-.04em' }}>
            What our facilities are saying
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '1.15rem' }}>
          {[
            { quote: '"Before DiagnosticOS, lab results were scribbled on paper and handed across the corridor. Now reception, lab, and radiology all see updates live. Even when NEPA takes light, we keep working on the Local Hub."', name: 'Dr. Aminu Bello', title: 'Medical Director', org: 'Kano Diagnostic Centre, Nigeria' },
            { quote: '"The offline Local Hub is a lifesaver. Our internet goes down three times a week. We installed it on one laptop and now the whole clinic runs off it. Auto-updates happen on their own."', name: 'Rejoice Adjei', title: 'Lab Manager', org: 'Accra MedLab, Ghana' },
            { quote: '"Setup was shockingly simple — we were live in 10 minutes. The thermal printing works perfectly with our 80mm printer. Slips look professional and patients now trust us more."', name: 'Fatima Waweru', title: 'Operations Lead', org: 'Nairobi Diagnostic Hub, Kenya' },
          ].map(t => (
            <div key={t.name} className="t-card">
              <div style={{ display: 'flex', gap: '.25rem', marginBottom: '1.25rem' }}>
                {[...Array(5)].map((_, i) => <RiStarFill key={i} size={14} color="#f59e0b" />)}
              </div>
              <p style={{ fontSize: '.87rem', color: 'rgba(255,255,255,.55)', lineHeight: 1.8, marginBottom: '1.5rem', fontStyle: 'italic' }}>{t.quote}</p>
              <div>
                <div style={{ fontSize: '.87rem', fontWeight: 700, color: 'rgba(255,255,255,.82)' }}>{t.name}</div>
                <div style={{ fontSize: '.76rem', color: 'rgba(255,255,255,.3)', marginTop: '.12rem' }}>{t.title} · {t.org}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PRICING ──────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: '5rem 2rem', maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        <div className="sbadge" style={{ display: 'inline-flex' }}>Simple pricing</div>
        <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.35rem)', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '.7rem' }}>
          Start free. Scale when ready.
        </h2>
        <p style={{ color: 'rgba(255,255,255,.35)', marginBottom: '3rem', fontSize: '.93rem' }}>
          Both tiers are free to get started. No credit card. No commitment.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1.15rem', textAlign: 'left' }}>

          {/* Cloud SaaS */}
          <div className="pc-std">
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#7fa3e0', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: '.45rem' }}>Cloud SaaS</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-.045em' }}>Free Trial</div>
              <div style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.3)', marginTop: '.3rem' }}>Full access · No time limit in beta</div>
            </div>
            <div style={{ marginBottom: '1.75rem' }}>
              {['Patient registration & slips', 'Lab results & queue management', 'Radiology request tracking', 'Role-based staff access (unlimited)', 'Thermal print support (80mm)', 'Real-time multi-device sync', 'Cloud backup & data security'].map(f => (
                <div key={f} className="chk">
                  <div className="chk-ico"><RiCheckLine size={11} color="#7fa3e0" /></div>
                  <span style={{ fontSize: '.83rem', color: 'rgba(255,255,255,.55)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button id="pricing-cloud-cta" onClick={() => router.push('/signup')} className="btn-g" style={{ width: '100%', padding: '.85rem', fontSize: '.9rem', fontWeight: 600 }}>
              Create Free Workspace
            </button>
          </div>

          {/* Local Hub */}
          <div className="pc-pro" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, background: 'linear-gradient(135deg,#4472c4,#6b97e4)', borderRadius: 100, padding: '.25rem .7rem', fontSize: '.62rem', fontWeight: 700, color: '#fff', letterSpacing: '.05em', textTransform: 'uppercase' }}>
              Recommended
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#7fa3e0', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: '.45rem' }}>Local Hub</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-.045em' }}>Free</div>
              <div style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.3)', marginTop: '.3rem' }}>Always free · Windows desktop app</div>
            </div>
            <div style={{ marginBottom: '1.75rem' }}>
              {['Everything in Cloud SaaS', 'Works 100% offline (no internet)', 'LAN collaboration for all staff', 'mDNS auto-discovery — no IP setup', 'Silent background auto-updates', 'Local SQLite data storage', 'Automatic cloud sync when online'].map(f => (
                <div key={f} className="chk">
                  <div className="chk-ico" style={{ background: 'rgba(68,114,196,.28)' }}><RiCheckLine size={11} color="#90b4f0" /></div>
                  <span style={{ fontSize: '.83rem', color: 'rgba(255,255,255,.65)' }}>{f}</span>
                </div>
              ))}
            </div>
            <button id="pricing-hub-cta" onClick={() => router.push('/download')} className="btn-p" style={{ width: '100%', padding: '.85rem', fontSize: '.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}>
              <RiDownloadLine size={17} /> Download for Windows
            </button>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────────── */}
      <section style={{ padding: '5rem 2rem', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(68,114,196,.12) 0%,rgba(68,114,196,.04) 100%)', border: '1px solid rgba(68,114,196,.22)', borderRadius: 24, padding: 'clamp(2.5rem,5vw,4rem) 2rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%,rgba(68,114,196,.18) 0%,transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#4472c4,#6b97e4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(68,114,196,.4)' }}>
                <RiLockPasswordLine size={24} color="white" />
              </div>
            </div>
            <h2 style={{ fontSize: 'clamp(1.7rem,4vw,2.5rem)', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '1rem', lineHeight: 1.15 }}>
              Ready to go paperless?
            </h2>
            <p style={{ color: 'rgba(255,255,255,.38)', marginBottom: '2rem', fontSize: '.93rem', lineHeight: 1.8 }}>
              Set up your facility in under 5 minutes. No credit card.<br />No contract. No IT department needed.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button id="final-cta-signup" onClick={() => router.push('/signup')} className="btn-p" style={{ padding: '.9rem 2.25rem', fontSize: '1rem' }}>
                Create your workspace →
              </button>
              <button id="final-cta-download" onClick={() => router.push('/download')} className="btn-g" style={{ padding: '.9rem 1.75rem', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}>
                <RiDownloadLine size={18} /> Get Local Hub
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '3rem 2rem', maxWidth: 1100, margin: '0 auto' }}>
        <div className="mstack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.8rem' }}>
              <div style={{ background: 'linear-gradient(135deg,#4472c4,#6b97e4)', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RiMicroscopeLine size={15} color="white" />
              </div>
              <span style={{ fontWeight: 800, fontSize: '.9rem', color: 'rgba(255,255,255,.75)' }}>DiagnosticOS</span>
            </div>
            <p style={{ fontSize: '.76rem', color: 'rgba(255,255,255,.22)', maxWidth: 230, lineHeight: 1.65 }}>
              Built for African diagnostic centres that run on resilience, not just reliable power.
            </p>
          </div>
          <div className="mstack" style={{ display: 'flex', gap: '3rem' }}>
            <div>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: '.75rem' }}>Product</div>
              {['Features', 'Local Hub', 'Pricing', 'Changelog'].map(l => (
                <div key={l} style={{ marginBottom: '.45rem' }}><a href="#" className="nl" style={{ fontSize: '.8rem' }}>{l}</a></div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: '.75rem' }}>Company</div>
              {['About', 'Contact', 'Privacy Policy', 'Terms of Service'].map(l => (
                <div key={l} style={{ marginBottom: '.45rem' }}><a href="#" className="nl" style={{ fontSize: '.8rem' }}>{l}</a></div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.05)', marginTop: '2.5rem', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem' }}>
          <span style={{ fontSize: '.73rem', color: 'rgba(255,255,255,.18)' }}>© {new Date().getFullYear()} DiagnosticOS · Built for Africa</span>
          <span style={{ fontSize: '.73rem', color: 'rgba(255,255,255,.13)' }}>All rights reserved</span>
        </div>
      </footer>
    </div>
  );
}
