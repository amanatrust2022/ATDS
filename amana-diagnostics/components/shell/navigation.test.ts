import { describe, it, expect } from 'vitest';

import { NAV, navFor, homePathFor, activeEntry, crumbsFor, entryById } from './navigation';

/**
 * The nav table decides four things that used to be written out separately and
 * drift: what the rail shows, where a role lands after signing in, what the
 * breadcrumb says, and — since the shell moved into app/[slug]/layout.tsx —
 * the heading at the top of every workspace screen and whether that screen
 * gets the content inset.
 *
 * That last pair is why these tests exist. DepartmentPage and ReceptionPage
 * used to pass their own title and their own `flush`; now nothing does, and a
 * wrong or missing entry here would quietly retitle a screen or double its
 * padding with no other test failing.
 */

describe('the table itself', () => {
  it('has a unique id for every entry', () => {
    const ids = NAV.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a label, since the shell reads its heading from here', () => {
    for (const entry of NAV) expect(entry.label.trim()).not.toBe('');
  });
});

describe('what the shell puts at the top of each screen', () => {
  it.each([
    ['/acme/reception', 'Reception'],
    ['/acme/lab', 'Laboratory'],
    ['/acme/radiology', 'Radiology'],
    ['/acme/admin', 'Dashboard'],
    ['/acme/admin/staff', 'Staff'],
    ['/acme/admin/referrals/commissions', 'Commissions'],
    ['/acme/settings', 'My profile'],
  ])('%s is headed "%s"', (path, label) => {
    expect(activeEntry(path, 'acme', 'admin')?.label).toBe(label);
  });

  it('keeps a child route under its parent entry', () => {
    // /admin is exact, so a child must not fall back to the dashboard.
    expect(activeEntry('/acme/admin/patients', 'acme', 'admin')?.id).toBe('patients');
  });
});

describe('which screens run edge to edge', () => {
  it('is set for the three screens that manage their own padding', () => {
    expect(NAV.filter((e) => e.flush).map((e) => e.id).sort()).toEqual([
      'lab',
      'radiology',
      'reception',
    ]);
  });

  it('leaves every admin screen with the shell inset', () => {
    for (const entry of NAV.filter((e) => e.group === 'Administration')) {
      expect(entry.flush).toBeFalsy();
    }
  });
});

describe('roles', () => {
  it('does not show reception the bench, or the bench reception', () => {
    const receptionIds = navFor('reception').map((e) => e.id);
    expect(receptionIds).toContain('reception');
    expect(receptionIds).not.toContain('lab');

    const labIds = navFor('lab').map((e) => e.id);
    expect(labIds).toContain('lab');
    expect(labIds).not.toContain('reception');
  });

  it('lands each role on a screen it can actually open', () => {
    for (const role of ['admin', 'lab', 'lab_tech', 'radiology', 'reception']) {
      const home = homePathFor(role, 'acme');
      const entry = activeEntry(home, 'acme', role);
      expect(entry, `${role} landed on ${home}`).toBeDefined();
      expect(navFor(role).map((e) => e.id)).toContain(entry!.id);
    }
  });
});

describe('breadcrumbs', () => {
  it('puts a referral screen under Referrals', () => {
    expect(crumbsFor('/acme/admin/referrals/doctors', 'acme', 'admin')).toEqual([
      { label: 'Referrals', href: '/acme/admin/referrals' },
      { label: 'Doctors' },
    ]);
  });

  it('does not put the dashboard under itself', () => {
    expect(crumbsFor('/acme/admin', 'acme', 'admin')).toEqual([{ label: 'Dashboard' }]);
  });
});

describe('entryById', () => {
  it('finds an entry, and says nothing for one that does not exist', () => {
    expect(entryById('lab')?.label).toBe('Laboratory');
    expect(entryById('nope')).toBeUndefined();
  });
});
