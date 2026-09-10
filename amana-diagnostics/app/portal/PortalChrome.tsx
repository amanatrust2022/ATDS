'use client';

import type { ReactNode } from 'react';

import type { PortalOrg } from '@/lib/portalSession';

import styles from './PortalChrome.module.css';

/**
 * The frame every signed-in portal page sits in.
 *
 * Each of the three portal screens used to draw its own header and footer, and
 * each of them put `<AmanaLogo>` in it — one tenant's shield, hard-coded into
 * a multi-tenant product, so every clinic's patients were shown another
 * clinic's mark. There is no logo column on `organizations` to replace it
 * with, so the mark here is the clinic's own initials in the accent colour.
 * That is honest about what is known, and it is right for every tenant.
 */

/** Up to two initials, so "Amana Trust Diagnostics" reads as AT, not ATD. */
export function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w))
    .slice(0, 2);
  if (words.length === 0) return '·';
  return words.map((w) => w[0]!.toUpperCase()).join('');
}

export function PortalMark({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={[styles['mark'], size === 'sm' ? styles['markSm'] : ''].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}

export function PortalChrome({
  org,
  actions,
  children,
  /** A back link or breadcrumb shown at the start of the header row. */
  lead,
}: {
  org: PortalOrg;
  actions?: ReactNode;
  children: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <div className={styles['page']}>
      <header className={styles['header']}>
        <div className={styles['headerInner']}>
          {lead}
          <div className={styles['brand']}>
            <PortalMark name={org.name} />
            <span className={styles['brandText']}>
              <span className={styles['orgName']}>{org.name}</span>
              <span className={styles['eyebrow']}>Patient portal</span>
            </span>
          </div>
          {actions && <div className={styles['actions']}>{actions}</div>}
        </div>
      </header>

      <main className={styles['main']}>{children}</main>

      <footer className={styles['footer']}>
        <p>
          &copy; {new Date().getFullYear()} {org.name}
        </p>
        {(org.email || org.phone) && (
          <p className={styles['contact']}>
            Questions about a result?{' '}
            {org.email && (
              <a className={styles['link']} href={`mailto:${org.email}`}>
                {org.email}
              </a>
            )}
            {org.email && org.phone && <span aria-hidden="true"> · </span>}
            {org.phone && (
              <a className={styles['link']} href={`tel:${org.phone.replace(/\s+/g, '')}`}>
                {org.phone}
              </a>
            )}
          </p>
        )}
        <p className={styles['disclaimer']}>
          This portal shows your own diagnostic records. It is not a substitute for advice
          from a qualified physician.
        </p>
      </footer>
    </div>
  );
}
