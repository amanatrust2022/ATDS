'use client';
import { useEffect, useRef } from 'react';
import type { Department, Patient } from '@/lib/store';

/**
 * Announces tests that appear in this department's queue while someone is
 * watching it — a chime, a toast, and a desktop notification if the browser
 * allows one. The bench is often across the room from the screen.
 */

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    const now = audioCtx.currentTime;
    // Dual tone chime: C5 (523.25 Hz) then E5 (659.25 Hz)
    playTone(523.25, now, 0.15);
    playTone(659.25, now + 0.12, 0.35);
  } catch (err) {
    console.error('AudioContext sound failed:', err);
  }
}

export function useNewTestAlerts(
  patients: Patient[],
  department: Department,
  loading: boolean,
  announce: (message: string) => void,
) {
  const knownPendingTestIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  // Ask once, on mount: a denied prompt still leaves the toast and the chime.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

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
      playNotificationSound();
      newTestDetails.forEach(details => {
        announce(`New patient registered: ${details.patientName} for ${details.testName}`);

        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('New Patient Alert', {
              body: `${details.patientName} - ${details.testName}`,
            });
          } catch (e) {
            console.error('Desktop notification failed:', e);
          }
        }
      });
    }
  }, [patients, loading, department]);
}
