import { describe, it, expect } from 'vitest';

import { ROLES, ROLE_ORDER, roleInfo, initialsOf, avatarHue, parseNameDetails } from './staffRoles';

describe('roles', () => {
  it('offers the least access first, so admin is never the easy choice', () => {
    expect(ROLE_ORDER[0]).toBe('reception');
    expect(ROLE_ORDER[ROLE_ORDER.length - 1]).toBe('admin');
  });

  it('describes every role it lists', () => {
    for (const role of ROLE_ORDER) {
      expect(ROLES[role]?.label).toBeTruthy();
      expect(ROLES[role]?.desc).toBeTruthy();
    }
  });

  it('does not pretend to know a role it has never heard of', () => {
    const info = roleInfo('phlebotomist');
    expect(info.label).toBe('phlebotomist');
    expect(info.tone).toBe('neutral');
  });

  it('survives a missing role rather than throwing', () => {
    expect(roleInfo(null).tone).toBe('neutral');
    expect(roleInfo(undefined).label).toBe('Unknown');
  });
});

describe('initials', () => {
  it('takes at most two', () => {
    expect(initialsOf('Ada Grace Okoye')).toBe('AG');
    expect(initialsOf('Bala')).toBe('B');
  });

  it('falls back rather than rendering an empty circle', () => {
    expect(initialsOf('')).toBe('ST');
    expect(initialsOf(null)).toBe('ST');
    expect(initialsOf('   ')).toBe('ST');
  });

  it('is not thrown by double spaces in a typed name', () => {
    expect(initialsOf('Ada  Okoye')).toBe('AO');
  });
});

describe('avatar colour', () => {
  it('gives the same person the same hue every time', () => {
    expect(avatarHue('Bala Yusuf')).toBe(avatarHue('Bala Yusuf'));
  });

  it('stays inside the colour wheel, including for an empty name', () => {
    for (const n of ['', 'A', 'Ngozi Ade', 'Дмитрий']) {
      const h = avatarHue(n);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
});

describe('reading a name apart', () => {
  it('prefers the columns when they are filled in', () => {
    expect(parseNameDetails({ title: 'Dr.', first_name: 'Ada', surname: 'Okoye', full_name: 'ignored' }))
      .toMatchObject({ title: 'Dr.', firstName: 'Ada', surname: 'Okoye' });
  });

  it('guesses from a single full name when they are not', () => {
    expect(parseNameDetails({ full_name: 'Dr. Ada Grace Okoye' })).toEqual({
      title: 'Dr.',
      firstName: 'Ada',
      lastName: 'Grace',
      surname: 'Okoye',
    });
  });

  it('handles a name with no title and no middle name', () => {
    expect(parseNameDetails({ full_name: 'Bala Yusuf' })).toMatchObject({
      title: '—',
      firstName: 'Bala',
      surname: 'Yusuf',
    });
  });

  it('does not turn a one-word name into a surname', () => {
    // Staff invited but not yet set up often have only one word on file.
    expect(parseNameDetails({ full_name: 'Ngozi' })).toMatchObject({
      firstName: 'Ngozi',
      surname: '—',
    });
  });

  it('says nothing rather than crashing on an empty or missing row', () => {
    expect(parseNameDetails(null).title).toBe('—');
    expect(parseNameDetails({}).surname).toBe('—');
    expect(parseNameDetails({ full_name: '   ' }).firstName).toBe('—');
  });
});
