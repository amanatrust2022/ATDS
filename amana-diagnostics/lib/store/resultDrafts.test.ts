import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadDraft, saveDraft, clearDraft, hasDraft, draftTestIds } from './resultDrafts';

const blank = {
  results: [{ parameter: 'HGB', result: '12.5', unit: 'g/dL', range: '11-16', flag: '' }],
  notes: 'haemolysed',
  mcsState: null,
  widalState: null,
  mpsState: null,
  radiologyState: null,
};

describe('Result drafts', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('keeps what was typed, per organisation and test, and stamps when', () => {
    expect(saveDraft('org-1', 'pt-1', blank)).toBe(true);

    const back = loadDraft('org-1', 'pt-1');
    expect(back?.results[0]?.result).toBe('12.5');
    expect(back?.notes).toBe('haemolysed');
    expect(back?.savedAt).toMatch(/^\d{4}-/);

    expect(loadDraft('org-2', 'pt-1')).toBeNull();
    expect(loadDraft('org-1', 'pt-2')).toBeNull();
  });

  it('is gone once cleared — the moment a result is sent', () => {
    saveDraft('org-1', 'pt-1', blank);
    expect(hasDraft('org-1', 'pt-1')).toBe(true);

    clearDraft('org-1', 'pt-1');
    expect(hasDraft('org-1', 'pt-1')).toBe(false);
  });

  it('lists the tests on this machine that have a draft', () => {
    saveDraft('org-1', 'pt-1', blank);
    saveDraft('org-1', 'pt-2', blank);
    saveDraft('org-2', 'pt-3', blank);
    localStorage.setItem('amana_local_mode', 'true');

    expect(draftTestIds('org-1')).toEqual(new Set(['pt-1', 'pt-2']));
  });

  it('treats a corrupt draft as no draft', () => {
    localStorage.setItem('redian:result-draft:org-1:pt-1', '{not json');
    expect(loadDraft('org-1', 'pt-1')).toBeNull();

    localStorage.setItem('redian:result-draft:org-1:pt-1', '{"notes":"x"}');
    expect(loadDraft('org-1', 'pt-1')).toBeNull();
  });

  // A radiology draft with scan images can exceed what the browser allows.
  // The result still goes to reception; only the safety copy is lost.
  it('reports, rather than throws, when the browser refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(saveDraft('org-1', 'pt-1', blank)).toBe(false);
  });
});
