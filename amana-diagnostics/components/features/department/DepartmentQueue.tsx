'use client';

import { useEffect, useState } from 'react';
import { RiTestTubeLine, RiRadarLine, RiCheckLine, RiMoreLine, RiTimeLine } from '@remixicon/react';

import type { Department, Patient, PatientTest } from '@/lib/store';
import { patientDisplayName } from '@/lib/store/patientName';
import { Badge, Button, EmptyState } from '@/components/ui';

import styles from './queue.module.css';

interface Props {
  department: Department;
  /** Patients with at least one unfinished test in this department. */
  pending: Patient[];
  /** Patients with a test finished today in this department. */
  completedToday: Patient[];
  /** Counts only tests still `pending`, so it excludes ones already picked up. */
  pendingCount: number;
  loading: boolean;
  onOpenTest: (patient: Patient, test: PatientTest) => void;
}

const fullName = patientDisplayName;

/**
 * How long a patient may wait before the queue says so.
 *
 * Ninety minutes is not a clinical limit — it is the point past which nobody
 * meant for them still to be sitting there, and the bench should be told
 * rather than left to read timestamps.
 */
const LONG_WAIT_MINUTES = 90;

/** How often the waiting times are recalculated. */
const TICK_MS = 30_000;

const minutesWaiting = (iso: string, now: number) =>
  Math.floor((now - new Date(iso).getTime()) / 60000);

function waitLabel(mins: number) {
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * The bench queue: who is waiting, what for, and how long they have been
 * there.
 *
 * Two things were wrong with the waiting time, which is the number this screen
 * exists to show. It was computed during render from `Date.now()` and nothing
 * re-rendered the queue, so it froze at whatever it said when the page loaded
 * — a patient twenty minutes in went on reading "5 min ago" until something
 * else happened to refresh. And nothing sorted the list, so a three-hour wait
 * sat wherever the store happened to put it, quite possibly below someone who
 * walked in a minute ago. A queue in no particular order is not a queue.
 */
export default function DepartmentQueue({
  department, pending, completedToday, pendingCount, loading, onOpenTest,
}: Props) {
  const isLab = department === 'lab';

  // One clock for the whole list, so every card agrees and the times keep up
  // with the wall without the parent having to re-render.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const queue = [...pending].sort(
    (a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime(),
  );

  return (
    <>
      <div className={styles['head']}>
        <h2 className={styles['title']}>Pending {isLab ? 'lab' : 'radiology'} requests</h2>
        <Badge tone="accent">{pendingCount} pending</Badge>
      </div>

      {loading ? (
        <p className={styles['loading']}>Loading queue…</p>
      ) : queue.length === 0 ? (
        <EmptyState
          icon={isLab ? <RiTestTubeLine size={40} /> : <RiRadarLine size={40} />}
          title="No pending requests"
        >
          New patient tests will appear here automatically.
        </EmptyState>
      ) : (
        <ul className={styles['queue']}>
          {queue.map((patient) => {
            const mins = minutesWaiting(patient.registeredAt, now);
            const longWait = mins >= LONG_WAIT_MINUTES;

            return (
              <li
                key={patient.id}
                data-testid="queue-patient"
                className={[styles['card'], longWait ? styles['cardWaiting'] : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className={styles['cardHead']}>
                  <span className={styles['slip']}>{patient.slipNumber}</span>
                  <span className={styles['name']}>{fullName(patient)}</span>
                  <span className={styles['meta']}>
                    {patient.age} • {patient.sex}
                  </span>

                  <span className={styles['waited']}>
                    <RiTimeLine size={12} aria-hidden="true" />
                    {waitLabel(mins)}
                  </span>

                  {/* A long wait said nothing at all before — it was the same
                    * small grey timestamp as every other row, and the bench had
                    * to read and compare them to notice. */}
                  {longWait && (
                    <Badge tone="warning">Waiting over {Math.floor(mins / 60)}h</Badge>
                  )}
                </div>

                <ul className={styles['tests']}>
                  {patient.tests
                    .filter((t) => t.department === department && t.status !== 'completed')
                    .map((test) => {
                      const started = test.status === 'in_progress';

                      return (
                        <li
                          key={test.testId}
                          className={[styles['test'], started ? styles['testStarted'] : '']
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <span className={styles['testName']}>
                            {test.testName}
                            {started && <Badge tone="warning">In progress</Badge>}
                          </span>

                          {/* Named after the test. A column of buttons all
                            * reading "Enter Results" gives a keyboard user no
                            * way to tell which test they are opening. */}
                          <Button
                            intent="primary"
                            size="sm"
                            aria-label={
                              started
                                ? `Continue ${test.testName} for ${fullName(patient)}`
                                : `Enter results for ${test.testName} for ${fullName(patient)}`
                            }
                            icon={started ? <RiMoreLine size={12} /> : undefined}
                            onClick={() => onOpenTest(patient, test)}
                          >
                            {started ? 'Continue' : 'Enter results'}
                          </Button>
                        </li>
                      );
                    })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}

      {completedToday.length > 0 && (
        <section className={styles['done']}>
          <h3 className={styles['doneTitle']}>Completed today ({completedToday.length})</h3>
          <ul className={styles['doneList']}>
            {completedToday.map((p) => (
              <li key={p.id} className={styles['doneRow']}>
                <RiCheckLine size={14} aria-hidden="true" className={styles['doneTick']} />
                <span className={styles['name']}>{fullName(p)}</span>
                <span className={styles['slip']}>{p.slipNumber}</span>
                <span className={styles['doneTests']}>
                  {p.tests
                    .filter((t) => t.department === department && t.status === 'completed')
                    .map((t) => t.testName)
                    .join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
