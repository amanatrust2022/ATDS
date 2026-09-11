'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { createOrganizationWithFallback } from '@/lib/workspace';
import { RiCheckLine, RiTeamLine, RiRocketLine, RiMicroscopeLine, RiLoader4Line } from '@remixicon/react';

import form from '../login/login.module.css';
import styles from './onboarding.module.css';

/**
 * Onboarding: the bridge sign-up crosses to reach its new workspace.
 *
 * Shares the sign-in screen's controls (../login/login.module.css) — it is the
 * tail of the same front door and commits to the same single dark treatment.
 *
 * What the old manual form owed a keyboard user: not one of its six fields had
 * a label attached to it (six <label>s with no htmlFor, six inputs with no id),
 * and its errors were painted red with nothing to announce them, so a workspace
 * that failed to create said nothing a screen reader could hear.
 */

const cx = (...names: Array<string | undefined | false>) => names.filter(Boolean).join(' ');

type Status = 'loading' | 'creating' | 'no_data' | 'ready';

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withTimeout(promise: any, ms: number, onWarning: () => void): Promise<any> {
  const timer = setTimeout(onWarning, ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

export default function OnboardingPage() {
  const { user, organization, profile, loading, refreshOrg } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [status, setStatus] = useState<Status>('loading');
  const [onboardingStatusText, setOnboardingStatusText] = useState('Loading your account…');
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // Fallback manual form (when no localStorage/metadata data found)
  const [org, setOrg] = useState({ name: '', slug: '', address: '', phone: '', email: '', letterheadLine2: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;

    // If organization is already loaded, we are ready!
    if (organization) {
      setStatus('ready');
      return;
    }

    // Prevent executing onboarding/creation checks if we are already in the middle of creating or ready
    if (status === 'creating' || status === 'ready') return;

    // If we have no profile yet, give the auth provider enough time to resolve it.
    // Cloud cold starts (Supabase on Vercel/Cloudflare) can take up to 10s on first request.
    if (!profile) {
      if (retryCount < 6) {
        const retryTimer = setTimeout(() => {
          setRetryCount((value) => value + 1);
        }, 2000);
        return () => clearTimeout(retryTimer);
      }

      setStatus('no_data');
      setError('Your account details are taking longer than expected to load. Please refresh the page or try logging out and back in.');
      return;
    }

    // If the profile already has a linked organization, do NOT try to create it.
    if (profile.organization_id) {
      if (status !== 'loading') {
        setStatus('loading');
      }
      return;
    }

    // Check user metadata first (world-standard persistent fallback)
    const meta = user?.user_metadata;
    if (meta && meta.pending_org_slug) {
      createOrgFromData({
        name: meta.pending_org_name,
        slug: meta.pending_org_slug,
        address: meta.pending_org_address || '',
        phone: meta.pending_org_phone || '',
        email: meta.pending_org_email || '',
        letterheadLine2: meta.pending_org_letterhead_line2 || '',
      });
    } else {
      // Fallback to localStorage
      const stored = localStorage.getItem('pending_org');
      if (stored) {
        createOrgFromData(JSON.parse(stored));
      } else {
        // No stored data — show manual entry form
        if (status !== 'no_data') {
          setStatus('no_data');
        }
      }
    }
  }, [loading, profile, organization, user, status, retryCount]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createOrgFromData = async (data: any) => {
    setStatus('creating');
    setError('');
    setOnboardingStatusText('Initiating workspace setup…');

    const t1 = setTimeout(() => setOnboardingStatusText('Reserving Workspace ID on cloud…'), 1000);
    const t2 = setTimeout(() => setOnboardingStatusText('Creating organization details…'), 2500);
    const t3 = setTimeout(() => setOnboardingStatusText('Configuring admin profile relations…'), 4500);
    const t4 = setTimeout(() => setOnboardingStatusText('Syncing clinical workspace session…'), 7000);

    try {
      // 1. Create organization (falls back to direct insert if the RPC is unavailable)
      const { organization: createdOrg } = await withTimeout(
        createOrganizationWithFallback(supabase, data, { userId: user?.id }),
        20000,
        () => setError('Slow network connection detected. Still creating workspace… please wait.')
      );

      if (!createdOrg?.id) {
        throw new Error('Failed to create your workspace. Please try again.');
      }

      localStorage.removeItem('pending_org');

      // 2. Refresh workspace context
      await withTimeout(
        refreshOrg(),
        20000,
        () => setError('Slow network connection detected. Still refreshing your profile… please wait.')
      );

      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
    } catch (err) {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setStatus('no_data');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org.name || !org.slug) return;
    setSubmitting(true);
    await createOrgFromData(org);
    setSubmitting(false);
  };

  const errorBox = error && (
    <p className={form.error} role="alert">
      <span className={form.errorMark} aria-hidden="true">!</span>
      <span>{error}</span>
    </p>
  );

  // ── Loading / Creating ──
  if (status === 'loading' || status === 'creating') {
    return (
      <div className={cx(styles.page, styles.centered)}>
        <span className={styles.spinner} aria-hidden="true">
          <RiLoader4Line size={40} />
        </span>
        <p className={styles.status} role="status">
          {status === 'creating' ? onboardingStatusText : 'Loading your account…'}
        </p>
        {errorBox}
      </div>
    );
  }

  // ── No stored data — show manual facility entry form ──
  if (status === 'no_data') {
    return (
      <div className={styles.page}>
        <div className={styles.panel}>
          <div className={styles.hero}>
            <span className={styles.mark} aria-hidden="true">
              <RiMicroscopeLine size={24} />
            </span>
            <h1 className={styles.heading}>Set up your facility</h1>
            <p className={styles.sub}>Account confirmed! Now let&apos;s create your workspace.</p>
          </div>

          <form onSubmit={handleManualSubmit} className={form.form} noValidate>
            {errorBox}

            <div>
              <label className={form.label} htmlFor="ob-name">
                Facility / organisation name <span className={form.req} aria-hidden="true">*</span>
              </label>
              <input
                id="ob-name"
                className={cx(form.input, form.inputPlain)}
                value={org.name}
                onChange={(e) => setOrg({ ...org, name: e.target.value, slug: slugify(e.target.value) })}
                placeholder="e.g. Northgate Diagnostic Centre"
                autoComplete="organization"
                required
              />
            </div>

            <div>
              <label className={form.label} htmlFor="ob-line2">Letterhead second line (optional)</label>
              <input
                id="ob-line2"
                className={cx(form.input, form.inputPlain)}
                value={org.letterheadLine2}
                onChange={(e) => setOrg({ ...org, letterheadLine2: e.target.value })}
                placeholder="e.g. AND CLINICAL SERVICES LIMITED"
              />
            </div>

            <div>
              <label className={form.label} htmlFor="ob-slug">Workspace ID</label>
              <div className={form.inputWrap}>
                <span className={form.prefix} aria-hidden="true">app.com/</span>
                <input
                  id="ob-slug"
                  className={cx(form.input, form.inputPrefixed)}
                  value={org.slug}
                  onChange={(e) => setOrg({ ...org, slug: slugify(e.target.value) })}
                  placeholder="your-centre"
                  required
                />
              </div>
            </div>

            <div>
              <label className={form.label} htmlFor="ob-address">Address</label>
              <input
                id="ob-address"
                className={cx(form.input, form.inputPlain)}
                value={org.address}
                onChange={(e) => setOrg({ ...org, address: e.target.value })}
                placeholder="No. 15 C Tudun Wada Bus Stop"
                autoComplete="street-address"
              />
            </div>

            <div className={form.pair}>
              <div>
                <label className={form.label} htmlFor="ob-phone">Phone</label>
                <input
                  id="ob-phone"
                  className={cx(form.input, form.inputPlain)}
                  type="tel"
                  value={org.phone}
                  onChange={(e) => setOrg({ ...org, phone: e.target.value })}
                  placeholder="+234…"
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className={form.label} htmlFor="ob-email">Email</label>
                <input
                  id="ob-email"
                  className={cx(form.input, form.inputPlain)}
                  type="email"
                  value={org.email}
                  onChange={(e) => setOrg({ ...org, email: e.target.value })}
                  placeholder="info@facility.com"
                />
              </div>
            </div>

            <button type="submit" className={form.submit} disabled={submitting} aria-busy={submitting}>
              {submitting ? onboardingStatusText : 'Create workspace'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Ready — workspace exists ──
  if (!organization) return null;

  const steps = [
    { icon: <RiMicroscopeLine size={22} />, title: 'Workspace created', desc: 'Your facility is registered on Redian.' },
    { icon: <RiTeamLine size={22} />, title: 'Invite your staff', desc: 'Add Lab Scientists, Radiologists, and Receptionists from the Admin panel.' },
    { icon: <RiRocketLine size={22} />, title: 'Go live', desc: 'Start registering patients and managing test results in real time.' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.welcome}>
        <span className={styles.check} aria-hidden="true">
          <RiCheckLine size={30} />
        </span>
        <h1 className={styles.welcomeHead}>
          Welcome, {profile?.full_name?.split(' ')[0]}! <span aria-hidden="true">🎉</span>
        </h1>
        <p className={styles.welcomeSub}>
          <span className={styles.welcomeOrg}>{organization.name}</span> is ready. Here&apos;s what to do next:
        </p>

        <ul className={styles.steps}>
          {steps.map((s) => (
            <li key={s.title} className={styles.step}>
              <span className={styles.stepIcon} aria-hidden="true">{s.icon}</span>
              <div>
                <p className={styles.stepTitle}>{s.title}</p>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className={styles.workspaceNote}>
          Your workspace: <strong>/{organization.slug}/reception</strong>
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className={form.submit}
            onClick={() => router.push(`/${organization.slug}/admin/staff`)}
          >
            Invite staff &amp; configure workspace →
          </button>
          <button
            type="button"
            className={form.ghost}
            onClick={() => router.push(`/${organization.slug}/reception`)}
          >
            Skip and go to reception
          </button>
        </div>
      </div>
    </div>
  );
}
