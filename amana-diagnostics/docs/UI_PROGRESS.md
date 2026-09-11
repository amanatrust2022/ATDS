# Interface overhaul — where it stands

Measured against the nine-phase plan. Counts come from `npm run check:ui`, not
from memory.

Last updated: 11 September 2026, evening (department forms, marketing pages, bench, sign-up, editors and checkout rebuilt). See `docs/HANDOFF.md` for how to continue.

---

## Phases

| Phase | Scope | State |
| --- | --- | --- |
| P0 | Stop the bleeding | **Done** |
| P1 | Tokens and the styling layer | **Done** |
| P2 | Application shell | **Done** |
| P3 | Component library | **Built. 347 inline styles left of 2,100; the remaining screens are listed in `docs/HANDOFF.md`.** |
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
| Inline `style={{…}}` objects | 2,100 | 347 |
| Hard-coded hex colours | 832 | 201 |
| Hard-coded `rgb()`/`rgba()` | 470 | 79 |
| Legacy `--gray-*` / `--teal-*` uses | 1,122 | 145 |
| JS hover handlers | 42 | 12 |
| Inline `outline: 'none'` | 48 | **0** |
| `!important` in components | 23 | 6 |
| Hand-rolled overlays | 18 | 1 |
| Raw `<table>` | 23 | 5 |
| Hard-coded numeric `zIndex` | 46 | 8 |

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

**Every department entry form is on the system** — MPS, Widal, MCS, radiology
(template and scan pickers, obstetric dating), the bench queue, the critical
value dialog and the bench page itself. Along the way: MPS no longer pre-fills a
species; obstetric dating follows the CRL-alone-to-84 mm rule instead of
averaging; the queue sorts by wait and keeps its clock running; Cancel on the
bench asks before discarding typed results; the toast is announced.

**The public face is on one stylesheet.** Landing page and download page share
`app/landing.module.css`; sign-up shares the sign-in stylesheet. Fixed on the
way: a crash for any signed-in user opening the desktop build; no Sign In on a
phone; a hydration mismatch on every load of `/`; a download link built from a
hand-typed version; a claim that the local database is encrypted (it is not);
eight footer links to `#`.

**Both design canvases have named controls.** The report editor and the
letterhead designer each had toolbars with no roles, toggles that showed their
state only as a colour, and (in the editor) a table picker made of `<div
onClick>` that a keyboard could not reach. Their paper stays white on purpose;
their chrome follows the theme.

**Organisation settings, checkout, sign-up.** Every field labelled, every save
result announced, the default letterhead escaped, the wallet shortfall an alert.

---

## What is not done

**The screen migration.** 347 inline style objects remain, in the screens listed
in `docs/HANDOFF.md` — the invite, onboarding, profile and password screens, the
admin overview, and the smaller registration and queue components. The recipe
that has worked for every screen so far is written down there too.

**Two content decisions the owner has not made.** The landing page carries three
named testimonials and a "100+ diagnostic centres" figure whose provenance is
unknown to the code; and Privacy Policy / Terms of Service pages do not exist.
Neither is a code task, but the landing page cannot honestly link to legal
pages until someone writes them.

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

1. **Finish the screen migration** from the queue in `docs/HANDOFF.md`, one
   screen per commit, tests first.
2. **Walk every workspace screen once** with the mouse unplugged, in dark mode,
   at 390px. The primitives are clean; the product has not been walked.
3. **Decide the two content questions above** — testimonials and legal pages —
   and then push. Nine commits sit unpushed at the time of writing.
