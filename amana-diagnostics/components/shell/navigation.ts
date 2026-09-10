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
  group: 'Workspace' | 'Administration' | 'Referrals' | 'Account';
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
    label: 'Dashboard',
    path: (s) => `/${s}/admin`,
    roles: ['admin'],
    group: 'Administration',
    exact: true,
    keywords: ['overview', 'revenue', 'performance'],
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
    id: 'tests',
    label: 'Test catalogue',
    path: (s) => `/${s}/admin/tests`,
    roles: ['admin'],
    group: 'Administration',
    keywords: ['investigations', 'panel', 'parameters'],
  },
  {
    id: 'staff',
    label: 'Staff',
    path: (s) => `/${s}/admin/staff`,
    roles: ['admin'],
    group: 'Administration',
    keywords: ['users', 'invite', 'roles', 'permissions'],
  },
  {
    id: 'org-settings',
    label: 'Organisation',
    path: (s) => `/${s}/admin/settings`,
    roles: ['admin'],
    group: 'Administration',
    keywords: ['letterhead', 'branding', 'logo', 'address'],
  },
  {
    id: 'referrals',
    label: 'Overview',
    path: (s) => `/${s}/admin/referrals`,
    roles: ['admin'],
    group: 'Referrals',
    exact: true,
  },
  {
    id: 'referral-doctors',
    label: 'Doctors',
    path: (s) => `/${s}/admin/referrals/doctors`,
    roles: ['admin'],
    group: 'Referrals',
    keywords: ['referring', 'physician'],
  },
  {
    id: 'referral-facilities',
    label: 'Facilities',
    path: (s) => `/${s}/admin/referrals/facilities`,
    roles: ['admin'],
    group: 'Referrals',
    keywords: ['clinic', 'hospital', 'partner'],
  },
  {
    id: 'referral-pricing',
    label: 'Pricing',
    path: (s) => `/${s}/admin/referrals/pricing`,
    roles: ['admin'],
    group: 'Referrals',
    keywords: ['price', 'cost', 'tariff'],
  },
  {
    id: 'referral-commissions',
    label: 'Commissions',
    path: (s) => `/${s}/admin/referrals/commissions`,
    roles: ['admin'],
    group: 'Referrals',
    keywords: ['payout', 'earnings'],
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

  if (entry.group === 'Referrals') {
    trail.push({ label: 'Referrals', href: `/${slug}/admin/referrals` });
  } else if (entry.group === 'Administration' && entry.id !== 'admin') {
    trail.push({ label: 'Administration', href: `/${slug}/admin` });
  }

  trail.push({ label: entry.label });
  return trail;
}

/** Icons are supplied by the rail, which is a client component. */
export type NavIconMap = Record<string, ReactNode>;
