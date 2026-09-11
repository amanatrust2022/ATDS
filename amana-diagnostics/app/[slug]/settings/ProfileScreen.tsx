'use client';
import RequireRole from '@/components/RequireRole';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase';
import { AppearanceSettings } from '@/components/features/settings/AppearanceSettings';
import { RiUploadCloud2Line, RiSave3Line } from '@remixicon/react';
import { Alert, Badge, Button, Field, Input, Select } from '@/components/ui';

import styles from './profile.module.css';

const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(' ');

function UserSettings() {
  const { profile, user, organization } = useAuth();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    title: 'Mr.',
    firstName: '',
    lastName: '',
    surname: '',
  });

  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });

  useEffect(() => {
    if (profile) {
      setFormData({
        title: profile.title || 'Mr.',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        surname: profile.surname || '',
      });
      if (profile.signature_url) {
        setSignaturePreview(profile.signature_url);
      }
    }
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSignatureFile(file);
      setSignaturePreview((prev) => {
        // Only revoke a URL this component minted; never the stored https one.
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !user) return;

    setSaving(true);
    setMessage({ text: '', type: '' });

    try {
      let publicUrl = profile.signature_url;

      if (signatureFile) {
        const fileExt = signatureFile.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('signatures')
          .upload(fileName, signatureFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('signatures')
          .getPublicUrl(fileName);

        publicUrl = data.publicUrl;
      }

      const fullName = `${formData.title} ${formData.firstName} ${formData.lastName ? formData.lastName + ' ' : ''}${formData.surname}`.trim();

      const { error } = await supabase
        .from('profiles')
        .update({
          title: formData.title,
          first_name: formData.firstName,
          last_name: formData.lastName,
          surname: formData.surname,
          full_name: fullName,
          signature_url: publicUrl,
        })
        .eq('id', profile.id);

      if (error) throw error;

      // Update auth metadata to sync with profile
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          title: formData.title,
          first_name: formData.firstName,
          surname: formData.surname,
          last_name: formData.lastName,
          signature_url: publicUrl,
        },
      });

      setMessage({ text: 'Profile updated successfully. Refresh to see changes across the app.', type: 'success' });
      setSignatureFile(null); // Reset file input
    } catch (err) {
      // Supabase errors are plain objects carrying a `message`, not Error
      // instances — read it off either so the real cause reaches the user.
      const text = (err as { message?: string })?.message || 'Failed to update profile.';
      setMessage({ text, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return (
    <>
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.header}>
            <span className={styles.avatar} aria-hidden="true">{initials}</span>
            <div className={styles.identity}>
              <div className={styles.name}>{profile?.full_name || 'Your name'}</div>
              <div className={styles.meta}>
                <Badge tone="accent">{profile?.role || 'Staff'}</Badge>
                <span>{organization?.name}</span>
              </div>
              {profile?.signature_url ? (
                <span className={cx(styles.sigState, styles.sigOn)}>
                  <span aria-hidden="true">✓</span> Digital signature on file
                </span>
              ) : (
                <span className={cx(styles.sigState, styles.sigOff)}>
                  <span aria-hidden="true">⚠</span> No signature uploaded yet
                </span>
              )}
            </div>
          </div>

          <div className={styles.body}>
            {message.text && (
              <Alert tone={message.type === 'success' ? 'success' : 'critical'} live>
                {message.text}
              </Alert>
            )}

            <form onSubmit={handleSave} className={styles.form} noValidate>
              <div className={styles.titleRow}>
                <Field label="Title" required>
                  <Select
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  >
                    <option value="Mr.">Mr.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Dr.">Dr.</option>
                    <option value="Prof.">Prof.</option>
                    <option value="MLS.">MLS.</option>
                    <option value="Pharm.">Pharm.</option>
                  </Select>
                </Field>
                <Field label="Surname" required>
                  <Input
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                    autoComplete="family-name"
                    required
                  />
                </Field>
              </div>

              <div className={styles.pairRow}>
                <Field label="First name" required>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    autoComplete="given-name"
                    required
                  />
                </Field>
                <Field label="Last name">
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    autoComplete="additional-name"
                  />
                </Field>
              </div>

              <div>
                <span className={styles.sectionLabel}>Digital signature</span>
                <div className={styles.dropzone}>
                  {signaturePreview && (
                    <img src={signaturePreview} alt="Your current signature" className={styles.sigPreview} />
                  )}
                  <input
                    id="pf-signature"
                    type="file"
                    accept="image/*"
                    className={cx('sr-only', styles.fileInput)}
                    onChange={handleFileChange}
                  />
                  <label htmlFor="pf-signature" className={styles.sigButton}>
                    <RiUploadCloud2Line size={18} aria-hidden="true" />
                    {signaturePreview ? 'Upload new signature' : 'Upload signature image'}
                  </label>
                  <p className={styles.sigHint}>
                    This signature will be stamped on diagnostic reports you authorise.
                  </p>
                </div>
              </div>

              <div className={styles.actions}>
                <Button type="submit" intent="primary" loading={saving} icon={<RiSave3Line size={18} />}>
                  {saving ? 'Saving…' : 'Save profile'}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <AppearanceSettings />
      </div>
    </>
  );
}

/** Only these roles may open this screen — see components/RequireRole.tsx. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function GuardedUserSettings(props: any) {
  return (
    <RequireRole allow={['admin', 'reception', 'lab', 'lab_tech', 'radiology']}>
      <UserSettings {...props} />
    </RequireRole>
  );
}
