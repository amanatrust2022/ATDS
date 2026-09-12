'use client';
import { useEffect, useRef } from 'react';
import type { Patient } from '@/lib/store';
import { patientDisplayName } from '@/lib/store/patientName';
import { playChime, desktopNotify, requestNotificationPermission } from '@/lib/notifications';

/**
 * Announces a result arriving at reception — a chime, a notice, and a
 * desktop notification if the browser allows one.
 *
 * The bench has had this for its side since the start: a new patient in the
 * queue chimes. Reception had nothing. A result that left the lab changed a
 * number on the "Results ready" tab, and a receptionist with a patient in
 * front of them, or on the registration tab, did not see it. "The results
 * never arrived" was often "the results arrived and nobody was told".
 *
 * Mirror of useNewTestAlerts: the first load is the day's backlog and is
 * recorded silently; only a test that *becomes* completed while the desk is
 * open is announced — and only if it was completed just now. Widening the
 * date window from today to thirty days brings a month of finished results
 * into the list at once; none of them is news.
 */

/** How long after completion a result still counts as "just arrived". */
export const RECENT_RESULT_MS = 10 * 60_000;

export function useResultAlerts(
  patients: Patient[],
  loading: boolean,
  announce: (message: string) => void,
) {
  const knownCompletedIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  useEffect(() => { requestNotificationPermission(); }, []);

  useEffect(() => {
    if (loading) return;

    const completed = patients.flatMap(p =>
      (p.tests || [])
        .filter(t => t.status === 'completed' && t.id)
        .map(t => ({
          id: t.id as string,
          patientName: patientDisplayName(p),
          testName: t.testName,
          department: t.department,
          completedAt: t.completedAt,
        }))
    );
    const currentIds = new Set(completed.map(t => t.id));

    if (isInitialLoad.current) {
      knownCompletedIds.current = currentIds;
      isInitialLoad.current = false;
      return;
    }

    const now = Date.now();
    const arrived = completed.filter(t =>
      !knownCompletedIds.current.has(t.id) &&
      (!t.completedAt || now - new Date(t.completedAt).getTime() < RECENT_RESULT_MS),
    );
    knownCompletedIds.current = currentIds;

    if (arrived.length === 0) return;

    playChime();
    arrived.forEach(t => {
      const from = t.department === 'radiology' ? 'Radiology' : 'Lab';
      announce(`Result ready from ${from}: ${t.testName} for ${t.patientName}`);
      desktopNotify('Result ready', `${t.patientName} — ${t.testName} (${from})`);
    });
  }, [patients, loading]);
}
