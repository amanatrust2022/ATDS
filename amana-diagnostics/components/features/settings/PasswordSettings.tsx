'use client';

import { useState } from 'react';
import { RiLockPasswordLine, RiMailSendLine } from '@remixicon/react';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase';
import { sendPasswordReset } from '@/lib/passwordReset';
import { getRuntimeMode } from '@/lib/runtimeMode';
import { useSyncState, connectivityOf } from '@/lib/sync/useSyncState';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input } from '@/components/ui';

import styles from './passwordSettings.module.css';

/** Supabase's floor is six; a clinic's password guards patient records. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Changing, or resetting, the password of the person signed in.
 *
 * Passwords live in the cloud's auth service and nowhere else, so this is
 * one of the few things a hub screen has to reach the cloud for. It says so
 * honestly: on a hub that is offline the form is disabled with the reason,
 * rather than failing after the fact. The hub keeps a cached copy of the
 * password for signing in without internet (local_auth); a successful
 * change refreshes that copy, or the next offline sign-in would still want
 * the old one.
 *
 * The current password is asked for and checked — by signing in with it —
 * before anything changes. A session left open on a shared bench must not
 * be enough to lock its owner out.
 */
export function PasswordSettings() {
  const { user, organization, session } = useAuth();
  const supabase = createClient();
  const onHub = getRuntimeMode() === 'local';
  const syncState = useSyncState(organization?.id, session?.access_token);
  const connectivity = connectivityOf(syncState);
  const hubOffline = onHub && connectivity === 'offline';

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'critical' } | null>(null);

  const email = user?.email ?? '';

  const problem = (): string | null => {
    if (!email) return 'Your account has no email address to check against.';
    if (!current) return 'Enter your current password first.';
    if (next.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (next === current) return 'The new password is the same as the current one.';
    if (next !== confirm) return 'The two copies of the new password do not match.';
    return null;
  };

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const why = problem();
    if (why) { setMessage({ text: why, tone: 'critical' }); return; }

    setSaving(true);
    try {
      // Prove it is you, first.
      const check = await supabase.auth.signInWithPassword({ email, password: current });
      if (check.error) {
        setMessage({
          text: isNetworkError(check.error) ? NO_CLOUD : 'The current password is not right.',
          tone: 'critical',
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        setMessage({ text: isNetworkError(error) ? NO_CLOUD : error.message, tone: 'critical' });
        return;
      }

      // The hub signs people in from its own copy when the internet is down;
      // it has to learn the new password or that sign-in would want the old one.
      if (onHub && user?.id) {
        try {
          await fetch('/api/auth/save-credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: next, userId: user.id }),
          });
        } catch {
          // The cloud has the new password; the hub learns it on the next online sign-in.
        }
      }

      setCurrent(''); setNext(''); setConfirm('');
      setMessage({ text: 'Password changed. Use the new one from your next sign-in.', tone: 'success' });
    } catch (err: any) {
      setMessage({ text: isNetworkError(err) ? NO_CLOUD : err?.message || 'The password could not be changed.', tone: 'critical' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setMessage(null);
    if (!email) { setMessage({ text: 'Your account has no email address to send to.', tone: 'critical' }); return; }
    setSendingReset(true);
    try {
      const { error } = await sendPasswordReset(email);
      if (error) {
        setMessage({ text: isNetworkError(error) ? NO_CLOUD : error.message, tone: 'critical' });
        return;
      }
      setMessage({ text: `A reset link is on its way to ${email}. It opens on the web, and works on any device.`, tone: 'success' });
    } catch (err: any) {
      setMessage({ text: isNetworkError(err) ? NO_CLOUD : err?.message || 'The reset email could not be sent.', tone: 'critical' });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Password"
        subtitle="Kept by the cloud, so changing it needs an internet connection."
      />
      <CardBody>
        {hubOffline && (
          <Alert tone="warning" title="The hub is offline">
            Your password lives in the cloud, and the hub cannot reach it right now.
            Everything else keeps working; come back to this when the connection returns.
          </Alert>
        )}

        {message && (
          <Alert tone={message.tone} live>
            {message.text}
          </Alert>
        )}

        <form onSubmit={handleChange} className={styles.form} noValidate>
          <fieldset className={styles.fields} disabled={hubOffline || saving}>
            <Field label="Current password" required>
              <Input
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <div className={styles.pair}>
              <Field label="New password" required hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </Field>
              <Field label="New password again" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          <div className={styles.actions}>
            <Button
              type="submit"
              intent="primary"
              loading={saving}
              disabled={hubOffline}
              icon={<RiLockPasswordLine size={16} />}
            >
              {saving ? 'Changing…' : 'Change password'}
            </Button>
            <Button
              type="button"
              intent="ghost"
              loading={sendingReset}
              disabled={hubOffline}
              icon={<RiMailSendLine size={16} />}
              onClick={handleReset}
            >
              Forgotten it? Email me a reset link
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

const NO_CLOUD = 'The cloud could not be reached. Check the internet connection and try again.';

function isNetworkError(err: unknown): boolean {
  const message = (err as { message?: string })?.message ?? '';
  const status = (err as { status?: number })?.status;
  return status === 0 || /fetch|network|failed to|timed out|ECONNREFUSED|ENOTFOUND/i.test(message);
}
