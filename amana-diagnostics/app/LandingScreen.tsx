'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  RiMicroscopeLine, RiTestTubeLine, RiRadarLine, RiHospitalLine,
  RiShieldCheckLine, RiCloudLine, RiPrinterLine, RiTeamLine,
  RiDownloadLine, RiCheckLine, RiStarFill, RiWifiOffLine,
  RiLockPasswordLine,
} from '@remixicon/react';

import { useAuth } from '@/components/AuthProvider';
import styles from './landing.module.css';

/**
 * The public landing page.
 *
 * Three things were wrong with it beyond the styling.
 *
 * `getDashboardUrl` was a `const` arrow declared *below* the early return for
 * local mode, and the effect that calls it is registered above. In local mode
 * the component returns before that line ever runs, so a signed-in user
 * opening the desktop app hit a ReferenceError and sat on "Redirecting…" for
 * good. Only signed-out users got through, because they take the other branch.
 *
 * Local mode was also decided during render by reading localStorage, which the
 * server cannot do — so the server sent the marketing page and the client
 * immediately rendered a redirect shim in its place. It is decided after mount
 * now, from the same starting value on both sides.
 *
 * And Sign In was hidden below 768px with no menu to open in its place, so on
 * a phone the only thing on offer was a free trial — to people who already had
 * an account.
 */

/** Whether this browser is the clinic's own hub rather than the public site. */
function detectLocalMode(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true';
  }

  const saved = localStorage.getItem('amana_local_mode');
  if (saved !== null) return saved === 'true';

  const w = window as unknown as Record<string, unknown>;
  if (w['__TAURI_INTERNALS__'] !== undefined || w['__TAURI__'] !== undefined) return true;

  const host = window.location.hostname;
  const onLan =
    host === 'localhost' || host === '127.0.0.1' ||
    host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.');

  return process.env.NODE_ENV !== 'development' && onLan;
}

const FEATURES = [
  { icon: <RiHospitalLine size={22} />, title: 'Smart Reception', flag: null, desc: 'Register patients in seconds. Auto-generate numbered slips, multi-test selection, and live preview before printing. Handles walk-ins and referrals seamlessly.' },
  { icon: <RiTestTubeLine size={22} />, title: 'Laboratory Module', flag: null, desc: 'Queue management, structured result entry, customisable reference ranges, and automatic flagging of critical and abnormal values.' },
  { icon: <RiRadarLine size={22} />, title: 'Radiology Module', flag: null, desc: 'Imaging request tracking with department-specific workflows, report entry forms, and instant result availability to referring departments.' },
  { icon: <RiPrinterLine size={22} />, title: 'Thermal Print Ready', flag: 'Built in', desc: '80mm thermal printer optimised slips and formatted result reports with letterhead. No extra configuration or special drivers needed.' },
  { icon: <RiCloudLine size={22} />, title: 'Real-time Sync', flag: null, desc: 'Every update — patient registered, result entered, report completed — is instantly visible across all departments. No page refreshing.' },
  { icon: <RiTeamLine size={22} />, title: 'Role-Based Access', flag: null, desc: 'Reception, Lab, Radiology, and Admin each see only what matters to them. Invite your entire staff with one click and set permissions instantly.' },
];

const HUB_POINTS = [
  { title: 'Zero-config LAN collaboration', desc: 'All staff connect via the same Wi-Fi router — no cables, no IT.' },
  { title: 'Auto-discovery (mDNS/Bonjour)', desc: 'Devices find the hub automatically. No IP address typing, ever.' },
  { title: 'One-click Windows installer', desc: 'A simple .exe. Ready in under 2 minutes on any Windows 10/11 PC.' },
  { title: 'Silent overnight auto-updates', desc: 'The app improves itself whenever internet is available. No manual steps.' },
];

const STEPS = [
  { step: '01', title: 'Create your workspace', desc: 'Sign up with your facility name and email. Your private multi-department workspace is live in under 30 seconds.' },
  { step: '02', title: 'Invite your team', desc: 'Add staff as Reception, Lab, or Radiology users. Each person gets a tailored, role-specific view instantly.' },
  { step: '03', title: 'Start seeing patients', desc: 'Register your first patient and watch results flow instantly across every department in real time — or offline.' },
];

