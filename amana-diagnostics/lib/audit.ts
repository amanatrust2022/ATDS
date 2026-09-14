/**
 * The audit log's vocabulary, and the sentences it is read out in.
 *
 * Pure: nothing here touches a database. The repository in
 * lib/repositories/audit.ts stores the rows; this file says what a row is and
 * how to describe one to a person.
 */

export type AuditAction =
  | 'staff.role_changed'
  | 'staff.removed'
  | 'price.changed'
  | 'catalogue.test_added'
  | 'catalogue.test_updated'
  | 'catalogue.test_retired'
  | 'referrer.added'
  | 'referrer.updated'
  | 'referrer.deactivated'
  | 'referrer.reactivated'
  | 'commission.settled'
  | 'commission.reversed'
  | 'settings.saved'
  | 'letterhead.saved';

export type AuditEntityType =
  | 'profile'
  | 'test_price'
  | 'custom_test'
  | 'referring_doctor'
  | 'referring_facility'
  | 'patient'
  | 'organization';

export interface AuditEntry {
  id: string;
  organization_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_label?: string | null;
  /** The fields that changed, as they were. Only those — never the whole row. */
  before?: Record<string, unknown> | null;
  /** The same fields, as they are now. */
  after?: Record<string, unknown> | null;
  reason?: string | null;
  /** Set on an undo: the id of the row this one reverses. */
  reverses_id?: string | null;
  origin: 'hub' | 'cloud';
  created_at: string;
}

export type AuditInput = Omit<AuditEntry, 'id' | 'created_at' | 'origin'>;

/** A new row, stamped now. The origin is decided by whoever stores it. */
export function newAuditEntry(
  input: AuditInput,
  origin: AuditEntry['origin'],
  now: Date = new Date(),
): AuditEntry {
  return {
    ...input,
    id: crypto.randomUUID(),
    origin,
    created_at: now.toISOString(),
  };
}

/**
 * Only what changed. A role change should record {role: 'lab'} → {role:
 * 'admin'}, not two copies of a profile with a signature URL in each.
 */
export function diffOf(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[],
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of keys) {
    if (!same(before[key], after[key])) {
      b[key] = before[key] ?? null;
      a[key] = after[key] ?? null;
    }
  }
  return { before: b, after: a };
}

const same = (x: unknown, y: unknown) =>
  x === y || (x == null && y == null) || JSON.stringify(x) === JSON.stringify(y);

const ACTION_LABEL: Record<AuditAction, string> = {
  'staff.role_changed': 'changed the role of',
  'staff.removed': 'removed',
  'price.changed': 'changed the price of',
  'catalogue.test_added': 'added the investigation',
  'catalogue.test_updated': 'edited the investigation',
  'catalogue.test_retired': 'retired the investigation',
  'referrer.added': 'added the referrer',
  'referrer.updated': 'edited the referrer',
  'referrer.deactivated': 'deactivated the referrer',
  'referrer.reactivated': 'reactivated the referrer',
  'commission.settled': 'settled the commission for',
  'commission.reversed': 'reversed the commission settlement for',
  'settings.saved': 'saved the facility details of',
  'letterhead.saved': 'saved the letterhead of',
};

/** "Amina Bello changed the role of Musa Ibrahim from lab to admin". */
export function describeAudit(e: AuditEntry): string {
  const who = e.actor_name || 'Someone';
  const what = e.entity_label || e.entity_id;
  const verb = ACTION_LABEL[e.action] ?? e.action;
  let sentence = `${who} ${verb} ${what}`;

  const change = describeChange(e);
  if (change) sentence += ` ${change}`;
  if (e.reverses_id) sentence += ' (an undo)';
  if (e.reason) sentence += ` — ${e.reason}`;
  return sentence;
}

function describeChange(e: AuditEntry): string {
  const before = e.before ?? {};
  const after = e.after ?? {};
  const keys = Object.keys(after);
  if (keys.length === 0) return '';

  switch (e.action) {
    case 'staff.role_changed':
      return `from ${String(before['role'] ?? '?')} to ${String(after['role'] ?? '?')}`;
    case 'price.changed': {
      const parts: string[] = [];
      if ('price' in after) parts.push(`₦${fmt(before['price'])} → ₦${fmt(after['price'])}`);
      if ('commission_value' in after || 'commission_type' in after) {
        parts.push(`commission ${rate(before)} → ${rate(after)}`);
      }
      return parts.join(', ');
    }
    case 'commission.settled':
      return typeof after['reference'] === 'string' && after['reference']
        ? `(ref ${after['reference']})`
        : '';
    default: {
      const changed = keys.filter((k) => k in before);
      return changed.length ? `(${changed.join(', ')})` : '';
    }
  }
}

const fmt = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('en-NG') : String(v ?? 0));

const rate = (r: Record<string, unknown>) => {
  const type = r['commission_type'];
  const value = r['commission_value'];
  if (type === 'none') return 'none';
  if (type === 'flat' || type === 'fixed') return `₦${fmt(value)}`;
  return `${fmt(value)}%`;
};
