/**
 * Every place the product has to name a clinic when it does not know one.
 *
 * "Amana Trust Diagnostics" was written into eighteen places across the portal
 * pages and the outgoing emails — a single tenant's name hard-coded into a
 * multi-tenant product, so every clinic's patients received another clinic's
 * branding. These constants are the interim fix: one edit instead of eighteen.
 *
 * The real fix is Phase 8. The portal pages below the login screen have no
 * organisation in scope at all — /api/portal/history returns patients and
 * tests but no org — so the tenant's name, logo and accent have to be threaded
 * through the portal session before the fallbacks below can stop being used.
 */

/** Shown when the tenant is genuinely unknown. Never a real clinic's name. */
export const FALLBACK_ORG_NAME = 'Your Diagnostic Centre';

/** The software itself, not the clinic running it. */
export const PRODUCT_NAME = 'DiagnosticOS';

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
  process.env['NEXT_PUBLIC_SUPPORT_EMAIL'] || 'support@diagnosticos.app';
