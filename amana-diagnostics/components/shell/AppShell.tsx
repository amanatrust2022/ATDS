'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  RiHospitalLine, RiTestTubeLine, RiRadarLine, RiDashboardLine, RiGroupLine,
  RiFlaskLine, RiTeamLine, RiBuilding2Line, RiUserHeartLine, RiHomeSmileLine,
  RiPriceTag3Line, RiHandCoinLine, RiUserLine, RiMenuFoldLine, RiMenuUnfoldLine,
  RiLogoutCircleLine, RiSearchLine, RiMoonLine, RiSunLine, RiComputerLine,
} from '@remixicon/react';

import { useAuth } from '@/components/AuthProvider';
import { Button, useAppearance } from '@/components/ui';
import { activeEntry, crumbsFor, navFor, homePathFor } from './navigation';
import type { NavEntry } from './navigation';
import { CommandPalette, useCommandPaletteHotkey } from './CommandPalette';
import { SyncStatus } from './SyncStatus';
import type { Command } from './CommandPalette';
import styles from './Shell.module.css';

/**
 * The application shell: a rail that is always there, a header, and an
 * optional patient context bar.
 *
 * What this replaces: a 64px header with a back arrow and an avatar dropdown.
 * Departments were reachable only from inside that dropdown, and only for
 * admins. Users could not see where they were or what else existed, which is
 * why the app grew tabs inside tabs inside modals.
 */

const NAV_ICONS: Record<string, ReactNode> = {
  reception: <RiHospitalLine size={17} />,
  lab: <RiTestTubeLine size={17} />,
  radiology: <RiRadarLine size={17} />,
  admin: <RiDashboardLine size={17} />,
  patients: <RiGroupLine size={17} />,
  tests: <RiFlaskLine size={17} />,
  staff: <RiTeamLine size={17} />,
  'org-settings': <RiBuilding2Line size={17} />,
  referrals: <RiUserHeartLine size={17} />,
  'referral-doctors': <RiUserHeartLine size={17} />,
  'referral-facilities': <RiHomeSmileLine size={17} />,
  'referral-pricing': <RiPriceTag3Line size={17} />,
  'referral-commissions': <RiHandCoinLine size={17} />,
  profile: <RiUserLine size={17} />,
};

const RAIL_KEY = 'diagnosticos_rail_collapsed';

export interface PatientContext {
  name: string;
  patientId: string;
  /** "34 y · F" — already formatted; the shell does not compute clinical facts. */
  demographics?: string;
  facts?: { label: string; value: ReactNode }[];
  actions?: ReactNode;
  onClear?: () => void;
}

export interface AppShellProps {
  children: ReactNode;
  /** The page's own heading. Usually the active nav entry's label. */
  title?: string;
  subtitle?: string;
  /** Actions for this screen, shown in the header. */
  actions?: ReactNode;
  /** Pinned under the header while a patient is open. */
  patient?: PatientContext | null;
  /** Extra rows for the command palette — patients found by a live search. */
  commands?: Command[];
  onCommandQueryChange?: (query: string) => void;
  commandsLoading?: boolean;
  /** Drops the content padding for screens that manage their own. */
  flush?: boolean;
}