const QUOTES = [
  { quote: 'Before Redian, lab results were scribbled on paper and handed across the corridor. Now reception, lab, and radiology all see updates live. Even when NEPA takes light, we keep working on the Local Hub.', name: 'Dr. Aminu Bello', title: 'Medical Director', org: 'Kano Diagnostic Centre, Nigeria' },
  { quote: 'The offline Local Hub is a lifesaver. Our internet goes down three times a week. We installed it on one laptop and now the whole clinic runs off it. Auto-updates happen on their own.', name: 'Rejoice Adjei', title: 'Lab Manager', org: 'Accra MedLab, Ghana' },
  { quote: 'Setup was shockingly simple — we were live in 10 minutes. The thermal printing works perfectly with our 80mm printer. Slips look professional and patients now trust us more.', name: 'Fatima Waweru', title: 'Operations Lead', org: 'Nairobi Diagnostic Hub, Kenya' },
];

const CLOUD_FEATURES = [
  'Patient registration & slips',
  'Lab results & queue management',
  'Radiology request tracking',
  'Role-based staff access (unlimited)',
  'Thermal print support (80mm)',
  'Real-time multi-device sync',
  'Cloud backup & data security',
];

const HUB_FEATURES = [
  'Everything in Cloud SaaS',
  'Works 100% offline (no internet)',
  'LAN collaboration for all staff',
  'mDNS auto-discovery — no IP setup',
  'Silent background auto-updates',
  'Local SQLite data storage',
  'Automatic cloud sync when online',
];

