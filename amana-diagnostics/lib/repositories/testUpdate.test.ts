import { describe, it, expect } from 'vitest';
import { partialTestUpdate } from './testUpdate';

const NOW = '2026-09-07T10:00:00.000Z';

describe('partialTestUpdate', () => {
  /**
   * The one that mattered. Opening a pending test to type its result sends
   * only the status; everything else about the test has to survive it.
   */
  it('opening a test does not erase the specimen it was taken from', () => {
    const { setClause, values, syncPayload } = partialTestUpdate({ status: 'in_progress' }, NOW);

    expect(setClause).toBe('status = ?, updated_at = ?');
    expect(values).toEqual(['in_progress', NOW]);

    expect(setClause).not.toContain('specimen');
    expect(syncPayload).not.toHaveProperty('specimen');
    expect(syncPayload).not.toHaveProperty('results');
    expect(syncPayload).not.toHaveProperty('completed_by');
  });

  it('writes every field a completed result carries', () => {
    const { setClause, values } = partialTestUpdate({
      status: 'completed',
      results: [{ parameter: 'Hb', value: '12' }],
      completedBy: 'Dr Musa',
      completedBySignatureUrl: 'https://example.test/sig.png',
      completedByTitle: 'Consultant',
      completedAt: NOW,
      notes: 'Repeat in a week',
      specimen: 'Whole blood',
    }, NOW);

    expect(setClause).toBe(
      'status = ?, results = ?, completed_by = ?, completed_by_signature_url = ?, ' +
      'completed_by_title = ?, completed_at = ?, notes = ?, specimen = ?, updated_at = ?'
    );
    // Results are stored as text.
    expect(values[1]).toBe(JSON.stringify([{ parameter: 'Hb', value: '12' }]));
    expect(values[values.length - 1]).toBe(NOW);
  });

  it('keeps null, because clearing a note is a thing somebody meant to do', () => {
    const { setClause, values, syncPayload } = partialTestUpdate({ notes: null }, NOW);

    expect(setClause).toBe('notes = ?, updated_at = ?');
    expect(values).toEqual([null, NOW]);
    expect(syncPayload).toEqual({ notes: null, updated_at: NOW });
  });

  it('still stamps the time when nothing else changed', () => {
    const { setClause, values, syncPayload } = partialTestUpdate({}, NOW);

    expect(setClause).toBe('updated_at = ?');
    expect(values).toEqual([NOW]);
    expect(syncPayload).toEqual({ updated_at: NOW });
  });

  it('sends the outbox the domain value, not the serialised one', () => {
    const results = [{ parameter: 'Hb', value: '12' }];
    const { syncPayload } = partialTestUpdate({ status: 'completed', results }, NOW);

    expect(syncPayload.results).toEqual(results);
    expect(syncPayload.status).toBe('completed');
  });
});
