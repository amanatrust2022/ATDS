# Interface decisions

A log of the choices made during the interface overhaul, and why. Each entry
records what was decided, what it rules out, and what would have to be true to
revisit it. Newest last.

---

## 1. Replace the styling layer rather than restyle the screens

**Decision.** Build a token system and a component library, then move screens
onto it, instead of improving screens where they stand.

**Why.** There was nothing to improve on top of. Measured across `app/` and
`components/`: 2,100 inline `style={{…}}` objects against 94 `className` uses,
one 164-line stylesheet, no CSS framework, 192 hand-typed hex colours, 183
`rgba()` literals, 80 font sizes, 199 padding values. Every screen re-invented
its own buttons, tabs, tables and modals. Restyling screen by screen would have
cost more than building the system once, and the second screen would already
have drifted from the first.

**Rules out.** A visual refresh that leaves the styling mechanism alone.

**Revisit if.** Never, in this form. The equivalent future question is when to
delete the legacy bridge (see 5).

---

## 2. CSS custom properties + CSS Modules, not Tailwind

**Decision.** Tokens as CSS custom properties; component styling in CSS Modules.

**Why.** Three things mattered: it had to coexist with 2,100 existing inline
styles during a migration measured in months, it had to add no runtime, and it
had to be native to Next so the build stays simple for a product that also ships
as a portable desktop bundle. CSS Modules meet all three. Tailwind is a
reasonable alternative in the abstract, but adopting it mid-flight means every
migrated screen is rewritten twice — once off inline styles, once into utility
classes — and the two systems fight for the same declarations in the interim.

**Rules out.** Utility-class styling; CSS-in-JS with a runtime.

**Revisit if.** The team grows past the point where a shared CSS vocabulary is
being kept in people's heads, and Tailwind's constraint becomes worth the
migration. The token layer would survive that move unchanged.

---

## 3. Radix UI for the accessible primitives

**Decision.** Dialog, tabs, popover, tooltip, menu, checkbox, switch and radio
group come from Radix. The product supplies the visual layer only.

**Why.** The single highest-leverage decision available. The app had 18
hand-rolled `position: fixed` overlays, none of which trapped focus, closed on
`Escape`, locked body scroll, restored focus to the trigger, or marked the page
behind them inert — a keyboard user could tab out of a modal into the page it
was covering. It had four hand-rolled tab strips with no `role="tablist"` and no
arrow-key movement. These are solved problems; solving them again would take
weeks and still be worse. Buying them structurally also means accessibility
cannot be quietly dropped under deadline, which is what usually happens to it.

**Rules out.** Hand-writing focus management. Reviewing ARIA by hand at each
call site.

**Revisit if.** Radix stops being maintained. Base UI and Ark are the
equivalents; the visual layer would port with modest changes.

**Exception.** `Select` is the native element, not Radix Select. On a clinic
tablet the OS picker is faster, more familiar, and works with no JavaScript.
Radix Select is worth it only where the list needs search or free text — that
will be a separate `Combobox`.

---

## 4. Semantic tokens are the only layer components may use

**Decision.** Three layers — primitive, semantic, component. Components read
semantic names (`--text-muted`, `--accent-solid`) and never primitives
(`--n-500`, `--a-700`).

**Why.** Only the semantic layer is redefined per theme. A component that
reaches a primitive is correct in light mode and wrong in dark, and the failure
is invisible until someone switches themes. Making the boundary a rule rather
than a convention is what keeps dark mode from rotting.

**Rules out.** Referencing a ramp step directly, however convenient.

---

## 5. The legacy token bridge, deleted by attrition

**Decision.** The old `--gray-*` / `--teal-*` names still resolve — but now to
semantic tokens. They are frozen: nothing new may use them, and the count is
ratcheted downward.

**Why.** 1,122 call sites reference them. A single find-and-replace commit
touching that many places is unreviewable and would land on top of in-flight
work. Pointing the old names at semantic tokens does two useful things at once:
those call sites become theme-aware immediately, and each can later be migrated
to the name it already resolves to with no visual change at the moment of the
edit.

**Done when.** The count reaches zero and the bridge block at the bottom of
`styles/tokens.css` is deleted.

---

## 6. Theme and density live on the device, not the account

**Decision.** `localStorage`, set on `<html>` by a blocking script before first
paint.

