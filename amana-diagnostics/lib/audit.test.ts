import { describe, expect, it } from 'vitest';

import { describeAudit, diffOf, newAuditEntry, type AuditEntry } from './audit';

const NOW = new Date('2026-09-14T09:00:00.000Z');

const base: AuditEntry = {
  id: 'a1',
  organization_id: 'org',
  actor_id: 'u1',
  actor_name: 'Amina Bello',
  action: 'staff.role_changed',
  entity_type: 'profile',
  entity_id: 'u2',
  entity_label: 'Musa Ibrahim',
  before: { role: 'lab' },
  after: { role: 'admin' },
  origin: 'cloud',
  created_at: NOW.toISOString(),
};

describe('newAuditEntry', () => {
  it('stamps the row with an id, the origin and the given time', () => {
    const { id: _id, created_at: _c, origin: _o, ...input } = base;
    const row = newAuditEntry(input, 'hub', NOW);
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.origin).toBe('hub');
    expect(row.created_at).toBe('2026-09-14T09:00:00.000Z');
    expect(row.action).toBe('staff.role_changed');
  });
});

describe('diffOf', () => {
  it('keeps only the keys that changed', () => {
    const d = diffOf(
      { name: 'A', phone: '1', signature_url: 'x' },
      { name: 'A', phone: '2', signature_url: 'x' },
      ['name', 'phone', 'signature_url'],
    );
    expect(d).toEqual({ before: { phone: '1' }, after: { phone: '2' } });
  });

  it('treats a missing key and null as the same thing', () => {
    const d = diffOf({}, { email: null }, ['email']);
    expect(d).toEqual({ before: {}, after: {} });
  });

  it('records a key that appeared', () => {
    const d = diffOf({}, { email: 'a@b.c' }, ['email']);
    expect(d).toEqual({ before: { email: null }, after: { email: 'a@b.c' } });
  });
});

describe('describeAudit', () => {
  it('reads a role change as a sentence', () => {
    expect(describeAudit(base)).toBe('Amina Bello changed the role of Musa Ibrahim from lab to admin');
  });

  it('reads a price change with the money', () => {
    expect(
      describeAudit({
        ...base,
        action: 'price.changed',
        entity_type: 'test_price',
        entity_label: 'Full blood count',
        before: { price: 3000, commission_type: 'percentage', commission_value: 10 },
        after: { price: 3500, commission_type: 'flat', commission_value: 200 },
      }),
    ).toBe('Amina Bello changed the price of Full blood count ₦3,000 → ₦3,500, commission 10% → ₦200');
  });

  it('says when a row is an undo, and why', () => {
    expect(
      describeAudit({
        ...base,
        action: 'commission.reversed',
        entity_type: 'patient',
        entity_label: 'RD-0042',
        before: null,
        after: null,
        reverses_id: 'a0',
        reason: 'paid the wrong doctor',
      }),
    ).toBe('Amina Bello reversed the commission settlement for RD-0042 (an undo) — paid the wrong doctor');
  });

  it('falls back to the id and "Someone" when names are missing', () => {
    expect(
      describeAudit({ ...base, actor_name: null, entity_label: null, before: null, after: null }),
    ).toBe('Someone changed the role of u2');
  });
});
