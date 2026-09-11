/**
 * Who the roles are, and how a person's name is read.
 *
 * The staff screen carried all of this inline: five roles with a hex colour
 * and an `rgba()` tint each, and three name helpers defined inside the
 * component so nothing could test them. The colours are gone — a role is now
 * one of the design system's tones, which means it survives a theme change
 * and has been through the contrast check.
 */

import type { Tone } from '@/components/ui';

export interface RoleInfo {
  label: string;
  desc: string;
  tone: Tone;
}

/**
 * The five roles a workspace can hand out, in the order the invite form
 * offers them — least access first, so the destructive choice is not the
 * default and not the easiest to hit.
 */
export const ROLES: Record<string, RoleInfo> = {
  reception: {
    label: 'Receptionist',
    desc: 'Register patients, take payment, print slips and manage the queue.',
    tone: 'info',
  },
  lab: {
    label: 'Lab Scientist',
    desc: 'Process specimens, enter results and sign off laboratory reports.',
    tone: 'success',
  },
  lab_tech: {
    label: 'Lab Technician',
    desc: 'Process specimens and enter results. Cannot sign a report off.',
    tone: 'accent',
  },
  radiology: {
    label: 'Radiologist',
    desc: 'Report on imaging, write findings and impressions, and sign scans off.',
    tone: 'accent',
  },
  admin: {
    label: 'Administrator',
    desc: 'Everything above, plus settings, billing, the catalogue and staff.',
    tone: 'critical',
  },
};

/** In the order the invite form and the row selects should list them. */
export const ROLE_ORDER = ['reception', 'lab', 'lab_tech', 'radiology', 'admin'] as const;

export function roleInfo(role: string | null | undefined): RoleInfo {
  return (
    ROLES[role ?? ''] ?? {
      label: role || 'Unknown',
      desc: 'This role is not one the app knows about.',
      tone: 'neutral' as Tone,
    }
  );
}

/* ========================================================================
 * Names
 * ==================================================================== */

/** Up to two initials for an avatar. 'ST' when there is no name yet. */
export function initialsOf(name: string | null | undefined): string {
  if (!name || !name.trim()) return 'ST';
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * A stable hue for a person, so the same colleague is the same colour on every
 * machine and after every reload.
 *
 * Saturation and lightness are fixed at values that keep white text on top of
 * this above 4.5:1 across the whole hue circle, which is why they are not
 * parameters.
 */
export function avatarHue(name: string | null | undefined): number {
  const n = name ?? '';
  let hash = 0;
  for (let i = 0; i < n.length; i++) {
    hash = n.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 360);
}

export interface NameDetails {
  title: string;
  firstName: string;
  surname: string;
  lastName: string;
}

const TITLES = ['dr.', 'dr', 'prof.', 'prof', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms', 'pharm.', 'pharm'];

/**
 * The parts of someone's name, from the columns if they are filled in and
 * from the single `full_name` string if they are not.
 *
 * Older staff rows only ever had `full_name`, so this has to guess: a leading
 * "Dr." is a title, the last word is the surname, and anything in between is a
 * middle name. It is a guess, and it is shown on the profile panel rather than
 * written back to the database for that reason.
 */
export function parseNameDetails(s: any): NameDetails {
  const none = { title: '—', firstName: '—', surname: '—', lastName: '—' };
  if (!s) return none;

  const title = s.title || '';
  const firstName = s.first_name || '';
  const surname = s.surname || '';
  const lastName = s.last_name || '';

  if (firstName || surname) {
    return {
      title: title || '—',
      firstName: firstName || '—',
      surname: surname || '—',
      lastName: lastName || '—',
    };
  }

  const parts = (s.full_name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return none;

  let parsedTitle = '';
  let index = 0;
  if (TITLES.includes((parts[0] ?? '').toLowerCase())) {
    parsedTitle = parts[0]!;
    index = 1;
  }

  const rest = parts.slice(index);
  let parsedFirst = '';
  let parsedMiddle = '';
  let parsedSurname = '';

  if (rest.length === 1) {
    parsedFirst = rest[0]!;
  } else if (rest.length === 2) {
    parsedFirst = rest[0]!;
    parsedSurname = rest[1]!;
  } else if (rest.length >= 3) {
    parsedFirst = rest[0]!;
    parsedMiddle = rest.slice(1, -1).join(' ');
    parsedSurname = rest[rest.length - 1]!;
  }

  return {
    title: parsedTitle || '—',
    firstName: parsedFirst || '—',
    surname: parsedSurname || '—',
    lastName: parsedMiddle || '—',
  };
}