**Why.** They are per-screen preferences, not per-person ones: the same
technologist wants compact rows on the bench workstation and comfortable rows on
the tablet they carry between rooms. Device storage also behaves correctly under
a clinic's shared login, where an account-level setting would not.

Reading the value in an effect is always too late — the page renders in the
wrong theme and then flips. It has to be a synchronous script.

"System" writes **no** attribute. Writing `data-theme="light"` for a
system-setting user would beat their OS preference, which is the opposite of
what the setting means.

**Rules out.** Syncing appearance through the profile table.

---

## 7. The square look is a token, not an `!important`

**Decision.** `--radius-* : 0px`. The global
`*:not(…) { border-radius: 0 !important }` rule is gone.

**Why.** Inline styles lose to `!important`, so that one rule silently killed
363 `borderRadius` declarations written elsewhere in the app — a large amount of
design intent in the code was never reaching the screen, and nothing said so.
The look is unchanged; it is now a value one edit away rather than a rule
fighting the code.

---

## 8. Status colour is separate from the accent

**Decision.** `--critical-*`, `--warning-*`, `--success-*`, `--info-*` are their
own sets. The accent is never reused as "success", and status colour is never
used decoratively.

**Why.** A blue success state and a blue primary action are indistinguishable at
a glance, which is the moment that matters on a queue screen.

---

## 9. Clinical state is never encoded in colour alone

**Decision.** Every status mark carries at least two channels: colour plus a
word, or colour plus a shape. `ResultFlag` prints the letter, the word and the
fill. `StatusPill` varies the dot's shape as well as its colour. Selected and
critical table rows get an inset edge, not just a tint.

**Why.** The result grid this replaces tinted a cell red for high and blue for
low beside a bare letter. That fails WCAG 1.4.1, disappears on the monochrome
printouts clinics actually hand to patients, and is announced as "H" with no
context. On a lab result the cost of a missed flag is not aesthetic.

---

## 10. Critical values are a separate tier from abnormal

**Decision.** `ResultFlagValue` is `'' | 'H' | 'L' | 'HH' | 'LL'`. A panic value
is not a louder abnormal one.

**Why.** They have different thresholds, different visual treatment, and a
different workflow — a critical value carries a release interlock and an
acknowledgement record. Keeping them separate in the type stops the two being
conflated at the call site, which is where the mistake would otherwise be made.

---

## 11. A ratchet, not a lint rule with exceptions

**Decision.** `scripts/check-tokens.mjs` counts ten things and fails the build
when any count rises above the ceiling in `scripts/ui-budget.json`. Lowering is
automatic (`--update`); raising is a hand edit, reviewed in the same commit.

**Why.** The app arrived at 2,100 inline styles one reasonable-looking edit at a
time. Nothing was wrong with any single one; the problem was that nothing
counted. A conventional lint rule would have to be disabled everywhere on day
one and would never be re-enabled. A ratchet is green from day one, gets
stricter for free as work lands, and makes any regression a visible decision.

`components/ui/` is excluded — it is the one place these patterns belong, and
counting it would penalise moving work into the library.

---

## 12. Contrast is verified, not reviewed

**Decision.** `scripts/check-contrast.mjs` resolves every token through its
`var()` chain and checks 30 foreground/background pairs in both themes.

**Why.** `--gray-500` was the app's secondary text colour in 111 places at
3.67:1, below the 4.5:1 AA requires. Nobody noticed for the life of the product,
because nothing checked. The script caught four failures in the new dark palette
on its first run — including a "meaningful boundary" at 1.67:1 — which is the
argument for it.

---

## 13. Brand fallbacks are centralised, and one of them was a leak

**Decision.** `lib/branding.ts` holds every fallback name. The portal history
endpoint returns the tenant's identity so the portal pages can stop guessing.

**Why.** One clinic's name — "Amana Trust Diagnostics" — was written into
eighteen places across the portal and outgoing email, so every tenant's patients
received another clinic's branding.

The sweep turned up something worse than cosmetic: when a clinic had no admin
email on file, the new-investigation notification fell back to a hard-coded
gmail address, mailing that tenant's catalogue changes, staff names and
workspace link to an unrelated third party. It now sends nothing and logs.

**Still open.** The portal pages below sign-in are tenant-aware for their name
and contact details, but logo and accent are not yet threaded through. That is
finished in the brand phase.

---

## 14. One navigation table, three consumers

