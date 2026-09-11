# Interface overhaul — where it stands

Measured against the nine-phase plan. Counts come from `npm run check:ui`, not
from memory.

Last updated: 11 September 2026 (the four biggest admin screens rebuilt).

---

## Phases

| Phase | Scope | State |
| --- | --- | --- |
| P0 | Stop the bleeding | **Done** |
| P1 | Tokens and the styling layer | **Done** |
| P2 | Application shell | **Done** |
| P3 | Component library | **Built. The four biggest screens migrated; entry forms remain.** |
| P4 | WCAG 2.1 AA | **Floor in place. Screen-by-screen sweep outstanding.** |
| P5 | Clinical safety | **Done** |
| P6 | Responsive, density, dark | **Shipped for shell and new screens. Legacy screens outstanding.** |
| P7 | Performance | **Started.** Error boundaries, code-splitting, the shell in the layout and server route shells done; server-side *data* outstanding. |
| P8 | Brand and patient surfaces | **Done.** Sign-in, and the portal rebuilt on the system. |

---

## The ratchet

`scripts/ui-budget.json`, current against the day the work started:

| Metric | Start | Now |
| --- | --- | --- |
| Inline `style={{…}}` objects | 2,100 | 1,255 |
| Hard-coded hex colours | 832 | 541 |
| Hard-coded `rgb()`/`rgba()` | 470 | 338 |
| Legacy `--gray-*` / `--teal-*` uses | 1,122 | 527 |
| JS hover handlers | 42 | 30 |
| Inline `outline: 'none'` | 48 | **0** |
| `!important` in components | 23 | 13 |
| Hand-rolled overlays | 18 | 10 |
| Raw `<table>` | 23 | 9 |
| Hard-coded numeric `zIndex` | 46 | 34 |

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

**Navigation exists, and it stays put.** One role-filtered rail, breadcrumbs, a
patient context bar and a command palette, replacing a back arrow, an avatar
dropdown and a second dark sidebar that only the admin area had. It is mounted
once in `app/[slug]/layout.tsx`, so a navigation swaps the panel and nothing
else. It used to be rendered by each screen and rebuilt from scratch on every
move, which is why every navigation blanked the window, restarted the clock and
re-read the rail's collapsed state out of localStorage.

**Every route has a server shell and its own name.** `page.tsx` is a server
component rendering one client screen beside it, and each one exports
`metadata`. Thirty routes used to share a single browser-tab title, which made
the back button and a row of pinned tabs unreadable.

**The patient portal is on the system.** All three screens rebuilt out of the
component library and the token layer, so the portal follows the patient's
theme instead of painting its own navy over it. Every trace of one particular
clinic is gone from it: the header mark is the clinic's own initials, and the
report itself is the clinic's real letterhead, because it is rendered by the
same template the bench prints from. A visit now opens from a button with
`aria-expanded` rather than a `<div onClick>` a keyboard could not reach.

**The four biggest screens are on the system.** Staff (1,699 lines), the
commission report (641), the wallet ledger (890) and the patient database (442)
were the four heaviest files left. Each is now a container plus components on
CSS modules, each has its arithmetic in a tested module rather than inside a
JSX expression, and each had a characterisation test written before it was
touched. Between them that removed nine hand-rolled overlays, four hand-rolled
tab strips and both unescaped CSV exports.

**Results are flagged against their own reference range** as they are typed,
with critical values as a separate tier carrying a release interlock. The range
had always been stored next to every parameter and nothing had ever read it.

---

## What is not done

**The screen migration.** Around 1,255 inline style objects remain. Reception, the
staff screen, the commission report, the wallet ledger and the patient database
are done; the department entry forms and the remaining admin screens carry most
of what is left.
They work, they are theme-aware through the legacy bridge, and they do not yet
use the component library. This is the bulk of the remaining effort.

**Server-side data.** The route shells are server components, but they render a
frame, not content: auth is a Supabase session in the browser, and every screen
still loads its own data from a client effect. Getting the session onto the
server is what unlocks the rest, and none of that is done. The honest claim
today is that the route boundary is server-rendered and each screen is a
separate client island.

**A screen-by-screen accessibility sweep.** The primitives are clean and axe
runs over them in CI, but the legacy screens have not been walked with the mouse
unplugged. Until that happens, the honest claim is "the component library meets
WCAG 2.1 AA", not "the product does".

**Per-workspace critical limits have no UI.** A laboratory can only override the
default panic thresholds in code. That belongs with the test catalogue screen.

**Visual regression snapshots.** Named in the plan as a guardrail; not built.

---

## Next three things

1. **Click through the wallet in the running app.** It now has twelve tests
   over what reaches the database — the deposit arguments, the reversal rules,
   wallet-versus-cash — but nothing has taken a real deposit through it. Open an
   account, deposit, log a charge, link and unlink a dependant, reverse a
   transaction, print a statement.
2. **Walk every workspace screen once**, now that the shell is above them rather
   than inside them. No test would notice a screen that lost its padding, gained
   a second scrollbar, or now sits under a heading it did not choose.
3. **Sit with the portal on a phone**, signed in as a real patient. The screens
   are rebuilt but the round trip — code by email, visit list, report, print —
   has only been exercised by tests and a build.
