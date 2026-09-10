# Interface overhaul — where it stands

Measured against the nine-phase plan. Counts come from `npm run check:ui`, not
from memory.

Last updated: 10 September 2026 (reception migrated).

---

## Phases

| Phase | Scope | State |
| --- | --- | --- |
| P0 | Stop the bleeding | **Done** |
| P1 | Tokens and the styling layer | **Done** |
| P2 | Application shell | **Done** |
| P3 | Component library | **Built. Migration of screens ongoing.** |
| P4 | WCAG 2.1 AA | **Floor in place. Screen-by-screen sweep outstanding.** |
| P5 | Clinical safety | **Done** |
| P6 | Responsive, density, dark | **Shipped for shell and new screens. Legacy screens outstanding.** |
| P7 | Performance | **Started.** Error boundaries and code-splitting done; server components outstanding. |
| P8 | Brand and patient surfaces | **Sign-in done. Portal outstanding.** |

---

## The ratchet

`scripts/ui-budget.json`, current against the day the work started:

| Metric | Start | Now |
| --- | --- | --- |
| Inline `style={{…}}` objects | 2,100 | 1,755 |
| Hard-coded hex colours | 832 | 762 |
| Hard-coded `rgb()`/`rgba()` | 470 | 409 |
| Legacy `--gray-*` / `--teal-*` uses | 1,122 | 904 |
| JS hover handlers | 42 | 34 |
| Inline `outline: 'none'` | 48 | **0** |
| `!important` in components | 23 | 22 |
| Hand-rolled overlays | 18 | 15 |
| Raw `<table>` | 23 | 19 |
| Hard-coded numeric `zIndex` | 46 | 41 |

The large numbers move when screens migrate, which is the bulk of P3 and is the
work that remains. Every one of them can only go down: `npm run check:ui` fails
the build otherwise.

---

## What is done

**The foundations are complete.** Tokens, both themes, three density modes, the
component library, the shell, and three checks running in CI — contrast across
both themes, the ratchet, and axe over every primitive.

**Defects that were live in production are fixed.** The `!important` that was
killing 363 radius declarations. Eleven CSS variables that were referenced and
never defined, one of them 141 times, so those borders did not render at all.
The secondary text colour that sat at 3.67:1 in 111 places. The focus ring that
was removed 48 times and restored 8. The display font that never loaded because
of a two-space typo. Playfair Display, downloaded on every page load and used
nowhere. The missing viewport meta.

**One tenant's name was in eighteen places** across the portal and outgoing
email. Centralised, and the portal now learns the tenant from its own session.
That sweep turned up a leak rather than a cosmetic problem: a clinic with no
admin email on file had its catalogue changes, staff names and workspace link
mailed to a hard-coded third-party gmail address.

**Navigation exists.** One role-filtered rail, breadcrumbs, a patient context
bar and a command palette, replacing a back arrow, an avatar dropdown and a
second dark sidebar that only the admin area had.

**Results are flagged against their own reference range** as they are typed,
with critical values as a separate tier carrying a release interlock. The range
had always been stored next to every parameter and nothing had ever read it.

---

## What is not done

**The screen migration.** Around 1,750 inline style objects remain. Reception is
done; the admin screens and the department entry forms carry most of the rest.
They work, they are theme-aware through the legacy bridge, and they do not yet
use the component library. This is the bulk of the remaining effort.

**Server components.** All 29 routes are still `'use client'`, so every
navigation starts from a blank page and a spinner. This is the single change
that would most improve how fast the product feels, and none of it is done.

**The patient portal.** Still its own style island with its own blue, its own
focus rules and no dark theme. Its tenant name and contact details are correct
now; its logo and accent are not yet threaded through.

**A screen-by-screen accessibility sweep.** The primitives are clean and axe
runs over them in CI, but the legacy screens have not been walked with the mouse
unplugged. Until that happens, the honest claim is "the component library meets
WCAG 2.1 AA", not "the product does".

**Per-workspace critical limits have no UI.** A laboratory can only override the
default panic thresholds in code. That belongs with the test catalogue screen.

**Visual regression snapshots.** Named in the plan as a guardrail; not built.

---

## Next three things

1. **Click through the wallet in the running app.** The extraction it now uses
   was never exercised; the tests assert the wiring, not the round trip to the
   database. Open an account, deposit, log a charge, link and unlink a
   dependant, reverse a transaction, print a statement.
2. **Move the route shells to server components**, starting with the department
   screens, and put content-shaped skeletons behind them.
3. **Rebuild the portal on the system**, with tenant branding threaded through
   to the screen, the print view and the PDF.