**Decision.** `components/shell/navigation.ts` is the single list of what each
role can reach. The rail, the command palette, the breadcrumbs and the
after-login redirect all derive from it.

**Why.** The role-to-destination mapping was written out three separate times —
`RootWrapper`'s redirect, `Header`'s back button, and the admin sidebar's
"Department Switcher" — and could drift. `homePathFor` now derives the landing
screen from the same table the rail renders, so a role added to it cannot end up
with a home screen it has no entry for.

**Rules out.** Adding a screen by editing a component's JSX.

---

## 15. The patient context bar

**Decision.** Once a patient is open, their name, ID and key facts stay pinned
below the header regardless of which tab is showing.

**Why.** The old app printed the name at the top of whichever tab you were in
and lost it as soon as you moved. "Which patient am I looking at" is the
question a mis-filed result answers wrongly, and every major EHR converged on
pinning it for that reason.

---

## 16. Focus never leaves the command palette's input

**Decision.** Arrow keys move a highlight tracked with `aria-activedescendant`;
real focus stays in the text field.

**Why.** Moving focus into the list means every arrow key press is stolen from
the query. The pattern exists precisely for this case.

---

## 17. The critical-value dialog cannot be dismissed by accident

**Decision.** `dismissible={false}` — no scrim click, no `Escape`. The only ways
out are "Go back and check" and an acknowledgement that requires a tick.

**Why.** This is the one place in the product where blocking those exits is
right. Everywhere else, an accidental close costs a re-open; here it would mean
a panic value released without anyone looking at it.

**Rules out.** Using `dismissible={false}` anywhere that merely wants attention.

---

## 18. Default panic limits are a starting point, not an authority

**Decision.** `DEFAULT_CRITICAL_LIMITS` covers analytes where published critical
limits are broadly consistent, deliberately conservative, and overridable per
workspace through `criticalLimitsFor`.

**Why.** Every laboratory sets its own critical limits and a medical director is
expected to sign them off. Shipping a fixed table as though it were settled
would be a clinical claim this product is not in a position to make. Shipping
nothing would leave the interlock with nothing to fire on.

**Open.** The override has no UI yet — a workspace can only supply one in code.
That belongs with the test catalogue screen.

---

## 19. "No opinion" is not "normal"

**Decision.** `deriveFlag` returns `null` when the result is not numeric or the
range cannot be read, and `''` only when the value was checked and found in
range. The two are never conflated.

**Why.** An empty flag is an assertion that the result is normal, and that
assertion has to be earned. A parser that fell back to `''` on anything it could
not read would silently mark unparseable results as fine — which is the exact
failure the whole phase exists to remove. A sexed range with no patient sex on
file returns `null` for the same reason: picking an arm would be a guess with a
clinical consequence.

---

## 20. The sign-in screen does not follow the theme

**Decision.** It commits to one dark treatment, with every colour painted
explicitly rather than taken from the semantic tokens.

**Why.** It is the front door and should look the same to everyone. The tokens
describe the app's themed surfaces; borrowing them here would make the first
impression depend on a setting the visitor has not made yet. The trade is that
its contrast is verified by hand rather than by `check-contrast.mjs` — every
pair was measured, and none is below 5.5:1.

---

## 21. Bundle size went up, on purpose

**Decision.** Accepted +23 kB on the department screens and +32 kB on reception.

**Why.** Persistent navigation, the command palette and the Radix primitives
that make the overlays accessible cost more than the code-splitting saved. The
alternative was keeping an app with no navigation, which was cheaper and worse.

**The number that will actually move it** is server components: all 29 routes
are still `'use client'`, so every navigation starts from a blank page. That is
the outstanding work in the performance phase, and it is worth more than
anything that could be trimmed here.

---

## 22. Finish the wallet extraction rather than delete it

**Decision.** Render the `components/features/wallet/` components that had been
sitting unused, move the live behaviour onto them, and delete ReceptionPage's
inline copy — rather than deleting the unused code and migrating the copy.

**Why.** `WalletTab`, `BillingAccountModal` and `LedgerModal` — 1,455 lines —
were imported by ReceptionPage and rendered nowhere, alongside a 341-line
zustand store used only by them. ReceptionPage carried its own ~970-line inline
version, and both were being maintained. This is the failure the DepartmentPage
tests were written to catch: "copied state instead of moving it and shipped dead
buttons behind a green build."

