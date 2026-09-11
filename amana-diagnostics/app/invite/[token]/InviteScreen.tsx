'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { RiMicroscopeLine, RiShieldCheckLine, RiUploadCloud2Line, RiEyeLine, RiEyeOffLine } from '@remixicon/react';
import { apiBase } from '@/lib/cloudOrigin';

import styles from '../../login/login.module.css';

/**
 * Invite acceptance: the front door for staff a workspace has invited.
 *
 * Shares the sign-in screen's stylesheet — it is the same front door and
 * commits to the same single dark treatment for the same reason.
 *
 * What the old screen owed a keyboard user: not one of its fields had a label
 * attached to it (four <label>s with no htmlFor, four inputs with no id, above
 * a <select> that read as "combobox" with no name). The two password-reveal
 * buttons had no name at all. Errors were painted red and never announced. The
 * password fields did not tell the browser they were new credentials.
 *
 * And the lookup's slow-network warning went into the same state as a real
 * error and was never cleared, so an invite that loaded after a slow moment
 * opened under a red "slow network" message about a check that had passed.
 */

const cx = (...names: Array<string | undefined | false>) => names.filter(Boolean).join(' ');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withTimeout(promise: any, ms: number, onWarning: () => void): Promise<any> {
  const timer = setTimeout(onWarning, ms);
  try {
    return await promise;
  } finally {
    clearTimeout(timer);
  }
}