export function AppShell({
  children,
  title,
  subtitle,
  actions,
  patient,
  commands = [],
  onCommandQueryChange,
  commandsLoading,
  flush = false,
}: AppShellProps) {
  const { profile, organization, signOut } = useAuth();
  const { theme, setTheme } = useAppearance();
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(RAIL_KEY) === 'true');
    } catch {
      /* Site data blocked. Expanded is the right default. */
    }
  }, []);

  const toggleRail = () => {
    setCollapsed((was) => {
      const next = !was;
      try {
        localStorage.setItem(RAIL_KEY, String(next));
      } catch {
        /* The choice just will not survive a reload. */
      }
      return next;
    });
  };

  const slug = organization?.slug ?? '';
  const role = profile?.role;
  const entries = useMemo(() => navFor(role), [role]);
  const current = useMemo(
    () => activeEntry(pathname, slug, role),
    [pathname, slug, role],
  );
  const crumbs = useMemo(() => crumbsFor(pathname, slug, role), [pathname, slug, role]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useCommandPaletteHotkey(openPalette);

  /* Navigation and the appearance controls are always in the palette, so
   * every screen is two keystrokes away whatever is on the page. */
  const builtInCommands = useMemo<Command[]>(() => {
    const nav: Command[] = entries.map((entry) => ({
      id: `nav-${entry.id}`,
      label: entry.label,
      meta: entry.group,
      group: 'Go to',
      icon: NAV_ICONS[entry.id],
      href: entry.path(slug),
      ...(entry.keywords ? { keywords: entry.keywords } : {}),
    }));

    const appearance: Command[] = [
      {
        id: 'theme-light',
        label: 'Switch to the light theme',
        group: 'Appearance',
        icon: <RiSunLine size={16} />,
        keywords: ['theme', 'bright', 'day'],
        run: () => setTheme('light'),
      },
      {
        id: 'theme-dark',
        label: 'Switch to the dark theme',
        group: 'Appearance',
        icon: <RiMoonLine size={16} />,
        keywords: ['theme', 'night', 'contrast'],
        run: () => setTheme('dark'),
      },
      {
        id: 'theme-system',
        label: 'Match the system theme',
        group: 'Appearance',
        icon: <RiComputerLine size={16} />,
        keywords: ['theme', 'auto', 'os'],
        run: () => setTheme('system'),
      },
      {
        id: 'sign-out',
        label: 'Sign out',
        group: 'Account',
        icon: <RiLogoutCircleLine size={16} />,
        run: () => void signOut?.(),
      },
    ];

    return [...nav, ...appearance];
  }, [entries, slug, setTheme, signOut]);

  const grouped = useMemo(() => {
    const map = new Map<NavEntry['group'], NavEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.group) ?? [];
      list.push(entry);
      map.set(entry.group, list);
    }
    return map;
  }, [entries]);

  const heading = title ?? current?.label ?? 'Workspace';

  return (
    <div className={styles['shell']}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* --- Rail --- */}
      <nav
        className={[styles['rail'], collapsed ? styles['railCollapsed'] : '']
          .filter(Boolean)
          .join(' ')}
        aria-label="Sections"
      >
        <div className={styles['brand']}>
          <span className={styles['brandMark']} aria-hidden="true">
            <RiTestTubeLine size={16} />
          </span>
          {!collapsed && (
            <span className={styles['brandText']}>
              <span className={styles['brandName']}>
                {organization?.name ?? 'DiagnosticOS'}
              </span>
              <span className={styles['brandMeta']}>
                {role ? role.replace('_', ' ') : 'Signed in'}
              </span>
            </span>
          )}
        </div>

        <div className={styles['nav']}>
          {[...grouped.entries()].map(([group, items]) => (
            <div key={group}>
              {!collapsed && group !== 'Workspace' && (
                <p className={styles['navGroup']}>{group}</p>
              )}
              {items.map((entry) => {
                const href = entry.path(slug);
                const isActive = current?.id === entry.id;
                return (
                  <Link
                    key={entry.id}
                    href={href}
                    className={[
                      styles['navItem'],
                      isActive ? styles['navItemActive'] : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    // Announces which one you are on, rather than leaving it
                    // to the background colour.
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? entry.label : undefined}
                  >
                    <span className={styles['navIcon']} aria-hidden="true">
                      {NAV_ICONS[entry.id]}
                    </span>
                    <span className={styles['navLabel']}>{entry.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className={styles['railFooter']}>
          <button
            type="button"
            className={styles['navItem']}
            onClick={toggleRail}
            aria-label={collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'}
          >
            <span className={styles['navIcon']} aria-hidden="true">
              {collapsed ? <RiMenuUnfoldLine size={17} /> : <RiMenuFoldLine size={17} />}
            </span>
            <span className={styles['navLabel']}>Collapse</span>
          </button>
        </div>
      </nav>

      {/* --- Main column --- */}
      <div className={styles['main']}>
        <header className={styles['header']}>
          <div className={styles['headerTitle']}>
            {crumbs.length > 1 && (
              <nav aria-label="Breadcrumb">
                <ol className={styles['crumbs']}>
                  {crumbs.map((crumb, i) => (
                    <li key={crumb.label} style={{ display: 'contents' }}>
                      {i > 0 && (
                        <span className={styles['crumbSep']} aria-hidden="true">
                          /
                        </span>
                      )}
                      {crumb.href ? (
                        <Link href={crumb.href} className={styles['crumbLink']}>
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className={styles['crumbCurrent']} aria-current="page">
                          {crumb.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <h1 className={styles['headerHeading']}>{heading}</h1>
            {subtitle && <p className={styles['headerSub']}>{subtitle}</p>}
          </div>

          <div className={styles['headerTools']}>
            <button
              type="button"
              className={styles['searchTrigger']}
              onClick={openPalette}
            >
              <RiSearchLine size={15} aria-hidden="true" />
              <span className={styles['searchLabel']}>Search</span>
              <span className={styles['kbd']} aria-hidden="true">
                Ctrl K
              </span>
              <span className="sr-only">Open search and commands</span>
            </button>

            <SyncStatus />

            <Clock />

            {actions}

            <Button
              intent="ghost"
              size="sm"
              aria-label={
                theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'
              }
              icon={theme === 'dark' ? <RiSunLine size={16} /> : <RiMoonLine size={16} />}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            />

            <Button
              intent="ghost"
              size="sm"
              icon={<RiUserLine size={16} />}
              onClick={() => router.push(`/${slug}/settings`)}
              aria-label={`Account: ${profile?.full_name ?? 'my profile'}`}
            />
          </div>
        </header>

        {patient && <PatientBar patient={patient} />}

        <main id="main-content" className={flush ? styles['contentFlush'] : styles['content']}>
          {children}
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        commands={[...commands, ...builtInCommands]}
        {...(onCommandQueryChange ? { onQueryChange: onCommandQueryChange } : {})}
        {...(commandsLoading !== undefined ? { loading: commandsLoading } : {})}
      />
    </div>
  );
}

/**
 * Who this is stays on screen.
 *
 * The old app showed the patient's name at the top of whichever tab you
 * happened to be in and lost it as soon as you moved. Every serious EHR
 * converged on pinning it, because "which patient am I looking at" is the
 * question a mis-filed result answers wrongly.
 */
function PatientBar({ patient }: { patient: PatientContext }) {
  return (
    <div className={styles['patientBar']} aria-label="Patient in context">
      <div className={styles['patientIdentity']}>
        <span className={styles['patientName']}>{patient.name}</span>
        <span className={styles['patientId']}>{patient.patientId}</span>
      </div>

      <div className={styles['patientFacts']}>
        {patient.demographics && (
          <span className={styles['patientFact']}>
            <span className={styles['patientFactValue']}>{patient.demographics}</span>
          </span>
        )}
        {patient.facts?.map((fact) => (
          <span key={fact.label} className={styles['patientFact']}>
            <span className={styles['patientFactLabel']}>{fact.label}</span>
            <span className={styles['patientFactValue']}>{fact.value}</span>
          </span>
        ))}
      </div>

      <div className={styles['patientActions']}>
        {patient.actions}
        {patient.onClear && (
          <Button intent="ghost" size="sm" onClick={patient.onClear}>
            Close patient
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * The old header called `new Date()` once during render, so the clock showed
 * the time the page happened to load and then stayed there for the rest of
 * the shift. It also differed between server and client render.
 */
function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Renders empty on the server and on the first client pass, so the two agree.
  if (!now) return <div className={styles['clock']} aria-hidden="true" />;

  return (
    <div className={styles['clock']}>
      <span className={styles['clockDate']}>
        {now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
      <time
        className={styles['clockTime']}
        dateTime={now.toISOString()}
        suppressHydrationWarning
      >
        {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </time>
    </div>
  );
}

export { homePathFor };