Deleting the unused half was the lower-risk option and was the recommendation.
It was overruled, correctly as it turned out: the unused half contains
**transaction reversal**, which is implemented and tested in `lib/` and had no
reachable UI at all. It also calls `updateBillingAccountLimit` and
`upgradeBillingAccount` where the inline copy hand-rolled raw `fetch` calls
against `/api/billing`.

**What wiring it up found.** Three silent gaps, all fixed here:

- The directory had no **Owner** column, which a recent commit added a narrow
  owner-only fetch specifically to support, and no **Credit limit** column.
  Swapping without checking would have dropped both.
- `externalCharges` existed in the store with **no setter**, so the ledger's
  Charges tab could only ever render empty.
- `billingAccounts` was never populated on first load; only a deposit filled it.

**The mitigation.** `WalletTab.test.tsx` is a characterisation suite whose
purpose is not coverage but that every control reaches something and that no
column was lost. It is the thing that makes this swap safe to repeat.

**Still owed.** Someone has to click through the wallet in the running app:
open an account, take a deposit, log a charge, link and unlink a dependant,
reverse a transaction, print a statement. The tests assert the wiring, not the
round trip to the database.

---

## 23. The shell belongs to the layout, not to the screen

**Decision.** `AppShell` is mounted once, in `app/[slug]/layout.tsx`, around the
whole workspace subtree. Screens no longer render it. What a screen needs to
contribute to the header goes through `components/shell/ShellSlot.tsx`.

**Why.** Every screen opened with its own `<AppShell title=… subtitle=…>`. The
rail, the header, the breadcrumbs, the clock and the command palette were
therefore destroyed and rebuilt on every navigation: the whole window blanked
and redrew, the rail re-read its collapsed state out of `localStorage` each
time, and the clock restarted. Moving between Reception and the bench looked
like a page load because structurally it was one. Now only `<main>` changes.

**What that forced.** Three props had no call site left:

- **`title`** already fell back to the active nav entry's label, so the three
  screens passing one were passing what the shell would have worked out anyway.
- **`subtitle`** was the workspace name on every screen, and the shell has the
  organisation in scope. It defaults to it.
- **`flush`** — whether a screen runs its content edge to edge — is now a field
  on the nav entry. It is a fact about the route, not about a render: the
  department benches and the reception desk have always run their toolbars to
  the edge, and there is no longer a call site to pass it from.

`actions`, `patient` and `commands` stay reachable through the slot rather than
becoming dead props. Nothing sets them yet.

**The risk this took on.** The heading is no longer rendered by the screen, so
the DepartmentPage test that asserted it could not stay. `navigation.test.ts`
replaces it and covers more: that every entry has a label, that each route
resolves to the heading it should, that exactly three routes are flush, and that
every role lands on a screen its own rail contains.

---

## 24. Route shells are server components; the screen is the client component

**Decision.** Every `page.tsx` is a server component that renders one client
screen beside it — `app/[slug]/admin/staff/page.tsx` renders
`StaffScreen.tsx`. The moves were done with `git mv` so a 1,700-line screen
keeps its history.

**Why.** All 29 routes were `'use client'`, so nothing in the product had HTML
before its JavaScript arrived, and no route could export `metadata`. Thirty
routes shared one browser-tab title — the back button and a row of pinned tabs
were unreadable. Each route names itself now, against a `'%s · Redian'`
template on the root layout.

**What it does not buy.** Not server-side data fetching. Auth is a Supabase
session in the browser and every screen loads its own data from a client
effect, so these shells render a frame, not content. Calling this "server
components" and stopping here would overstate it: the honest claim is that the
route boundary is now server-rendered and each screen is a separate client
island. Moving the data itself server-side needs the session on the server
first, which is a different piece of work.

**Caught by the build.** A server component cannot hand a client component a
function, so `LegacyRouteRedirect` takes a path string rather than a
`(slug) => string`. Worth remembering: this class of mistake compiles.

---

## 25. `/lab`, `/reception` and `/radiology` redirect instead of rendering

**Decision.** The three slug-less department routes now redirect into the
workspace, the way `/admin/staff` already did.

**Why.** They were second mountings of the same screens from before the product
was multi-tenant. Nothing linked to them, and every redirect in the app already
pointed at the slug version, so they were reachable only by being typed. Once
the shell moved into `app/[slug]/layout.tsx` they would have rendered a screen
with no navigation around it at all — three more copies to keep in step for no
one.

