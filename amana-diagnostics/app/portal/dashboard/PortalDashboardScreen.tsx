'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  Alert,
  Button,
  Card,
  CardBody,
  EmptyState,
  Skeleton,
  StatusPill,
} from '@/components/ui';
import { FALLBACK_ORG_NAME } from '@/lib/branding';
import { usePortalSession, type PortalOrg } from '@/lib/portalSession';

import { PortalChrome } from '../PortalChrome';
import styles from './dashboard.module.css';

interface PatientRecord {
  id: string;
  slip_number: string;
  first_name: string;
  surname: string;
  middle_name: string;
  registered_at: string;
}

interface TestRecord {
  id: string;
  patient_id: string;
  test_name: string;
  department: string;
  status: string;
  completed_at: string | null;
}

/** How far along a visit is, in the only three states a patient cares about. */
type VisitState = 'ready' | 'partial' | 'waiting';

const VISIT_STATE: Record<VisitState, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  ready: { label: 'All results ready', tone: 'success' },
  partial: { label: 'Some results ready', tone: 'warning' },
  waiting: { label: 'Still with the lab', tone: 'neutral' },
};

const TEST_STATE: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  completed: { label: 'Ready', tone: 'success' },
  processing: { label: 'Processing', tone: 'warning' },
  pending: { label: 'Not started', tone: 'neutral' },
};

function fullName(p: PatientRecord) {
  return [p.first_name, p.middle_name, p.surname].filter(Boolean).join(' ') || 'Patient';
}

function longDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date unknown';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function PortalDashboardScreen() {
  const router = useRouter();
  const { session, ready, signOut } = usePortalSession();

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [tests, setTests] = useState<Record<string, TestRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openVisit, setOpenVisit] = useState<string | null>(null);

  // Whose portal this is. It used to be one clinic's name and one clinic's
  // logo written into the file; now it comes back with the history.
  const [org, setOrg] = useState<PortalOrg>({
    name: FALLBACK_ORG_NAME,
    email: null,
    phone: null,
  });

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/history', {
        headers: { Authorization: `Bearer ${session.token}` },
      });

      if (res.status === 401) {
        signOut();
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'We could not load your records.');

      setPatients(data.patients || []);
      setTests(data.tests || {});
      if (data.organization?.name) setOrg(data.organization);

      // The most recent visit is the one a patient came for; open it.
      if (data.patients?.[0]) setOpenVisit(data.patients[0].id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [session, signOut]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  function visitState(patientId: string): VisitState {
    const t = tests[patientId] || [];
    if (t.length === 0) return 'waiting';
    if (t.every((x) => x.status === 'completed')) return 'ready';
    if (t.some((x) => x.status === 'completed')) return 'partial';
    return 'waiting';
  }

  const greeting = patients[0]
    ? patients[0].first_name || patients[0].surname
    : (session?.email.split('@')[0] ?? '');

  return (
    <PortalChrome
      org={org}
      actions={
        <Button intent="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      }
    >
      <div className={styles['intro']}>
        <h1 className={styles['heading']}>
          {loading ? 'Your records' : `Welcome back${greeting ? `, ${greeting}` : ''}`}
        </h1>
        <p className={styles['sub']}>
          {loading
            ? 'Looking up the visits linked to your email address…'
            : patients.length === 0
              ? 'Nothing is linked to this email address yet.'
              : `${patients.length} visit${patients.length === 1 ? '' : 's'} on record for ${session?.email}.`}
        </p>
      </div>

      {error && (
        <Alert
          tone="critical"
          live
          title="We could not load your records"
          actions={
            <Button size="sm" onClick={() => void load()}>
              Try again
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading && !error && (
        <div className={styles['visits']} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <Card key={i} as="div">
              <CardBody>
                <Skeleton width="45%" height={18} />
                <div className={styles['skeletonGap']} />
                <Skeleton width="30%" height={14} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && patients.length === 0 && (
        <EmptyState title="No visits found">
          We have no records against <strong>{session?.email}</strong>. If you registered
          with a different address, sign in with that one — otherwise ask the clinic to add
          this address to your file.
        </EmptyState>
      )}

      {!loading && !error && patients.length > 0 && (
        <ul className={styles['visits']}>
          {patients.map((patient) => {
            const visitTests = tests[patient.id] || [];
            const state = VISIT_STATE[visitState(patient.id)];
            const readyCount = visitTests.filter((t) => t.status === 'completed').length;
            const isOpen = openVisit === patient.id;
            const bodyId = `visit-${patient.id}`;

            return (
              <li key={patient.id}>
                <Card as="div" className={styles['visitCard']}>
                  {/* A real button, with aria-expanded. The row this replaces
                    * was a <div onClick>, so a keyboard or screen-reader user
                    * could not open a visit at all. */}
                  <button
                    type="button"
                    className={styles['visitButton']}
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                    onClick={() => setOpenVisit(isOpen ? null : patient.id)}
                  >
                    <span className={styles['visitLead']}>
                      <span className={styles['visitDate']}>{longDate(patient.registered_at)}</span>
                      <span className={styles['visitMeta']}>
                        {fullName(patient)} · Slip #{patient.slip_number} ·{' '}
                        {visitTests.length} test{visitTests.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    <StatusPill label={state.label} tone={state.tone} shape="filled" />
                    <span className={styles['chevron']} aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={isOpen ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
                      </svg>
                    </span>
                  </button>

                  <div id={bodyId} hidden={!isOpen}>
                    <CardBody>
                      <ul className={styles['tests']}>
                        {visitTests.map((t) => {
                          const ts = TEST_STATE[t.status] ?? {
                            label: t.status,
                            tone: 'neutral' as const,
                          };
                          return (
                            <li key={t.id} className={styles['test']}>
                              <span className={styles['testName']}>
                                {t.test_name}
                                <span className={styles['testDept']}>{t.department}</span>
                              </span>
                              <StatusPill label={ts.label} tone={ts.tone} />
                            </li>
                          );
                        })}
                      </ul>

                      {readyCount > 0 ? (
                        <div className={styles['visitAction']}>
                          <Button
                            intent="primary"
                            onClick={() => router.push(`/portal/results/${patient.id}`)}
                          >
                            {readyCount === visitTests.length
                              ? 'View report'
                              : `View ${readyCount} of ${visitTests.length} results`}
                          </Button>
                        </div>
                      ) : (
                        <p className={styles['pendingNote']}>
                          Nothing to read yet. You will get an email as soon as the first
                          result is signed off.
                        </p>
                      )}
                    </CardBody>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </PortalChrome>
  );
}
