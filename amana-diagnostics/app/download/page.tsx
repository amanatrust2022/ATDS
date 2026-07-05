'use client';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiDownloadLine, RiCheckLine, RiArrowLeftLine, RiRefreshLine, RiShieldCheckLine, RiWifiOffLine, RiComputerLine, RiGithubLine, RiInformationLine } from '@remixicon/react';

const CURRENT_VERSION = '1.2.13';

// Retrieve Supabase URL dynamically from environment (fallback to Kano project URL)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://okjwqvdvrqqhvvmvkikc.supabase.co';
const DOWNLOAD_URL = `https://github.com/amanatrust2022/amana-releases/releases/download/v${CURRENT_VERSION}/DiagnosticOS_${CURRENT_VERSION}_x64-setup.exe`;
const DOWNLOAD_URL_MSI = `https://github.com/amanatrust2022/amana-releases/releases/download/v${CURRENT_VERSION}/DiagnosticOS_${CURRENT_VERSION}_x64_en-US.msi`;
const RELEASE_LIVE = true;

export default function DownloadPage() {
  const router = useRouter();

  const handleDownload = () => {
    window.open(DOWNLOAD_URL, '_blank');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#07090f', color: 'white', fontFamily: '"IBM Plex Sans", -apple-system, sans-serif' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glow {
          0%,100% { opacity:.3; } 50% { opacity:.6; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .a1 { animation: fadeUp .7s .0s ease both; }
        .a2 { animation: fadeUp .7s .1s ease both; }
        .a3 { animation: fadeUp .7s .2s ease both; }
        .a4 { animation: fadeUp .7s .3s ease both; }
        .a5 { animation: fadeUp .7s .4s ease both; }
        .orb { animation: glow 5s ease-in-out infinite; }

        .btn-p {
          background: linear-gradient(135deg,#4472c4,#5e8cd4);
          border: none; color: #fff; cursor: pointer;
          font-family: inherit; font-weight: 700; border-radius: 12px;
          box-shadow: 0 4px 24px rgba(68,114,196,.45);
          transition: all .22s ease;
          display: inline-flex; align-items: center; gap: .65rem;
        }
        .btn-p:hover { transform: translateY(-2px); box-shadow: 0 10px 36px rgba(68,114,196,.6); filter: brightness(1.08); }
        .btn-p:active { transform: translateY(0); }

        .btn-g {
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.65); cursor: pointer;
          font-family: inherit; font-weight: 500; border-radius: 10px;
          transition: all .22s ease;
          display: inline-flex; align-items: center; gap: .5rem;
        }
        .btn-g:hover { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.22); color: #fff; }

        .step-c {
          background: rgba(255,255,255,.025);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 14px; padding: 1.4rem;
          transition: border-color .3s;
        }
        .step-c:hover { border-color: rgba(68,114,196,.3); }

        .spec-row { display: flex; justify-content: space-between; align-items: center; padding: .7rem 0; border-bottom: 1px solid rgba(255,255,255,.05); }
        .spec-row:last-child { border-bottom: none; }

        .nl { color: rgba(255,255,255,.5); text-decoration: none; font-size:.88rem; font-weight:500; transition:color .2s; }
        .nl:hover { color: rgba(255,255,255,.9); }

        .gt {
          background: linear-gradient(135deg,#fff 0%,#a8c4ee 60%,#7fa3e0 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(7,9,15,.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '0 2rem', height: 66, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', cursor: 'pointer' }} onClick={() => router.push('/')}>
            <div style={{ background: 'linear-gradient(135deg,#4472c4,#6b97e4)', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(68,114,196,.45)' }}>
              <RiMicroscopeLine size={17} color="white" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '.97rem', letterSpacing: '-.03em' }}>DiagnosticOS</span>
          </div>
          <button onClick={() => router.push('/')} className="btn-g" style={{ padding: '.35rem .85rem', fontSize: '.8rem' }}>
            <RiArrowLeftLine size={14} /> Back to Home
          </button>
        </div>
        <button onClick={() => router.push('/signup')} className="btn-p" style={{ padding: '.45rem 1.1rem', fontSize: '.83rem' }}>
          Start Cloud Trial →
        </button>
      </nav>

      {/* HERO */}
      <section style={{ position: 'relative', padding: '6rem 2rem 4rem', maxWidth: 860, margin: '0 auto', textAlign: 'center', overflow: 'hidden' }}>
        {/* Orb */}
        <div className="orb" style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(68,114,196,.13) 0%,transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Icon */}
          <div className="a1" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.75rem' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg,rgba(20,45,100,.9),rgba(68,114,196,.6))', border: '1px solid rgba(68,114,196,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 40px rgba(68,114,196,.3)' }}>
              <RiDownloadLine size={34} color="#90b4f0" />
            </div>
          </div>

          {/* Status badge — changes based on whether a release exists */}
          {RELEASE_LIVE ? (
            <div className="a2" style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.22)', borderRadius: 100, padding: '.28rem .9rem', fontSize: '.72rem', color: '#4ade80', fontWeight: 700, marginBottom: '1.25rem', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              Version {CURRENT_VERSION} · Ready to Download
            </div>
          ) : (
            <div className="a2" style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 100, padding: '.28rem .9rem', fontSize: '.72rem', color: '#fbbf24', fontWeight: 700, marginBottom: '1.25rem', letterSpacing: '.04em', textTransform: 'uppercase' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              v{CURRENT_VERSION} · Build in Progress
            </div>
          )}

          <h1 className="a3 gt" style={{ fontSize: 'clamp(2.2rem,5vw,3.5rem)', fontWeight: 800, letterSpacing: '-.045em', lineHeight: 1.1, marginBottom: '1.25rem' }}>
            Amana Diagnostics<br />Local Hub
          </h1>

          <p className="a4" style={{ fontSize: 'clamp(.95rem,1.8vw,1.1rem)', color: 'rgba(255,255,255,.42)', maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.8 }}>
            Run your full diagnostic system — offline. Install on one Windows PC and every device in your clinic connects over Wi-Fi. Auto-updates silently in the background.
          </p>

          {/* Not-yet-released banner */}
          {!RELEASE_LIVE && (
            <div className="a4" style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.22)', borderRadius: 14, padding: '1.25rem 1.5rem', marginBottom: '2rem', textAlign: 'left', maxWidth: 560, margin: '0 auto 2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.6rem' }}>
                <RiInformationLine size={18} color="#fbbf24" />
                <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#fbbf24' }}>Installer not yet published</span>
              </div>
              <p style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.45)', lineHeight: 1.75, marginBottom: '.75rem' }}>
                The installer is built and uploaded by the developer. Once released, the download button below will work automatically.
              </p>
              <p style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.35)', lineHeight: 1.75 }}>
                <strong style={{ color: 'rgba(255,255,255,.55)' }}>Are you the developer?</strong> Run <code style={{ background: 'rgba(255,255,255,.08)', padding: '.1rem .4rem', borderRadius: 4, fontSize: '.78rem', fontFamily: 'monospace' }}>npm run release</code> in the project folder, then set <code style={{ background: 'rgba(255,255,255,.08)', padding: '.1rem .4rem', borderRadius: 4, fontSize: '.78rem', fontFamily: 'monospace' }}>RELEASE_LIVE = true</code> in <code style={{ background: 'rgba(255,255,255,.08)', padding: '.1rem .4rem', borderRadius: 4, fontSize: '.78rem', fontFamily: 'monospace' }}>app/download/page.tsx</code>.
              </p>
            </div>
          )}

          <div className="a5" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', alignItems: 'center' }}>
            {RELEASE_LIVE ? (
              <>
                <button id="main-download-btn" onClick={handleDownload} className="btn-p" style={{ padding: '1rem 2.5rem', fontSize: '1.05rem' }}>
                  <RiDownloadLine size={22} />
                  Download Local Hub Installer (.exe)
                </button>
                <a href={DOWNLOAD_URL_MSI} style={{ color: '#7fa3e0', fontSize: '0.82rem', textDecoration: 'underline', marginTop: '0.25rem' }}>
                  Alternative: Download MSI Installer (.msi)
                </a>
              </>
            ) : (
              <button id="main-download-btn" onClick={handleDownload} className="btn-g" style={{ padding: '1rem 2rem', fontSize: '.95rem', border: '1px solid rgba(245,158,11,.3)', color: '#fbbf24' }}>
                <RiGithubLine size={20} />
                Check GitHub Releases
              </button>
            )}
          </div>

          <div style={{ marginTop: '1rem', fontSize: '.73rem', color: 'rgba(255,255,255,.2)', display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span>Version {CURRENT_VERSION}</span>
            <span>·</span>
            <span>Windows 10 / 11</span>
            <span>·</span>
            <span>Free forever</span>
            <span>·</span>
            <span>{RELEASE_LIVE ? 'Auto-updates via internet' : 'Coming soon'}</span>
          </div>
        </div>
      </section>

      {/* INSTALLATION STEPS */}
      <section style={{ padding: '3rem 2rem', maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-.03em', marginBottom: '1.5rem', textAlign: 'center' }}>
          Install in 3 steps
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
          {[
            { num: '1', title: 'Download and run the installer', desc: 'Click the download button above. When the .exe file finishes downloading, double-click to run it. Windows may show a security prompt — click "More info" then "Run anyway".' },
            { num: '2', title: 'Complete the setup wizard', desc: 'Choose your installation folder (or keep the default). Click Install. The whole process takes under 2 minutes. A shortcut will appear on your Desktop.' },
            { num: '3', title: 'Connect other devices on your Wi-Fi', desc: 'Open the app. Look at the system tray icon for the local IP address (e.g. 192.168.1.x:3000). On any phone, tablet, or laptop on the same Wi-Fi, open a browser and type that address. Done.' },
          ].map(s => (
            <div key={s.num} className="step-c" style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,rgba(68,114,196,.25),rgba(68,114,196,.08))', border: '1px solid rgba(68,114,196,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: '.88rem', color: '#7fa3e0' }}>
                {s.num}
              </div>
              <div>
                <div style={{ fontSize: '.9rem', fontWeight: 700, color: 'rgba(255,255,255,.85)', marginBottom: '.35rem' }}>{s.title}</div>
                <div style={{ fontSize: '.81rem', color: 'rgba(255,255,255,.38)', lineHeight: 1.75 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '3rem 2rem', maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-.03em', marginBottom: '1.5rem', textAlign: 'center' }}>
          What's included
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1rem' }}>
          {[
            { icon: <RiWifiOffLine size={18} />, title: 'Full offline operation', desc: 'Reception, Lab, and Radiology work without any internet connection.' },
            { icon: <RiComputerLine size={18} />, title: 'LAN multi-user access', desc: 'All clinic staff connect from their own devices over Wi-Fi.' },
            { icon: <RiRefreshLine size={18} />, title: 'Silent auto-updates', desc: 'Whenever internet is available, the app updates itself in the background.' },
            { icon: <RiShieldCheckLine size={18} />, title: 'Data stays local', desc: 'All records stored on-site in an encrypted SQLite database.' },
          ].map(f => (
            <div key={f.title} style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '1.35rem', transition: 'border-color .3s' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(68,114,196,.12)', border: '1px solid rgba(68,114,196,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7fa3e0', marginBottom: '.9rem' }}>
                {f.icon}
              </div>
              <div style={{ fontSize: '.87rem', fontWeight: 700, color: 'rgba(255,255,255,.8)', marginBottom: '.35rem' }}>{f.title}</div>
              <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.35)', lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SYSTEM REQUIREMENTS */}
      <section style={{ padding: '3rem 2rem', maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-.03em', marginBottom: '1.5rem', textAlign: 'center' }}>
          System requirements
        </h2>
        <div style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, padding: '0 1.5rem' }}>
          {[
            { label: 'Operating System', value: 'Windows 10 or 11 (64-bit)' },
            { label: 'RAM', value: '2 GB minimum, 4 GB recommended' },
            { label: 'Storage', value: '500 MB free disk space' },
            { label: 'Network', value: 'Wi-Fi router (for multi-device access)' },
            { label: 'Internet', value: 'Not required to operate · Used only for auto-updates' },
            { label: 'Port', value: '3000 (or next available port, auto-detected)' },
          ].map(r => (
            <div key={r.label} className="spec-row">
              <span style={{ fontSize: '.83rem', color: 'rgba(255,255,255,.4)', fontWeight: 500 }}>{r.label}</span>
              <span style={{ fontSize: '.83rem', color: 'rgba(255,255,255,.7)', fontWeight: 600, textAlign: 'right', maxWidth: '55%' }}>{r.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* AUTO-UPDATE EXPLAINER */}
      <section style={{ padding: '3rem 2rem', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(7,18,48,.95),rgba(20,42,95,.5))', border: '1px solid rgba(68,114,196,.22)', borderRadius: 16, padding: '2rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(68,114,196,.15)', border: '1px solid rgba(68,114,196,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RiRefreshLine size={18} color="#7fa3e0" />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>How auto-updates work</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
            {[
              'Every 4 hours, the app silently checks our servers for a new version.',
              'If a new version is available, it downloads in the background — you keep working.',
              'When you next restart the app, it installs the update automatically.',
              'You never need to manually download or reinstall — it stays up to date on its own.',
            ].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: '.65rem', alignItems: 'flex-start' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(68,114,196,.18)', border: '1px solid rgba(68,114,196,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  <RiCheckLine size={11} color="#7fa3e0" />
                </div>
                <span style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.7 }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section style={{ padding: '3rem 2rem 5rem', maxWidth: 600, margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
        {RELEASE_LIVE ? (
          <>
            <button id="bottom-download-btn" onClick={handleDownload} className="btn-p" style={{ padding: '1rem 2.5rem', fontSize: '1.05rem', width: '100%', justifyContent: 'center' }}>
              <RiDownloadLine size={22} />
              Download Local Hub Installer v{CURRENT_VERSION} (.exe)
            </button>
            <a href={DOWNLOAD_URL_MSI} style={{ color: '#7fa3e0', fontSize: '0.82rem', textDecoration: 'underline' }}>
              Alternative: Download MSI Installer (.msi)
            </a>
          </>
        ) : (
          <button id="bottom-download-btn" onClick={handleDownload} className="btn-g" style={{ padding: '1rem 2rem', fontSize: '.95rem', width: '100%', justifyContent: 'center', border: '1px solid rgba(245,158,11,.28)', color: '#fbbf24' }}>
            <RiGithubLine size={20} />
            Check GitHub for Latest Release
          </button>
        )}
        <div style={{ marginTop: '1rem', fontSize: '.73rem', color: 'rgba(255,255,255,.2)' }}>
          Free forever · Windows 10/11 · No credit card · No account needed to use the Local Hub
        </div>
        <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12 }}>
          <p style={{ fontSize: '.8rem', color: 'rgba(255,255,255,.35)', lineHeight: 1.7 }}>
            💡 <strong style={{ color: 'rgba(255,255,255,.55)', fontWeight: 600 }}>Also available on Cloud.</strong> For clinics with reliable internet, our cloud-hosted version needs no installation — sign up and start immediately.{' '}
            <span onClick={() => router.push('/signup')} style={{ color: '#7fa3e0', cursor: 'pointer', textDecoration: 'underline' }}>Create a free workspace →</span>
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,.05)', padding: '1.5rem 2rem', textAlign: 'center' }}>
        <span style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.18)' }}>© {new Date().getFullYear()} DiagnosticOS · <a href="/" className="nl" style={{ fontSize: '.72rem' }}>Home</a> · <a href="/signup" className="nl" style={{ fontSize: '.72rem' }}>Cloud Trial</a></span>
      </footer>
    </div>
  );
}