---

## 26. One boot screen, and it follows the theme

**Decision.** `components/BootScreen.tsx` replaces both hand-rolled spinners in
`RootWrapper`, and `RequireRole`'s waiting state is now the design system's
`LoadingPanel`.

**Why.** The two spinners were hard-coded `#0f1628` navy with a `#4472c4` ring,
so a light-theme user opened the app to a dark panel that then flashed white.
`RequireRole` painted a full-height gradient in three more hard-coded colours
over the whole window; since the shell now sits above it, that state keeps the
rail and header and only the panel waits.

A bare spinner is the honest answer in exactly one place — before the session
resolves, when nothing is known and there is no shape to draw a skeleton of.
Everywhere below the shell, `app/[slug]/loading.tsx` draws a toolbar over a
table instead, because that is the shape of nearly every screen here.

---

## 27. The portal is one tenant's product, not one tenant's brand

**Decision.** The three portal screens are rebuilt on the design system, and
every trace of a specific clinic is gone from them. The header mark is now the
clinic's own initials, drawn from the name the API returns.

**Why.** `<AmanaLogo>` — one clinic's shield — was hard-coded into all three
portal screens. This is the same defect as the eighteen hard-coded clinic names
that decision #12 dealt with, and it survived that sweep because a logo is a
component import rather than a string. Every clinic's patients were being shown
another clinic's mark on the page where they collect their own medical results.

**Initials, not a logo, because there is no logo.** `organizations` has `name`,
`address`, `phone`, `email`, `letterhead_line2` and `letterhead_html`, and no
logo column. A monogram in the accent colour is right for every tenant on day
one and needs no upload flow. If a logo column is ever added, this is the single
place that changes.

**The report is the exception, and it was already correct.**
`/api/portal/render` builds the document with `getResultTemplate`, which lays
the results over the tenant's own `letterhead_html`. So the branding on the
report — on screen, in print and in the PDF — is the clinic's real letterhead,
and always was. The portal screen around it is chrome; it does not restate the
letterhead, and it hides itself when printing.

**What was dropped.** The report screen had a fallback that rendered the results
as its own cards and tables when the render endpoint failed. That is a portal
improvising a clinical document the clinic never signed — different layout, no
letterhead, no signature block, no reference-range presentation the bench
agreed. It now says the document did not load and offers a way to get it.

**Also fixed on the way through, each of which was live:**

- `<a href="mailto:{SUPPORT_EMAIL}">` — a literal in the attribute, not the
  constant. The one link a stuck patient had opened a composer addressed to
  nobody.
- Visits opened from a `<div onClick>` with no `aria-expanded`, so a keyboard
  or screen-reader user could not open one at all.
- The portal layout injected a `<style>` block: a second `* { margin: 0 }` reset
  that `globals.css` already does, a `body { background: #f4f6fb }` that
  overrode the theme, an `input:focus` rule with `!important` fighting the
  design system's focus ring, and a `button:hover { transform }` that lifted
  every button in the component library by a pixel.
- `RootWrapper` held `/portal` behind the staff Supabase auth check, so a
  patient opening a link to their results sat through the staff boot screen
  first. The portal has its own token and never needed that session.
- Signing out cleared `portal_token` in two places and `portal_email` in one, so
  a signed-out patient's address stayed on the machine. Both keys now go
  through `lib/portalSession.ts`.
- The report sat in a fixed-height iframe inside a scrolling page — two
  scrollbars, and the reader had to find the right one. The frame now grows to
  its document.

