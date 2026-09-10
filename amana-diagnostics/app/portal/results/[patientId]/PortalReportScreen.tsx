'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import { Alert, Button, EmptyState, LoadingPanel } from '@/components/ui';
import { FALLBACK_ORG_NAME } from '@/lib/branding';
import { usePortalSession, type PortalOrg } from '@/lib/portalSession';

import { PortalChrome } from '../../PortalChrome';
import styles from './report.module.css';

/**
 * One visit's report, as the clinic issues it.
 *
 * The document in the frame is the same HTML the clinic prints at the bench:
 * /api/portal/render builds it with getResultTemplate, which lays the results
 * over the tenant's own letterhead. That is where the branding on this screen
 * comes from — it is the clinic's document, not a portal-styled copy of it, so
 * what the patient reads on screen, prints, and saves as a PDF are the same
 * three things.
 */
export default function PortalReportScreen() {
  const router = useRouter();
  const params = useParams();
  const patientId = params?.['patientId'] as string;
  const { session, ready, signOut } = usePortalSession();

  const frameRef = useRef<HTMLIFrameElement>(null);
  const [org, setOrg] = useState<PortalOrg>({ name: FALLBACK_ORG_NAME, email: null, phone: null });
  const [patient, setPatient] = useState<any>(null);
  const [testCount, setTestCount] = useState(0);
  const [html, setHtml] = useState('');
  const [frameHeight, setFrameHeight] = useState(900);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    const auth = { Authorization: `Bearer ${session.token}` };
    try {
      const res = await fetch(`/api/portal/results/${patientId}`, { headers: auth });
      if (res.status === 401) {
        signOut();
        return;
      }
      if (res.status === 403) {
        throw new Error('This report belongs to a different patient.');
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'We could not load this report.');

      setPatient(json.patient);
      setTestCount((json.tests || []).length);
      if (json.org?.name) {
        setOrg({
          name: json.org.name,
          email: json.org.email ?? null,
          phone: json.org.phone ?? null,
        });
      }

      const htmlRes = await fetch(`/api/portal/render/${patientId}`, { headers: auth });
      if (htmlRes.ok) setHtml(await htmlRes.text());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [patientId, session, signOut]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  /**
   * Grow the frame to fit its document instead of scrolling inside it.
   *
   * The frame used to be a fixed height, so a two-page report had a scrollbar
   * of its own inside a page that also scrolled, and the reader had to find
   * the right one. srcDoc keeps the document same-origin, so its height is
   * readable from here.
   */
  function fitFrame() {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
    if (height > 0) setFrameHeight(height + 8);
  }

  function print() {
    const win = frameRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    } else {
      window.print();
    }
  }

  const patientName =
    [patient?.first_name, patient?.middle_name, patient?.surname].filter(Boolean).join(' ') ||
    'Your report';

  const visitDate = patient?.registered_at
    ? new Date(patient.registered_at).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <PortalChrome
      org={org}
      lead={
        <Button intent="ghost" size="sm" onClick={() => router.push('/portal/dashboard')}>
          ← All visits
        </Button>
      }
      actions={
        html ? (
          <Button intent="primary" size="sm" onClick={print}>
            Print or save as PDF
          </Button>
        ) : undefined
      }
    >
      {loading && <LoadingPanel label="Loading your report…" />}

      {!loading && error && (
        <Alert
          tone="critical"
          live
          title="We could not open this report"
          actions={
            <Button size="sm" onClick={() => router.push('/portal/dashboard')}>
              Back to all visits
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <>
          <div className={styles['intro']}>
            <h1 className={styles['heading']}>{patientName}</h1>
            <p className={styles['meta']}>
              {patient?.slip_number && <>Slip #{patient.slip_number}</>}
              {visitDate && <> · Visited {visitDate}</>}
              {testCount > 0 && (
                <>
                  {' '}
                  · {testCount} result{testCount === 1 ? '' : 's'} ready
                </>
              )}
            </p>
          </div>

          {testCount === 0 ? (
            <EmptyState
              title="Results are not ready yet"
              action={
                <Button onClick={() => router.push('/portal/dashboard')}>
                  Back to all visits
                </Button>
              }
            >
              Your samples are still with the lab. This page will show the report as soon as
              it is signed off, and {org.name} will email you when that happens.
            </EmptyState>
          ) : html ? (
            <>
              <p className={styles['note']}>
                Only signed-off results appear below. Anything still with the lab will be
                added here once it is ready.
              </p>
              <div className={styles['document']}>
                <iframe
                  ref={frameRef}
                  srcDoc={html}
                  title={`Diagnostic report for ${patientName}`}
                  className={styles['frame']}
                  style={{ height: frameHeight }}
                  onLoad={fitFrame}
                />
              </div>
            </>
          ) : (
            <Alert tone="warning" title="The report could not be rendered">
              Your results are ready but the document did not load. Reload the page, or ask{' '}
              {org.name} to email it to you.
            </Alert>
          )}
        </>
      )}
    </PortalChrome>
  );
}
