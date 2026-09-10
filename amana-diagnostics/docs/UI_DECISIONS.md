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