**The portal follows the theme.** Unlike the staff sign-in screen (#20), which
commits to one dark treatment because it is the product's front door, the portal
is read on a patient's own phone, often at night. It takes the theme that phone
asked for, which it can now do because every colour on it comes from the
semantic token layer.

---

## 28. Characterisation tests before every screen extraction

**Decision.** No screen in this sweep was rebuilt until tests existed describing
what it already did. Four screens, four test files written first.

**Why it stopped being optional.** It caught a real regression within the hour.
Extracting the staff dashboard's arithmetic, `matchesStaff` lost one of its five
clauses — `fn.includes(cb)`, which credits work when the bench typed less than
the roster holds, "Bala" against "Bala Yusuf". Nothing would have failed. The
screen would have rendered, the build would have passed, and staff would quietly
have stopped being credited for their own tests on the screen an administrator
pays them from.

**What the tests assert.** What reaches the database, not what the page looks
like. The wallet's twelve check the deposit's amount, method, note and author;
that a reversal is offered on a charge but not a deposit, needs a reason,
refuses a blank one and cannot be applied twice; and that a department charge
only carries a `billingAccountId` when the wallet is paying — because a cash
payment that also debited the wallet would charge the patient twice.

**What changes across a split, legitimately.** Wording, and roles. "Configured"
became "On file"; two bare `<button>`s became a real tablist, so queries moved
from role `button` to role `tab`. Those edits to the tests are the record of a
deliberate change. An assertion about behaviour changing is not.

---

## 29. One CSV rule, and it assumes the file will be opened in Excel

**Decision.** `lib/csv.ts` writes every export. Cells are quoted with doubled
quotes, prefixed with an apostrophe when they begin `=`, `+`, `-` or `@`, joined
with CRLF, and the document opens with a UTF-8 BOM.

**Why.** Both exports in the product — the commission report and the patient
database — were built as `"${value}"` with nothing escaped. Two separate faults
followed. A patient recorded as O"Brien ended the field early and shifted every
column after it on that row. And a cell beginning `=` is read as a *formula* by
Excel, Sheets and LibreOffice, and runs when the accountant opens the file:
patient names, referrer names and settlement notes are all typed by staff, so
that is reachable rather than theoretical.

The BOM is not decoration either. Without it Excel on a Nigerian Windows machine
opens Adéọlá as Adeolá.

**Also.** Neither export revoked its object URL, so every download leaked a blob
for the lifetime of the tab.

---

## 30. Every admin screen was fighting the shell

**Decision.** No screen renders a page header or sets its own height. The
heading comes from the nav table; a sentence under it goes through
`useShellSlot`.

**Why.** Decision #23 moved the shell into `app/[slug]/layout.tsx` and #27's
progress note said no test would notice a screen that "sits under a heading it
did not choose". All four screens in this sweep had exactly that, and all four
had `minHeight: '100vh'` on their root — inside the shell's `<main>`, which
already fills the window. Every admin page had two headings and two scrollbars.

That is worth recording as a pattern rather than four bug fixes: it is what
hoisting a shell does to screens written before it existed, and the remaining
admin screens will have it too.

## 31. Marketing pages and paper canvases are deliberately single-theme

**Decision.** Three kinds of surface do not follow the viewer's theme, and each
says so at the top of its stylesheet:

- **The public face** — landing, download, sign-in, sign-up. Brand, not
  workspace. Every colour is declared once as a scoped custom property on the
  page root (`app/landing.module.css`, `app/login/login.module.css`) rather
  than typed into elements, so it is one palette and not 149 literals; but it
  is one palette on purpose.
- **Paper** — the report editor's page and the letterhead designer's canvas.
  What is drawn there is what prints. White ground, black ink, whatever the
  theme says. The chrome around the paper follows the theme like everything
  else.
- **The drawing itself** — an element's x, y, width, height and rotation in the
  letterhead designer stay inline in the TSX. They are the design, not
  styling, and they are what gets serialised for print.

**Why.** Decision #20 made this call for the sign-in screen; this extends it to
everything the same reasoning covers and draws the line at "the design
system's job is the workspace". The ratchet counts inline styles, and the seven
that remain in the report editor and nine in the designer are all values — a
swatch in its own colour, a font preview in its own face, a box at its own
coordinates. Moving those to a class would be moving a number into CSS to
satisfy a counter.

The contrast checker does not cover these surfaces; they were checked by hand.
The landing page's lowest text tier is 47% white on `#07090f`, 4.8:1. The old
page went to 28%, which is 2.5:1.

## 32. A page that says something about the product must be true

**Decision.** Copy on the public pages is subject to the same review as code.
Two claims were removed this session because the codebase did not support them:
"encrypted SQLite database" (there is no at-rest encryption anywhere), and eight
footer links to documents that do not exist. One was flagged and left for the
owner: three named testimonials and a "100+ diagnostic centres" figure.

**Why.** A clinic reading "encrypted" believes its patient records are protected
on the disk. That is not marketing tone; it is a statement about what the
software does, and the software does not do it. Anyone migrating a marketing
page should read the copy as carefully as the styles.
