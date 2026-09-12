'use client';
import { useEffect, useRef } from 'react';
import type { Department, Patient } from '@/lib/store';
import { playChime, desktopNotify, requestNotificationPermission } from '@/lib/notifications';

/**
 * Announces tests that appear in this department's queue while someone is
 * watching it — a chime, a toast, and a desktop notification if the browser
 * allows one. The bench is often across the room from the screen.
 */
export function useNewTestAlerts(
  patients: Patient[],
  department: Department,
  loading: boolean,
  announce: (message: string) => void,
) {
  const knownPendingTestIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Ask once, on mount: a denied prompt still leaves the toast and the chime.
  useEffect(() => { requestNotificationPermission(); }, []);

  useEffect(() => {
    if (loading) return;

    const currentPendingTests = patients.flatMap(p =>
      (p.tests || [])
        .filter(t => t.department === department && t.status === 'pending')
        .map(t => ({ patientName: p.name, testName: t.testName, id: t.id }))
    );

    const currentPendingIds = new Set(currentPendingTests.map(t => t.id).filter(Boolean) as string[]);

    // The first load is the existing backlog, not an arrival — record it silently.
    if (isInitialLoad.current) {
      knownPendingTestIds.current = currentPendingIds;
      isInitialLoad.current = false;
      return;
    }

    let hasNew = false;
    const newTestDetails: { patientName: string; testName: string }[] = [];

    currentPendingTests.forEach(t => {
      if (t.id && !knownPendingTestIds.current.has(t.id)) {
        hasNew = true;
        newTestDetails.push({ patientName: t.patientName, testName: t.testName });
        knownPendingTestIds.current.add(t.id);
      }
    });

    // Forget the ones that have been picked up, so they can announce again if
    // they are ever sent back to pending.
    knownPendingTestIds.current.forEach(id => {
      if (!currentPendingIds.has(id)) {
        knownPendingTestIds.current.delete(id);
      }
    });

    if (hasNew) {
      playChime();
      newTestDetails.forEach(details => {
        announce(`New patient registered: ${details.patientName} for ${details.testName}`);
        desktopNotify('New Patient Alert', `${details.patientName} - ${details.testName}`);
      });
    }
  }, [patients, loading, department]);
}
