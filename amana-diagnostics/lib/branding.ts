/**
 * Every place the product has to name a clinic when it does not know one.
 *
 * These constants are the single source of truth for Redian product branding.
 * One edit here propagates to every portal page, email, and print template
 * instead of hunting through dozens of scattered strings.
 *
 * The portal no longer relies on these. /api/portal/history and
 * /api/portal/results both answer with the organisation, so every screen below
 * the portal's sign-in names the clinic the patient actually attended, and the
 * report carries that clinic's own letterhead. FALLBACK_ORG_NAME is now what
 * it says on the tin — the name for a tenant that genuinely cannot be
 * identified — rather than a stand-in for work not yet done.
 */

/** Shown when the tenant is genuinely unknown. Never a real clinic's name. */
export const FALLBACK_ORG_NAME = 'Your Diagnostic Centre';

/** The software itself, not the clinic running it. */
export const PRODUCT_NAME = 'Redian';

/** `orgName(org)` reads better at the call site than `org?.name || FALLBACK`. */
export const orgName = (org?: { name?: string | null } | null): string =>
  org?.name?.trim() || FALLBACK_ORG_NAME;

/**
 * Where a patient writes when the portal itself is the problem — shown on the
 * sign-in screen, which is the one portal page that runs before we know which
 * clinic the visitor belongs to. Everywhere after sign-in uses the clinic's
 * own address from the organisations table.
 */
export const SUPPORT_EMAIL =
  process.env['NEXT_PUBLIC_SUPPORT_EMAIL'] || 'support@redian.app';
