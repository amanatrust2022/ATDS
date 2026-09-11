'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { createOrganizationWithFallback, upsertProfileForUser } from '@/lib/workspace';
import { useRouter } from 'next/navigation';
import { RiMicroscopeLine, RiArrowLeftLine, RiMailLine, RiEyeLine, RiEyeOffLine } from '@remixicon/react';

import styles from '../login/login.module.css';

/**
 * Sign-up: the facility, then the admin who runs it.
 *
 * Shares the sign-in screen's stylesheet — it is the same front door, and
 * commits to the same single dark treatment for the same reason.
 *
 * Nothing here had a label attached to it: nine <label> elements, nine
 * inputs, no htmlFor. Errors were painted red and never announced. The two
 * password-reveal buttons had no name at all. And on a slow connection the
 * ten-second warning went into the same state as a real error, so step two
 * opened under a red "slow network" message about a check that had passed.
 */

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withTimeout(promise: any, ms: number, onWarning: () => void): Promise<any> {
  const timer = setTimeout(onWarning, ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

type Step = 1 | 2 | 'confirm';

const cx = (...names: Array<string | undefined | false>) => names.filter(Boolean).join(' ');

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [org, setOrg] = useState({ name: '', slug: '', address: '', phone: '', email: '', letterheadLine2: '' });
  /** An abandoned workspace holding this slug, which this sign-up will take over. */
  const [adoptableOrgId, setAdoptableOrgId] = useState<string | null>(null);
  const [admin, setAdmin] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [checkingOrg, setCheckingOrg] = useState(false);
  const [orgStatusText, setOrgStatusText] = useState('Checking Workspace ID...');
  const [statusText, setStatusText] = useState('Creating account...');

  const handleOrgNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org.name || !org.slug) { setError('Organisation name and workspace ID are required.'); return; }
    if (!/^[a-z0-9-]+$/.test(org.slug)) { setError('Workspace ID can only contain lowercase letters, numbers, and hyphens.'); return; }

    setCheckingOrg(true);
    setOrgStatusText('Connecting to registry...');
    setError('');

    const statusTimer = setTimeout(() => setOrgStatusText('Verifying workspace ID availability...'), 1000);

    try {
      // One question, asked of the server: is this workspace ID free, and if it
      // is taken, is it actually in use? Nobody has an account at this point in
      // sign-up, so an anonymous browser can no longer read `organizations`
      // itself (supabase_tighten_rls.sql). /api/signup/claim-slug answers both
      // halves with the service key and discloses nothing else.
      const checkPromise = fetch('/api/signup/claim-slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: org.slug }),
      });
      const res = await withTimeout(
        checkPromise,
        10000,
        () => setError('Slow network connection detected. Still verifying workspace ID availability... please wait.')
      );

      clearTimeout(statusTimer);

      if (!res.ok) {
        throw new Error('Could not check that workspace ID. Please try again.');
      }
      const claim = await res.json();

      // Taken is not always in use. A sign-up that failed after reserving the
      // workspace but before creating the account leaves one behind with
      // nobody in it, and the clinic could never claim their own name back.
      if (!claim.available && !claim.adoptable) {
        setError('This Workspace ID (slug) is already taken. Please choose a different one.');
        return;
      }
      setAdoptableOrgId(claim.adoptable ? claim.organizationId : null);
      // The slow-network warning, if it fired, is about a check that has now
      // passed. It must not follow the admin onto the next step.
      setError('');
      setStep(2);
    } catch (err: any) {
      clearTimeout(statusTimer);
      setError(err.message || 'Failed to verify Workspace ID availability. Please try again.');
    } finally {
      setCheckingOrg(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (admin.password !== admin.confirm) { setError('Passwords do not match.'); return; }
    if (admin.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true); setError('');
    setStatusText('Initiating registration...');

    let createdOrgId: string | null = null;

    // Dynamic progress timers to give instant-feeling visual feedback
    const t1 = setTimeout(() => setStatusText('Reserving Workspace ID...'), 1000);
    const t2 = setTimeout(() => setStatusText('Creating your Clinic profile...'), 2500);
    const t3 = setTimeout(() => setStatusText('Registering Admin user account...'), 4500);
    const t4 = setTimeout(() => setStatusText('Establishing secure credentials...'), 7000);

    try {
      localStorage.setItem('pending_org', JSON.stringify(org));

      // 1. Create organization to reserve the slug (fallbacks to direct insert if the RPC is unavailable).
      //
      // Unless an abandoned one is already sitting on this slug, in which case
      // take that over rather than leave the clinic unable to use their own
      // name. Only ever an organisation with no members — see
      // /api/signup/claim-slug.
      let orgId = adoptableOrgId;

      if (!orgId) {
        const { organization: newOrg } = await withTimeout(
          createOrganizationWithFallback(supabase, {
            name: org.name,
            slug: org.slug,
            address: org.address || null,
            phone: org.phone || null,
            email: org.email || null,
            letterheadLine2: org.letterheadLine2 || null,
          }),
          12000,
          () => setError('Slow network connection detected. Still setting up workspace... please wait.')
        );

        if (!newOrg?.id) {
          throw new Error('Failed to create your workspace. Please try again.');
        }
        orgId = newOrg.id;
        // Only a workspace this attempt created is one this attempt may undo.
        createdOrgId = newOrg.id;
      }

      // 2. Sign up user account with organization_id in metadata
      const signUpPromise = supabase.auth.signUp({
        email: admin.email,
        password: admin.password,
        options: {
          data: {
            full_name: admin.fullName,
            role: 'admin',
            organization_id: orgId,
            pending_org_name: org.name,
            pending_org_slug: org.slug,
            pending_org_address: org.address,
            pending_org_phone: org.phone,
            pending_org_email: org.email,
            pending_org_letterhead_line2: org.letterheadLine2
          },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        }
      });
      const dataRes = await withTimeout(
        signUpPromise,
        15000,
        () => setError('Slow network connection detected. Still creating user account... please wait.')
      );

      const { data, error: authErr } = dataRes;
      if (authErr) throw authErr;

      // If user already exists, identities will be empty
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new Error('This email address is already registered. Please sign in instead.');
      }

      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);

      if (data.user) {
        try {
          await upsertProfileForUser(supabase, data.user.id, {
            full_name: admin.fullName,
            role: 'admin',
            organization_id: orgId,
            email: admin.email,
          });
        } catch (profileErr) {
          console.warn('[signup] failed to upsert profile after sign-up', profileErr);
        }
      }

      setError('');
      if (data.session) {
        router.push('/onboarding?new=1');
      } else {
        setStep('confirm');
      }
    } catch (err: any) {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
      setError(err.message || 'An unexpected error occurred during sign up.');

      // Rollback organization reservation if signup fails
      if (createdOrgId) {
        try {
          const rollbackPromise = supabase.rpc('delete_organization_rollback', { p_org_id: createdOrgId });
          await withTimeout(rollbackPromise, 5000, () => {});
        } catch (rollbackErr) {
          console.warn('Rollback failed:', rollbackErr);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const errorBox = error && (
    <p className={styles.error} role="alert">
      <span className={styles.errorMark} aria-hidden="true">!</span>
      <span>{error}</span>
    </p>
  );

  return (
    <div className={cx(styles.page, styles.single)}>
      <main className={styles.main}>
        <div className={cx(styles.form, styles.wide)}>
          <div className={styles.brandAlways}>
            <span className={styles.brandMark} aria-hidden="true">
              <RiMicroscopeLine size={20} />
            </span>
            <span className={styles.brandName}>Redian</span>
          </div>

          <div className={styles.centred}>
            <h1 className={styles.heading}>
              {step === 'confirm' ? 'Check your email' : 'Create your workspace'}
            </h1>
            <p className={styles.sub}>
              {step === 'confirm'
                ? `We sent a confirmation link to ${admin.email}`
                : 'Start your free trial — no credit card required'}
            </p>
          </div>

          {/* ── Email confirm screen ── */}
          {step === 'confirm' && (
            <div className={styles.sent}>
              <span className={styles.sentMark} aria-hidden="true">
                <RiMailLine size={22} />
              </span>
              <p className={styles.sub}>
                Click the link in your email to confirm your account and set up your workspace.
                The link will bring you back here automatically.
              </p>
              <p className={styles.tip}>
                Check your spam or junk folder if you don&apos;t see it within a minute.
              </p>
              <button type="button" className={styles.ghost} onClick={() => setStep(2)}>
                ← Try again or use a different email
              </button>
            </div>
          )}

          {/* ── Step indicator ── */}
          {step !== 'confirm' && (
            <ol className={styles.steps} aria-label="Sign-up progress">
              {(['Facility details', 'Admin account'] as const).map((label, i) => (
                <li
                  key={label}
                  className={cx(styles.step, i < step && styles.stepDone)}
                  aria-current={i + 1 === step ? 'step' : undefined}
                >
                  <span className={styles.stepBar} aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ol>
          )}

          {/* ── Step 1: Facility details ── */}
          {step === 1 && (
            <form onSubmit={handleOrgNext} className={styles.form} noValidate>
              {errorBox}

              <div>
                <label className={styles.label} htmlFor="su-org-name">Facility / organisation name</label>
                <input
                  id="su-org-name"
                  className={cx(styles.input, styles.inputPlain)}
                  value={org.name}
                  onChange={(e) => setOrg({ ...org, name: e.target.value, slug: slugify(e.target.value) })}
                  placeholder="e.g. Northgate Diagnostic Centre"
                  autoComplete="organization"
                  required
                />
              </div>

              <div>
                <label className={styles.label} htmlFor="su-line2">Letterhead second line (optional)</label>
                <input
                  id="su-line2"
                  className={cx(styles.input, styles.inputPlain)}
                  value={org.letterheadLine2}
                  onChange={(e) => setOrg({ ...org, letterheadLine2: e.target.value })}
                  placeholder="e.g. AND CLINICAL SERVICES LTD"
                />
              </div>

              <div>
                <label className={styles.label} htmlFor="su-slug">Workspace ID</label>
                <div className={styles.inputWrap}>
                  <span className={styles.prefix} aria-hidden="true">app.com/</span>
                  <input
                    id="su-slug"
                    className={cx(styles.input, styles.inputPrefixed)}
                    value={org.slug}
                    onChange={(e) => setOrg({ ...org, slug: slugify(e.target.value) })}
                    placeholder="amana-trust"
                    aria-describedby="su-slug-hint"
                    required
                  />
                </div>
                <p id="su-slug-hint" className={styles.hint}>Lowercase letters, numbers and hyphens only.</p>
              </div>

              <div>
                <label className={styles.label} htmlFor="su-address">Address</label>
                <input
                  id="su-address"
                  className={cx(styles.input, styles.inputPlain)}
                  value={org.address}
                  onChange={(e) => setOrg({ ...org, address: e.target.value })}
                  placeholder="No. 15 C Tudun Wada Bus Stop"
                  autoComplete="street-address"
                />
              </div>

              <div className={styles.pair}>
                <div>
                  <label className={styles.label} htmlFor="su-phone">Phone</label>
                  <input
                    id="su-phone"
                    className={cx(styles.input, styles.inputPlain)}
                    type="tel"
                    value={org.phone}
                    onChange={(e) => setOrg({ ...org, phone: e.target.value })}
                    placeholder="+234..."
                    autoComplete="tel"
                  />
                </div>
                <div>
                  <label className={styles.label} htmlFor="su-org-email">Facility email</label>
                  <input
                    id="su-org-email"
                    className={cx(styles.input, styles.inputPlain)}
                    type="email"
                    value={org.email}
                    onChange={(e) => setOrg({ ...org, email: e.target.value })}
                    placeholder="info@facility.com"
                  />
                </div>
              </div>

              <button type="submit" className={styles.submit} disabled={checkingOrg} aria-busy={checkingOrg}>
                {checkingOrg ? orgStatusText : 'Continue to admin setup →'}
              </button>
            </form>
          )}

          {/* ── Step 2: Admin account ── */}
          {step === 2 && (
            <form onSubmit={handleSignup} className={styles.form} noValidate>
              {errorBox}

              <div>
                <label className={styles.label} htmlFor="su-name">Your full name</label>
                <input
                  id="su-name"
                  className={cx(styles.input, styles.inputPlain)}
                  value={admin.fullName}
                  onChange={(e) => setAdmin({ ...admin, fullName: e.target.value })}
                  placeholder="e.g. Dr. Aisha Ibrahim"
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <label className={styles.label} htmlFor="su-email">Email address</label>
                <input
                  id="su-email"
                  className={cx(styles.input, styles.inputPlain)}
                  type="email"
                  value={admin.email}
                  onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                  placeholder="admin@facility.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className={styles.label} htmlFor="su-password">Password</label>
                <div className={styles.inputWrap}>
                  <input
                    id="su-password"
                    className={cx(styles.input, styles.inputPlain)}
                    type={showPassword ? 'text' : 'password'}
                    value={admin.password}
                    onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className={styles.reveal}
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className={styles.label} htmlFor="su-confirm">Confirm password</label>
                <div className={styles.inputWrap}>
                  <input
                    id="su-confirm"
                    className={cx(styles.input, styles.inputPlain)}
                    type={showConfirm ? 'text' : 'password'}
                    value={admin.confirm}
                    onChange={(e) => setAdmin({ ...admin, confirm: e.target.value })}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className={styles.reveal}
                    onClick={() => setShowConfirm(!showConfirm)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    aria-pressed={showConfirm}
                  >
                    {showConfirm ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className={styles.submit} disabled={loading} aria-busy={loading}>
                {loading ? statusText : 'Create workspace'}
              </button>

              <div className={cx(styles.row, styles.centred)}>
                <button type="button" className={styles.link} onClick={() => { setStep(1); setError(''); }}>
                  <RiArrowLeftLine size={14} aria-hidden="true" /> Back to facility details
                </button>
              </div>
            </form>
          )}

          {step !== 'confirm' && (
            <p className={cx(styles.sub, styles.centred)}>
              Already have a workspace? <a href="/login" className={styles.link}>Sign in</a>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
