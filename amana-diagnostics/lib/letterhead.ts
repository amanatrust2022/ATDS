import { FALLBACK_ORG_NAME } from './branding';

/**
 * The clinic's own details, as they go on a printed document.
 *
 * Every print template worked these out for itself, and every one of them
 * defaulted the second line, the address and the phone number to one real
 * clinic's details:
 *
 *   org?.address || 'No 15, C Tudun Wada Bus Stop, Nasarawa LGA, Kano State.'
 *   org?.phone   || 'Tel: 08033390574, 07032663898'
 *
 * That was written when there was one clinic. There are now many, and a tenant
 * that had not filled its address in printed a different clinic's address and
 * telephone number on its own slips, receipts, statements and result reports —
 * documents patients keep, and ring the number on. Five copies of it, and the
 * on-screen preview had none, so nobody looking at the screen could see it.
 *
 * A field nobody has filled in prints as nothing. Empty is honest; another
 * clinic's address is not.
 */
export type OrgLetterhead = {
  name: string;
  letterhead_line2?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type Letterhead = {
  /** Always set — falls back to the product's neutral placeholder. */
  name: string;
  /** Blank unless the clinic set one. Never invented. */
  line2: string;
  address: string;
  phone: string;
  email: string;
};

const clean = (v: string | null | undefined) => (v ?? '').trim();

export function letterheadFor(org?: OrgLetterhead | null): Letterhead {
  return {
    name: clean(org?.name) || FALLBACK_ORG_NAME,
    line2: clean(org?.letterhead_line2),
    address: clean(org?.address),
    phone: clean(org?.phone),
    email: clean(org?.email),
  };
}

/** The address as HTML, keeping the line breaks the clinic typed. */
export const addressHtml = (address: string) =>
  address.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');

/** The address as lines, for JSX that has to render the same thing. */
export const addressLines = (address: string) =>
  address.split('\n').map((l) => l.trim()).filter(Boolean);
