'use client';
import {
  RiMicroscopeLine, RiDownloadLine, RiCheckLine, RiArrowLeftLine, RiRefreshLine,
  RiShieldCheckLine, RiWifiOffLine, RiComputerLine,
} from '@remixicon/react';

import pkg from '../../package.json';
import styles from '../landing.module.css';

/**
 * The Local Hub download page.
 *
 * The version used to be typed in here by hand — '1.2.20' — with nothing
 * keeping it in step with the build, so the first release after that would
 * have sent every new clinic an old installer from a page calling it current.
 * It comes from package.json now, which is what the desktop build is stamped
 * with.
 *
 * The download itself was a <button> calling window.open(): popup-blockable,
 * not copyable, and not a download. It is a link.
 *
 * And the page said records were kept "in an encrypted SQLite database". They
 * are not. There is no at-rest encryption anywhere in this codebase, and a
 * clinic reading that would reasonably believe their patient records were
 * protected on the disk. The sentence now says what is true.
 */

const CURRENT_VERSION: string = pkg.version;
const RELEASES = 'https://github.com/voltex-technologies/redian-releases/releases/download';
const DOWNLOAD_URL = `${RELEASES}/v${CURRENT_VERSION}/Redian_${CURRENT_VERSION}_x64-setup.exe`;
const DOWNLOAD_URL_MSI = `${RELEASES}/v${CURRENT_VERSION}/Redian_${CURRENT_VERSION}_x64_en-US.msi`;

const STEPS = [
  { title: 'Download and run the installer', desc: 'Click the download button above. When the .exe file finishes downloading, double-click to run it. Windows may show a security prompt — click "More info" then "Run anyway".' },
  { title: 'Complete the setup wizard', desc: 'Choose your installation folder (or keep the default). Click Install. The whole process takes under 2 minutes. A shortcut will appear on your Desktop.' },
  { title: 'Connect other devices on your Wi-Fi', desc: 'Open the app. Look at the system tray icon for the local IP address (e.g. 192.168.1.x:3000). On any phone, tablet, or laptop on the same Wi-Fi, open a browser and type that address. Done.' },
];

const INCLUDED = [
  { icon: <RiWifiOffLine size={18} />, title: 'Full offline operation', desc: 'Reception, Lab, and Radiology work without any internet connection.' },
  { icon: <RiComputerLine size={18} />, title: 'LAN multi-user access', desc: 'All clinic staff connect from their own devices over Wi-Fi.' },
  { icon: <RiRefreshLine size={18} />, title: 'Silent auto-updates', desc: 'Whenever internet is available, the app updates itself in the background.' },
  { icon: <RiShieldCheckLine size={18} />, title: 'Data stays local', desc: 'All records are stored on-site, on the hub PC, in a local SQLite database. Nothing leaves the building unless you turn cloud sync on.' },
];

const SPECS = [
  { label: 'Operating System', value: 'Windows 10 or 11 (64-bit)' },
  { label: 'RAM', value: '2 GB minimum, 4 GB recommended' },
  { label: 'Storage', value: '500 MB free disk space' },
  { label: 'Network', value: 'Wi-Fi router (for multi-device access)' },
  { label: 'Internet', value: 'Not required to operate · Used only for auto-updates' },
  { label: 'Port', value: '3000 (or next available port, auto-detected)' },
];

const UPDATE_STEPS = [
  'Every 4 hours, the app silently checks our servers for a new version.',
  'If a new version is available, it downloads in the background — you keep working.',
  'When you next restart the app, it installs the update automatically.',
  'You never need to manually download or reinstall — it stays up to date on its own.',
];

const cx = (...names: Array<string | undefined | false>) => names.filter(Boolean).join(' ');

