/**
 * Half-typed results, kept on this machine.
 *
 * A technologist who closed the entry form — to check a specimen, to answer
 * reception, because the browser was shut on them — lost everything typed
 * since the form opened. Twenty parameters of a full blood count, a radiology
 * report half-dictated. The form asked "close without saving?" and that was
 * the whole of the protection.
 *
 * A draft is written on every keystroke and read back when the same test is
 * opened again, on this machine, in this browser. It is deleted the moment
 * the result is sent to reception. It lives in localStorage rather than the
 * database on purpose: a draft is not a result, must never appear on a
 * report or in another department's queue, and must survive the hub and the
 * network both being down — which is exactly when it is most likely to be
 * needed.
 *
 * A storage that throws (private window, quota, disabled) costs nothing but
 * the draft: every call here swallows it and the form keeps working.
 */

import type { RadiologyFormState } from '@/lib/radiology-templates';
import type { McsFormState, WidalFormState, MpsFormState } from '@/lib/store/labResults';

export interface ResultDraft {
  results: { parameter: string; result: string; unit: string; range: string; flag: string }[];
  notes: string;
  mcsState: McsFormState | null;
  widalState: WidalFormState | null;
  mpsState: MpsFormState | null;
  radiologyState: RadiologyFormState | null;
  /** ISO. When the draft was last written. */
  savedAt: string;
}

const PREFIX = 'redian:result-draft:';

const keyFor = (organizationId: string, testId: string) => `${PREFIX}${organizationId}:${testId}`;

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The draft for this test, or null if there is none or it cannot be read. */
export function loadDraft(organizationId: string, testId: string): ResultDraft | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(keyFor(organizationId, testId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.results)) return null;
    return parsed as ResultDraft;
  } catch {
    return null;
  }
}

/** Writes the draft. Returns false if it could not be kept (quota, disabled). */
export function saveDraft(
  organizationId: string,
  testId: string,
  draft: Omit<ResultDraft, 'savedAt'>,
): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(keyFor(organizationId, testId), JSON.stringify({ ...draft, savedAt: new Date().toISOString() }));
    return true;
  } catch {
    // A radiology draft carrying scan images can be larger than the browser
    // allows. The result still goes to reception; only the safety copy is lost.
    return false;
  }
}

export function clearDraft(organizationId: string, testId: string): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(keyFor(organizationId, testId));
  } catch {
    /* nothing to clear, or nowhere to clear it from */
  }
}

export function hasDraft(organizationId: string, testId: string): boolean {
  return loadDraft(organizationId, testId) !== null;
}

/** Every test on this machine with a draft, so the queue can say so. */
export function draftTestIds(organizationId: string): Set<string> {
  const ids = new Set<string>();
  const store = storage();
  if (!store) return ids;
  try {
    const prefix = `${PREFIX}${organizationId}:`;
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith(prefix)) ids.add(key.slice(prefix.length));
    }
  } catch {
    /* an unreadable store simply has no drafts */
  }
  return ids;
}