const roleLabels: Record<string, string> = {
  reception: 'Receptionist',
  lab: 'Lab Scientist',
  radiology: 'Radiologist',
  admin: 'Administrator',
};

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invite, setInvite] = useState<any>(null);
  const [org, setOrg] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const [form, setForm] = useState({
    title: 'Mr.',
    firstName: '',
    lastName: '',
    surname: '',
    password: '',
    confirm: '',
  });

  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        // Read through the server, not straight from the table. The anon-read
        // policy that used to make the direct query work also let anyone list
        // every pending invitation in the system; it is gone. Holding the token
        // is still the whole of the authorisation — it just cannot be guessed
        // by asking for the list any more.
        const fetchPromise = fetch('/api/invite/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const res = await withTimeout(
          fetchPromise,
          10000,
          () => setError('Slow network connection detected. Still retrieving invitation details… please wait.')
        );

        if (!res.ok) {
          setInvalid(true);
        } else {
          const data = await res.json();
          setInvite(data);
          setOrg({ name: data.organizationName });
          // The slow-network warning, if it fired, is about a lookup that has
          // now succeeded. It must not sit over the form the invitee fills in.
          setError('');
        }
      } catch (err) {
        console.error('Invite fetch error:', err);
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchInvite();
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSignatureFile(file);
      setSignaturePreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSubmitting(true); setError('');

    try {
      // 1. Upload Signature (Optional)
      let publicUrl = null;
      if (signatureFile) {
        const fileExt = signatureFile.name.split('.').pop();
        const fileName = `${invite.id}-${Math.random()}.${fileExt}`;

        const uploadPromise = supabase.storage
          .from('signatures')
          .upload(fileName, signatureFile);

        const { error: uploadError } = await withTimeout(
          uploadPromise,
          15000,
          () => setError('Slow network connection detected. Still uploading your signature image… please wait.')
        );

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('signatures')
          .getPublicUrl(fileName);

        publicUrl = data.publicUrl;
      }

      // 2. Format Full Name
      const fullName = `${form.title} ${form.firstName} ${form.lastName ? form.lastName + ' ' : ''}${form.surname}`.trim();
      void fullName;

      // 3. Call server-side invite acceptance API
      const apiEndpoint = `${apiBase()}/api/invite/accept`;

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: form.password,
          title: form.title,
          firstName: form.firstName,
          lastName: form.lastName,
          surname: form.surname,
          publicUrl,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to accept invitation');
      }

      // 4. Log the user in seamlessly
      const signInPromise = supabase.auth.signInWithPassword({
        email: invite.email,
        password: form.password,
      });

      const { error: signInErr } = await withTimeout(
        signInPromise,
        15000,
        () => setError('Network is slow. Your account was created, but login timed out. Try signing in manually.')
      );

      if (signInErr) throw signInErr;

      // 5. Redirect directly to workspace
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected connection error occurred.');
      setSubmitting(false);
    }
  };

  const errorBox = error && (
    <p className={styles.error} role="alert">
      <span className={styles.errorMark} aria-hidden="true">!</span>
      <span>{error}</span>
    </p>
  );

  if (loading) {
    return (
      <div className={cx(styles.page, styles.single)}>
        <div className={styles.state}>
          <span className={styles.brandMark} aria-hidden="true">
            <RiMicroscopeLine size={20} />
          </span>
          <p className={styles.sub} role="status">Verifying invite link…</p>
        </div>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className={cx(styles.page, styles.single)}>
        <div className={styles.state}>
          <span className={styles.stateIcon} aria-hidden="true">🔗</span>
          <h1 className={styles.heading}>Invalid or expired link</h1>
          <p className={styles.sub}>
            This invite link has already been used, has expired, or verification timed out on a
            slow connection. Ask your administrator to send a fresh invite.
          </p>
          <a href="/login" className={styles.link}>← Back to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className={cx(styles.page, styles.single)}>
      <main className={styles.main}>
        <div className={cx(styles.form, styles.wide)}>
          <div className={styles.centred}>
            <span className={styles.brandMark} aria-hidden="true">
              <RiMicroscopeLine size={20} />
            </span>
            <h1 className={styles.heading}>You&apos;ve been invited</h1>
            <p className={styles.invitedTo}>
              Join <span className={styles.invitedOrg}>{org?.name}</span> as{' '}
              {roleLabels[invite.role] || invite.role}
            </p>
          </div>

          <p className={styles.notice}>
            <span className={styles.noticeMark} aria-hidden="true">
              <RiShieldCheckLine size={16} />
            </span>
            <span>Signing in as <strong>{invite.email}</strong></span>
          </p>

          <form onSubmit={handleAccept} className={styles.form} noValidate>
            {errorBox}

            <div className={styles.titleRow}>
              <div>
                <label className={styles.label} htmlFor="inv-title">
                  Title <span className={styles.req} aria-hidden="true">*</span>
                </label>
                <select
                  id="inv-title"
                  className={cx(styles.input, styles.inputPlain, styles.select)}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                >
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Prof.">Prof.</option>
                  <option value="MLS.">MLS.</option>
                  <option value="Pharm.">Pharm.</option>
                </select>
              </div>
              <div>
                <label className={styles.label} htmlFor="inv-surname">
                  Surname <span className={styles.req} aria-hidden="true">*</span>
                </label>
                <input
                  id="inv-surname"
                  className={cx(styles.input, styles.inputPlain)}
                  value={form.surname}
                  onChange={(e) => setForm({ ...form, surname: e.target.value })}
                  placeholder="e.g. Doe"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>

            <div className={styles.pair}>
              <div>
                <label className={styles.label} htmlFor="inv-first">
                  First name <span className={styles.req} aria-hidden="true">*</span>
                </label>
                <input
                  id="inv-first"
                  className={cx(styles.input, styles.inputPlain)}
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="e.g. John"
                  autoComplete="given-name"
                  required
                />
              </div>
              <div>
                <label className={styles.label} htmlFor="inv-last">Last name</label>
                <input
                  id="inv-last"
                  className={cx(styles.input, styles.inputPlain)}
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Optional"
                  autoComplete="additional-name"
                />
              </div>
            </div>

            <div>
              <span className={styles.label} id="inv-sig-label">Digital signature (optional)</span>
              <input
                id="inv-sig"
                type="file"
                accept="image/*"
                className={cx('sr-only', styles.fileInput)}
                onChange={handleFileChange}
                aria-labelledby="inv-sig-label"
              />
              <label htmlFor="inv-sig" className={styles.dropzone}>
                {signaturePreview ? (
                  <>
                    <img src={signaturePreview} alt="Your signature" className={styles.sigPreview} />
                    <span>Change signature</span>
                  </>
                ) : (
                  <>
                    <span className={styles.dropIcon} aria-hidden="true">
                      <RiUploadCloud2Line size={24} />
                    </span>
                    <span>Upload signature image</span>
                  </>
                )}
              </label>
            </div>

            <div className={styles.group}>
              <div>
                <label className={styles.label} htmlFor="inv-password">
                  Create password <span className={styles.req} aria-hidden="true">*</span>
                </label>
                <div className={styles.inputWrap}>
                  <input
                    id="inv-password"
                    className={cx(styles.input, styles.inputPlain)}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
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
                <label className={styles.label} htmlFor="inv-confirm">
                  Confirm password <span className={styles.req} aria-hidden="true">*</span>
                </label>
                <div className={styles.inputWrap}>
                  <input
                    id="inv-confirm"
                    className={cx(styles.input, styles.inputPlain)}
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirm}
                    onChange={(e) => setForm({ ...form, confirm: e.target.value })}
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
            </div>

            <button type="submit" className={styles.submit} disabled={submitting} aria-busy={submitting}>
              {submitting ? 'Creating account…' : 'Accept invite & join workspace'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