export default function DownloadPage() {
  return (
    <div className={styles['page']}>
      {/* NAV */}
      <nav className={cx(styles['nav'], styles['navSticky'])}>
        <div className={styles['navLeft']}>
          <a href="/" className={styles['brand']}>
            <span className={styles['mark']}>
              <RiMicroscopeLine size={17} color="white" aria-hidden="true" />
            </span>
            <span className={styles['wordmark']}>Redian</span>
            <span className="sr-only">home</span>
          </a>
          <a href="/" className={cx(styles['btn'], styles['btnQuiet'], styles['btnXs'])}>
            <RiArrowLeftLine size={14} aria-hidden="true" /> Back to Home
          </a>
        </div>
        <a href="/signup" className={cx(styles['btn'], styles['btnPrimary'], styles['btnSm'])}>
          Start Cloud Trial →
        </a>
      </nav>

      {/* HERO */}
      <section className={styles['dlHero']}>
        <div className={cx(styles['orb'], styles['dlOrb'])} aria-hidden="true" />

        <div className={styles['heroInner']}>
          <div className={cx(styles['s1'], styles['dlMarkWrap'])}>
            <span className={styles['dlMark']}>
              <RiDownloadLine size={34} aria-hidden="true" />
            </span>
          </div>

          <p className={cx(styles['s2'], styles['dlVersion'])}>
            <span className={styles['dlVersionDot']} aria-hidden="true" />
            Version {CURRENT_VERSION} · Ready to download
          </p>

          <h1 className={cx(styles['s3'], styles['dlH1'], styles['gradientInk'])}>
            Redian<br />Local Hub
          </h1>

          <p className={cx(styles['s4'], styles['dlLede'])}>
            Run your full diagnostic system — offline. Install on one Windows PC and every device
            in your clinic connects over Wi-Fi. Auto-updates silently in the background.
          </p>

          <div className={cx(styles['s4'], styles['dlActions'])}>
            <a
              id="main-download-btn"
              href={DOWNLOAD_URL}
              download
              className={cx(styles['btn'], styles['btnPrimary'], styles['btnXl'])}
            >
              <RiDownloadLine size={22} aria-hidden="true" />
              Download Local Hub installer (.exe)
            </a>
            <a href={DOWNLOAD_URL_MSI} download className={styles['dlAlt']}>
              Alternative: download the MSI installer (.msi)
            </a>
          </div>

          <ul className={styles['dlMeta']}>
            <li>Version {CURRENT_VERSION}</li>
            <li>Windows 10 / 11</li>
            <li>Free forever</li>
            <li>Auto-updates via internet</li>
          </ul>
        </div>
      </section>

      {/* INSTALLATION STEPS */}
      <section className={styles['dlSection']}>
        <h2 id="install-heading" className={styles['dlH2']}>Install in 3 steps</h2>
        <ol className={styles['dlSteps']} aria-labelledby="install-heading">
          {STEPS.map((s, i) => (
            <li key={s.title} className={styles['dlStep']}>
              <span className={styles['dlStepNum']} aria-hidden="true">{i + 1}</span>
              <div>
                <h3 className={styles['dlStepTitle']}>{s.title}</h3>
                <p className={styles['dlStepText']}>{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* WHAT'S INCLUDED */}
      <section className={styles['dlSection']}>
        <h2 className={styles['dlH2']}>What&apos;s included</h2>
        <div className={styles['dlGrid']}>
          {INCLUDED.map((f) => (
            <div key={f.title} className={styles['dlFeature']}>
              <span className={styles['dlFeatureIcon']}>{f.icon}</span>
              <h3 className={styles['dlFeatureTitle']}>{f.title}</h3>
              <p className={styles['dlFeatureText']}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SYSTEM REQUIREMENTS */}
      <section className={styles['dlSection']}>
        <h2 className={styles['dlH2']}>System requirements</h2>
        <dl className={styles['specs']}>
          {SPECS.map((r) => (
            <div key={r.label} className={styles['specRow']}>
              <dt className={styles['specLabel']}>{r.label}</dt>
              <dd className={styles['specValue']}>{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* AUTO-UPDATE EXPLAINER */}
      <section className={styles['dlSection']}>
        <div className={styles['explainer']}>
          <div className={styles['explainerHead']}>
            <span className={styles['explainerIcon']}>
              <RiRefreshLine size={18} aria-hidden="true" />
            </span>
            <h2 className={styles['explainerTitle']}>How auto-updates work</h2>
          </div>
          <ul className={styles['explainerList']}>
            {UPDATE_STEPS.map((t) => (
              <li key={t} className={styles['explainerRow']}>
                <span className={styles['explainerTick']}>
                  <RiCheckLine size={11} aria-hidden="true" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className={styles['dlBottom']}>
        <a
          id="bottom-download-btn"
          href={DOWNLOAD_URL}
          download
          className={cx(styles['btn'], styles['btnPrimary'], styles['btnXl'], styles['btnWide'])}
        >
          <RiDownloadLine size={22} aria-hidden="true" />
          Download Local Hub installer v{CURRENT_VERSION} (.exe)
        </a>
        <a href={DOWNLOAD_URL_MSI} download className={styles['dlAlt']}>
          Alternative: download the MSI installer (.msi)
        </a>
        <p className={styles['dlFinePrint']}>
          Free forever · Windows 10/11 · No credit card · No account needed to use the Local Hub
        </p>
        <p className={styles['dlAside']}>
          <strong>Also available on Cloud.</strong> For clinics with reliable internet, our
          cloud-hosted version needs no installation — sign up and start immediately.{' '}
          <a href="/signup">Create a free workspace →</a>
        </p>
      </section>

      {/* FOOTER */}
      <footer className={styles['dlFooter']}>
        © {new Date().getFullYear()} Redian ·{' '}
        <a href="/" className={styles['link']}>Home</a> ·{' '}
        <a href="/signup" className={styles['link']}>Cloud Trial</a>
      </footer>
    </div>
  );
}
