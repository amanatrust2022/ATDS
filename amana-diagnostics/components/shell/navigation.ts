import type { ReactNode } from 'react';

/**
 * What each role can reach, in one place.
 *
 * Before this, navigation was a back arrow plus an avatar dropdown, and the
 * dropdown's contents were assembled inline inside Header.tsx with the role
 * checks written out by hand three separate times — once for the rail, once
 * for the redirect after login, once for the "back" button's target. They
 * could drift, and did.
 */

export type Role = 'admin' | 'lab' | 'lab_tech' | 'radiology' | 'reception';

export interface NavEntry {
  /** Stable id, also used as the React key and the palette's match key. */
  id: string;
  label: string;
  /** Built from the org slug at render time. */
  path: (slug: string) => string;
  /** Which roles see it. Empty means everyone signed in. */
  roles: Role[];
  /** The heading this sits under in the rail. */
  group: 'Workspace' | 'Administration' | 'Account';
  /** Matches child routes too — /admin/staff is still "Staff". */
  exact?: boolean;
  /** Words the command palette should also match on. */
  keywords?: string[];
  /**
   * The screen manages its own padding, so the shell drops the content inset.
   *
   * This lives here rather than as a prop because it is a fact about the route,
   * not about a render: the department benches and the reception desk have
   * always run their toolbars edge to edge. With the shell in the layout there
   * is no call site left to pass it from.
   */
  flush?: boolean;
}

export const NAV: NavEntry[] = [
  {
    id: 'reception',
    label: 'Reception',
    path: (s) => `/${s}/reception`,
    roles: ['admin', 'reception'],
    group: 'Workspace',
    keywords: ['register', 'patient', 'queue', 'payment', 'wallet', 'front desk'],
    flush: true,
  },
  {
    id: 'lab',
    label: 'Laboratory',
    path: (s) => `/${s}/lab`,
    roles: ['admin', 'lab', 'lab_tech'],
    group: 'Workspace',
    keywords: ['results', 'bench', 'specimen', 'culture', 'widal'],
    flush: true,
  },
  {
    id: 'radiology',
    label: 'Radiology',
    path: (s) => `/${s}/radiology`,
    roles: ['admin', 'radiology'],
    group: 'Workspace',
    keywords: ['scan', 'ultrasound', 'x-ray', 'imaging', 'report'],
    flush: true,
  },
  {
    id: 'admin',
    label: 'Today',
    path: (s) => `/${s}/admin`,
    roles: ['admin'],
    group: 'Administration',
    exact: true,
    keywords: ['dashboard', 'overview', 'revenue', 'waiting', 'exceptions', 'home'],
  },
  {
    id: 'reports',
    label: 'Reports',
    path: (s) => `/${s}/admin/reports`,
    roles: ['admin'],
    group: 'Administration',
    keywords: ['performance', 'staff', 'revenue', 'turnaround', 'commission', 'ageing', 'audit'],
  },
  {
    id: 'patients',
    label: 'Patients',
    path: (s) => `/${s}/admin/patients`,
    roles: ['admin'],
    group: 'Administration',
    keywords: ['records', 'history', 'search'],
  },
  {
    id: 'staff',
    label: 'People',
    path: (s) => `/${s}/admin/staff`,
    roles: ['admin'],
    group: 'Administration',
    keywords: ['staff', 'users', 'invite', 'roles', 'permissions', 'team'],
  },
  {
    id: 'tests',
    label: 'Catalogue',
    path: (s) => `/${s}/admin/tests`,
    roles: ['admin'],
    group: 'Administration',
    keywords: ['investigations', 'tests', 'panel', 'parameters', 'price', 'pricing', 'tariff', 'cost'],
  },
  {
    id: 'referrals',
    label: 'Referrers',
    path: (s) => `/${s}/admin/referrals`,
    roles: ['admin'],
    group: 'Administration',
    keywords: ['referring', 'doctors', 'facilities', 'clinic', 'hospital', 'partner', 'physician'],
  },
  {
    id: 'referral-commissions',
    label: 'Payouts',
    path: (s) => `/${s}/admin/referrals/commissions`,
    roles: ['admin'],
    group: 'Administration',
    keywords: ['commissions', 'payout', 'earnings', 'owed', 'settle'],
  },
  {
    id: 'org-settings',
    label: 'Settings',
    path: (s) => `/${s}/admin/settings`,
    roles: ['admin'],
    group: 'Administration',
    keywords: ['organisation', 'letterhead', 'branding', 'logo', 'address', 'facility'],
  },
  {
    id: 'audit',
    label: 'Audit log',
    path: (s) => `/${s}/admin/audit`,
    roles: ['admin'],
    group: 'Administration',
    keywords: ['history', 'who changed', 'log', 'undo'],
  },
  {
    id: 'profile',
    label: 'My profile',
    path: (s) => `/${s}/settings`,
    roles: [],
    group: 'Account',
    keywords: ['password', 'name', 'appearance', 'theme', 'density'],
  },
];

/** One entry by id, for callers that already know which screen they are on. */
export function entryById(id: string): NavEntry | undefined {
  return NAV.find((entry) => entry.id === id);
}

/** The entries this role may see, in rail order. */
export function navFor(role: string | undefined): NavEntry[] {
  return NAV.filter(
    (entry) => entry.roles.length === 0 || entry.roles.includes(role as Role),
  );
}

/**
 * Where a role lands after signing in.
 *
 * Derived from NAV rather than written out again, so a role added to the table
 * above cannot end up with a home screen it has no entry for.
 */
export function homePathFor(role: string | undefined, slug: string): string {
  const first = navFor(role).find((entry) => entry.group === 'Workspace');
  const fallback = navFor(role).find((entry) => entry.group === 'Administration');
  return (first ?? fallback)?.path(slug) ?? `/${slug}/reception`;
}

/** Which entry a pathname is inside. Longest match wins, so a child route
 * highlights its parent rather than nothing. */
export function activeEntry(
  pathname: string,
  slug: string,
  role: string | undefined,
): NavEntry | undefined {
  const candidates = navFor(role)
    .map((entry) => ({ entry, path: entry.path(slug) }))
    .filter(({ entry, path }) =>
      entry.exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`),
    )
    .sort((a, b) => b.path.length - a.path.length);

  return candidates[0]?.entry;
}

/** Trail from the workspace root to here, for the breadcrumb. */
export function crumbsFor(
  pathname: string,
  slug: string,
  role: string | undefined,
): { label: string; href?: string }[] {
  const entry = activeEntry(pathname, slug, role);
  if (!entry) return [];

  const trail: { label: string; href?: string }[] = [];

  if (entry.group === 'Administration' && entry.id !== 'admin') {
    trail.push({ label: 'Administration', href: `/${slug}/admin` });
  }

  trail.push({ label: entry.label });
  return trail;
}

/** Icons are supplied by the rail, which is a client component. */
export type NavIconMap = Record<string, ReactNode>;