export default function LandingPage() {
  const router = useRouter();
  const { user, profile, organization, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  /*
   * Starts from the value the server used, so the first client render matches
   * the markup that arrived. Only then does it look at localStorage.
   */
  const [localMode, setLocalMode] = useState(
    () => process.env.NEXT_PUBLIC_LOCAL_SERVER_MODE === 'true',
  );
  useEffect(() => setLocalMode(detectLocalMode()), []);

  // Declared before the effect that calls it, and before any early return.
  const dashboardUrl = () => {
    if (!organization) return '/onboarding';
    switch (profile?.role) {
      case 'lab':
      case 'lab_tech': return `/${organization.slug}/lab`;
      case 'radiology': return `/${organization.slug}/radiology`;
      case 'admin': return `/${organization.slug}/admin`;
      default: return `/${organization.slug}/reception`;
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!localMode || loading) return;
    router.replace(user ? dashboardUrl() : '/login');
  }, [localMode, user, loading]);

  if (localMode) {
    return (
      <div className={styles['redirect']}>
        <p role="status">Redirecting to clinic portal…</p>
      </div>
    );
  }

  const signedIn = !loading && user;

  return (
    <div className={styles['page']}>
      {/* ─── NAV ────────────────────────────────────────────── */}
      <nav className={`${styles['nav']} ${scrolled ? styles['navScrolled'] : ''}`}>
        <div className={styles['navLeft']}>
          <button type="button" className={styles['brand']} onClick={() => router.push('/')}>
            <span className={styles['mark']}>
              <RiMicroscopeLine size={18} color="white" aria-hidden="true" />
            </span>
            <span className={styles['wordmark']}>Redian</span>
            <span className="sr-only">— back to the top of the page</span>
          </button>

          <div className={styles['navLinks']} data-mobile-hidden>
            <a href="#features" className={styles['link']}>Features</a>
            <a href="#local-hub" className={styles['link']}>Local Hub</a>
            <a href="#how-it-works" className={styles['link']}>How it Works</a>
            <a href="#pricing" className={styles['link']}>Pricing</a>
          </div>
        </div>

        <div className={styles['navActions']}>
          {signedIn ? (
            <button
              type="button"
              onClick={() => router.push(dashboardUrl())}
              className={`${styles['btn']} ${styles['btnPrimary']} ${styles['btnSm']}`}
            >
              Go to Workspace →
            </button>
          ) : (
            <>
              {/* The portal is for patients, who mostly arrive from a link in a
                * text message rather than from here — it can stand down on a
                * narrow screen. Sign In cannot: it is the whole reason a
                * returning user is on this page. */}
              <button
                type="button"
                data-mobile-hidden
                onClick={() => router.push('/portal/login')}
                className={`${styles['btn']} ${styles['btnQuiet']} ${styles['btnSm']} ${styles['portalBtn']}`}
              >
                Patient Portal
              </button>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className={`${styles['btn']} ${styles['btnQuiet']} ${styles['btnSm']}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => router.push('/signup')}
                className={`${styles['btn']} ${styles['btnPrimary']} ${styles['btnSm']}`}
              >
                Start Free Trial
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ─── HERO ───────────────────────────────────────────── */}
      <section className={styles['hero']}>
        <div className={`${styles['orb']} ${styles['orbLeft']}`} aria-hidden="true" />
        <div className={`${styles['orb']} ${styles['orbRight']}`} aria-hidden="true" />

        <div className={styles['heroInner']}>
          <div className={`${styles['s1']} ${styles['heroFlag']}`}>
            <p className={styles['heroFlagInner']}>
              <span className={styles['ping']} aria-hidden="true" />
              Offline-First Local Hub · Works without internet · Auto-updates silently
            </p>
          </div>

          <h1 className={`${styles['s2']} ${styles['h1']} ${styles['gradientInk']}`}>
            Run your diagnostic centre.<br />Even without internet.
          </h1>

          <p className={`${styles['s3']} ${styles['heroLede']}`}>
            Redian connects Reception, Lab, and Radiology in real time — on cloud or completely
            offline. Built for African diagnostics where reliable internet is a privilege, not a
            guarantee.
          </p>

          <div className={`${styles['s4']} ${styles['ctaRow']}`}>
            {signedIn ? (
              <button
                type="button"
                onClick={() => router.push(dashboardUrl())}
                className={`${styles['btn']} ${styles['btnPrimary']} ${styles['btnLg']}`}
              >
                Open Workspace →
              </button>
            ) : (
              <>
                <button
                  type="button"
                  id="hero-signup"
                  onClick={() => router.push('/signup')}
                  className={`${styles['btn']} ${styles['btnPrimary']} ${styles['btnLg']}`}
                >
                  Start Free Trial — No credit card
                </button>
                <button
                  type="button"
                  id="hero-download"
                  onClick={() => router.push('/download')}
                  className={`${styles['btn']} ${styles['btnQuiet']} ${styles['btnMd']}`}
                >
                  <RiDownloadLine size={18} aria-hidden="true" /> Download Local Hub
                </button>
              </>
            )}
          </div>

          {/* A drawing of the product, not the product. */}
          <div
            className={`${styles['float']} ${styles['preview']}`}
            data-mobile-hidden
            aria-hidden="true"
          >
            <div className={styles['previewFrame']}>
              <div className={styles['previewChrome']}>
                <span className={`${styles['dot']} ${styles['dotRed']}`} />
                <span className={`${styles['dot']} ${styles['dotAmber']}`} />
                <span className={`${styles['dot']} ${styles['dotGreen']}`} />
                <span className={styles['previewUrl']}>
                  localhost:3000/kano-diagnostics/reception
                </span>
              </div>

              <div className={styles['previewBody']}>
                <div className={styles['previewNav']}>
                  {['Reception', 'Lab Queue', 'Radiology', 'Reports', 'Admin'].map((item, i) => (
                    <div
                      key={item}
                      className={`${styles['previewNavItem']} ${i === 0 ? styles['previewNavItemOn'] : ''}`}
                    >
                      {item}
                    </div>
                  ))}
                </div>

                <div>
                  <div className={styles['previewStats']}>
                    {[
                      { label: 'Patients Today', val: '47', tint: styles['tintBlue'] },
                      { label: 'Lab Pending', val: '12', tint: styles['tintAmber'] },
                      { label: 'Results Ready', val: '31', tint: styles['tintGreen'] },
                    ].map((s) => (
                      <div key={s.label} className={`${styles['previewStat']} ${s.tint}`}>
                        <div className={`${styles['previewStatNum']} ${s.tint}`}>{s.val}</div>
                        <div className={styles['previewStatLabel']}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {[
                    { row: 'Ibrahim Al-Hassan · Blood Panel · Lab', ready: false },
                    { row: 'Aisha Musa · Chest X-Ray · Radiology', ready: false },
                    { row: 'Emeka Obi · Malaria RDT · Lab', ready: true },
                  ].map((r) => (
                    <div key={r.row} className={styles['previewRow']}>
                      <span>{r.row}</span>
                      <span
                        className={`${styles['pill']} ${r.ready ? styles['pillReady'] : styles['pillPending']}`}
                      >
                        {r.ready ? 'Ready' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles['previewGlow']} />
          </div>
        </div>
      </section>

      {/* ─── STATS ──────────────────────────────────────────── */}
      <section className={styles['stats']}>
        <div className={styles['statGrid']}>
          {[
            { num: '100+', label: 'Diagnostic centres', sub: 'across Africa' },
            { num: '< 5 min', label: 'Setup time', sub: 'from signup to live' },
            { num: '99.9%', label: 'Cloud uptime', sub: 'Supabase-backed' },
            { num: 'Free', label: 'Local Hub', sub: 'forever, no lock-in' },
          ].map((s) => (
            <div key={s.label} className={styles['stat']}>
              <div className={styles['statNum']}>{s.num}</div>
              <div className={styles['statLabel']}>{s.label}</div>
              <div className={styles['statSub']}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ───────────────────────────────────────── */}
      <section id="features" className={styles['section']}>
        <div className={styles['sectionHead']}>
          <p className={styles['badge']}>
            <RiShieldCheckLine size={13} aria-hidden="true" /> One complete platform
          </p>
          <h2 className={styles['h2']}>
            Every department. <span className={styles['gradientBlue']}>One system.</span>
          </h2>
          <p className={styles['lede']}>
            No more scattered spreadsheets or paper forms. Redian unifies your entire facility in a
            single, beautiful workspace.
          </p>
        </div>

        <div className={styles['grid']}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles['card']}>
              <div className={styles['cardHead']}>
                <span className={styles['cardIcon']}>{f.icon}</span>
                {f.flag && <span className={styles['cardFlag']}>{f.flag}</span>}
              </div>
              <h3 className={styles['cardTitle']}>{f.title}</h3>
              <p className={styles['cardText']}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── LOCAL HUB ──────────────────────────────────────── */}
      <section id="local-hub" className={styles['section']}>
        <div className={styles['hub']}>
          <div className={styles['hubOrb']} aria-hidden="true" />

          <div className={styles['hubSplit']}>
            <div className={styles['hubCopy']}>
              <p className={styles['badge']}>
                <RiWifiOffLine size={13} aria-hidden="true" /> Offline-First Local Hub
              </p>
              <h2 className={styles['hubH2']}>Works when your internet doesn&apos;t.</h2>
              <p className={styles['hubLede']}>
                Install the Local Hub on one Windows PC in your clinic. Every device — phone,
                tablet, or laptop — connects over the clinic Wi-Fi with <em>zero internet
                required</em>. When connectivity returns, everything syncs to the cloud
                automatically.
              </p>

              <ul className={styles['hubList']}>
                {HUB_POINTS.map((item) => (
                  <li key={item.title} className={styles['hubRow']}>
                    <span className={styles['hubTick']}>
                      <RiCheckLine size={16} aria-hidden="true" />
                    </span>
                    <span>
                      <span className={styles['hubRowTitle']}>{item.title}</span>
                      <span className={styles['hubRowText']}>{item.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                id="hub-download-btn"
                onClick={() => router.push('/download')}
                className={`${styles['btn']} ${styles['btnDeep']} ${styles['btnMd']} ${styles['hubCta']}`}
              >
                <RiDownloadLine size={18} aria-hidden="true" /> Download Local Hub for Windows
              </button>
              <p className={styles['hubFinePrint']}>
                Windows 10/11 · Free forever · Installs in &lt; 2 minutes
              </p>
            </div>

            {/* A diagram, read aloud by the four points above it instead. */}
            <div
              className={`${styles['float']} ${styles['hubDiagram']}`}
              data-mobile-hidden
              aria-hidden="true"
            >
              <div className={styles['hubPc']}>
                <div className={styles['hubPcGlyph']}>🖥️</div>
                <div className={styles['hubPcName']}>Local Hub PC</div>
                <div className={styles['hubPcPort']}>Redian · Port 3000+</div>
              </div>

              {[
                { emoji: '📱', label: 'Reception Tablet' },
                { emoji: '💻', label: 'Lab Laptop' },
                { emoji: '🖥️', label: 'Radiology PC' },
              ].map((d) => (
                <div key={d.label} className={styles['hubDeviceRow']}>
                  <span className={styles['hubWire']} />
                  <span className={styles['hubDevice']}>{d.emoji} {d.label}</span>
                </div>
              ))}

              <div className={styles['hubSync']}>
                <span className={styles['hubSyncDot']} />
                Syncing to cloud when online
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ───────────────────────────────────── */}
      <section id="how-it-works" className={`${styles['section']} ${styles['narrow']} ${styles['centre']}`}>
        <p className={styles['badge']}>Get started in minutes</p>
        <h2 className={`${styles['h2']} ${styles['gapAfter']}`}>
          Up and running in 3 steps
        </h2>

        {/* Numbered because the order is real: you cannot invite a team into a
          * workspace that does not exist yet. */}
        <ol className={styles['steps']}>
          {STEPS.map((s) => (
            <li key={s.step} className={styles['step']}>
              <span className={styles['stepNum']} aria-hidden="true">{s.step}</span>
              <h3 className={styles['stepTitle']}>{s.title}</h3>
              <p className={styles['stepText']}>{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ─── TESTIMONIALS ───────────────────────────────────── */}
      <section className={styles['section']}>
        <div className={styles['sectionHead']}>
          <p className={styles['badge']}>
            <RiStarFill size={12} aria-hidden="true" /> Trusted across Africa
          </p>
          <h2 className={styles['h2']}>What our facilities are saying</h2>
        </div>

        <div className={styles['grid']}>
          {QUOTES.map((t) => (
            <figure key={t.name} className={styles['quoteCard']}>
              <div className={styles['stars']} role="img" aria-label="Rated five out of five">
                {[0, 1, 2, 3, 4].map((i) => (
                  <RiStarFill key={i} size={14} aria-hidden="true" />
                ))}
              </div>
              <blockquote className={styles['quoteText']}>“{t.quote}”</blockquote>
              <figcaption>
                <span className={styles['quoteName']}>{t.name}</span>
                <span className={styles['quoteOrg']}>{t.title} · {t.org}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ─── PRICING ────────────────────────────────────────── */}
      <section id="pricing" className={`${styles['section']} ${styles['tight']} ${styles['centre']}`}>
        <p className={styles['badge']}>Simple pricing</p>
        <h2 className={styles['h2']}>Start free. Scale when ready.</h2>
        <p className={`${styles['lede']} ${styles['gapAfterSm']}`}>
          Both tiers are free to get started. No credit card. No commitment.
        </p>

        <div className={styles['priceGrid']}>
          <div className={styles['priceCard']}>
            <div className={styles['priceHead']}>
              <div className={styles['priceKind']}>Cloud SaaS</div>
              <div className={styles['priceAmount']}>Free Trial</div>
              <div className={styles['priceNote']}>Full access · No time limit in beta</div>
            </div>
            <ul className={styles['priceList']}>
              {CLOUD_FEATURES.map((f) => (
                <li key={f} className={styles['check']}>
                  <span className={styles['checkIcon']}>
                    <RiCheckLine size={11} aria-hidden="true" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              id="pricing-cloud-cta"
              onClick={() => router.push('/signup')}
              className={`${styles['btn']} ${styles['btnQuiet']} ${styles['btnWide']}`}
            >
              Create Free Workspace
            </button>
          </div>

          <div className={`${styles['priceCard']} ${styles['priceCardLead']}`}>
            <span className={styles['priceFlag']}>Recommended</span>
            <div className={styles['priceHead']}>
              <div className={styles['priceKind']}>Local Hub</div>
              <div className={styles['priceAmount']}>Free</div>
              <div className={styles['priceNote']}>Always free · Windows desktop app</div>
            </div>
            <ul className={styles['priceList']}>
              {HUB_FEATURES.map((f) => (
                <li key={f} className={styles['check']}>
                  <span className={`${styles['checkIcon']} ${styles['checkIconLead']}`}>
                    <RiCheckLine size={11} aria-hidden="true" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              id="pricing-hub-cta"
              onClick={() => router.push('/download')}
              className={`${styles['btn']} ${styles['btnPrimary']} ${styles['btnWide']}`}
            >
              <RiDownloadLine size={17} aria-hidden="true" /> Download for Windows
            </button>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ──────────────────────────────────────── */}
      <section className={`${styles['section']} ${styles['slim']} ${styles['centre']}`}>
        <div className={styles['finalCta']}>
          <div className={styles['finalWash']} aria-hidden="true" />
          <div className={styles['finalInner']}>
            <div className={styles['finalMarkWrap']}>
              <span className={styles['finalMark']}>
                <RiLockPasswordLine size={24} color="white" aria-hidden="true" />
              </span>
            </div>
            <h2 className={styles['finalH2']}>Ready to go paperless?</h2>
            <p className={styles['finalLede']}>
              Set up your facility in under 5 minutes. No credit card.<br />
              No contract. No IT department needed.
            </p>
            <div className={styles['ctaRow']}>
              <button
                type="button"
                id="final-cta-signup"
                onClick={() => router.push('/signup')}
                className={`${styles['btn']} ${styles['btnPrimary']} ${styles['btnLg']}`}
              >
                Create your workspace →
              </button>
              <button
                type="button"
                id="final-cta-download"
                onClick={() => router.push('/download')}
                className={`${styles['btn']} ${styles['btnQuiet']} ${styles['btnMd']}`}
              >
                <RiDownloadLine size={18} aria-hidden="true" /> Get Local Hub
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────── */}
      <footer className={styles['footer']}>
        <div className={styles['footerTop']}>
          <div>
            <div className={styles['footerBrand']}>
              <span className={`${styles['mark']} ${styles['markSm']}`}>
                <RiMicroscopeLine size={15} color="white" aria-hidden="true" />
              </span>
              <span className={styles['footerWordmark']}>Redian</span>
            </div>
            <p className={styles['footerBlurb']}>
              Built for African diagnostic centres that run on resilience, not just reliable power.
            </p>
          </div>

          {/*
            * Every link here used to be href="#" — eight of them, including
            * Privacy Policy and Terms of Service on a page that collects an
            * email address. A dead legal link is worse than no link, because it
            * says the document exists. These are the pages that do.
            */}
          <div className={styles['footerCols']}>
            <div>
              <div className={styles['footerColTitle']}>Product</div>
              <ul className={styles['footerList']}>
                <li><a href="#features" className={styles['link']}>Features</a></li>
                <li><a href="#local-hub" className={styles['link']}>Local Hub</a></li>
                <li><a href="#pricing" className={styles['link']}>Pricing</a></li>
                <li><a href="/download" className={styles['link']}>Download</a></li>
              </ul>
            </div>
            <div>
              <div className={styles['footerColTitle']}>Sign in</div>
              <ul className={styles['footerList']}>
                <li><a href="/login" className={styles['link']}>Staff sign in</a></li>
                <li><a href="/portal/login" className={styles['link']}>Patient portal</a></li>
                <li><a href="/signup" className={styles['link']}>Create a workspace</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className={styles['footerBase']}>
          <span>© {new Date().getFullYear()} Redian · Built for Africa</span>
          <span>All rights reserved</span>
        </div>
      </footer>
    </div>
  );
}
