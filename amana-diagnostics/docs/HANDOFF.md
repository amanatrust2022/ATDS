# Handoff — the screen migration is finished

Written 11 September 2026, rewritten 12 September 2026 when the queue emptied.
Read `AGENTS.md` first; it has the rules. This file has the state, what is
left, the recipe that got us here, and the things nobody has decided yet.

---

## Where things stand

- **The queue is empty.** Every screen listed in the old version of this file
  has been migrated, one per commit, tests first. The list is kept below under
  "What the queue was" so the commits can be read against it.
- **Ratchet:** 35 inline styles (from 2,100), 69 hex, 3 rgba, **0 legacy
  tokens**, 5 pointer handlers, **0 hand-rolled overlays**, 2 raw tables, 4
  zIndex. `node scripts/check-tokens.mjs` prints the live numbers.
- **Tests:** 935 across `lib/`, `components/`, `app/`, in 77 files. The full
  suite runs in about 50 seconds and passes.
- **Build:** `npx next build` compiles clean with no warnings.
- **Git:** this work is on `claude/beautiful-heisenberg-40j4ez`, pushed.

## Rules that are not in AGENTS.md

1. **Stage files by name. Never `git add -A`.** The working tree holds untracked
   personal files (`leads_kano.csv`, `sales_strategy.md`, two scraper scripts)
   that were swept into the public repo three times, once carrying a live API
   key. They are gitignored now, but the habit is the protection.
2. **Tests first, then the rebuild** (decision #28). Write the characterisation
   tests against the *old* screen, run them, and let the failures tell you what
   was broken. Fix the ones you find; note the ones you leave.
3. **No screen renders its own page heading** (decision #30). The shell owns
   the `<h1>`; a sentence under it goes through `useShellSlot({ subtitle })`.
4. **Only the workspace follows the theme** (decision #31). Marketing pages,
   sign-in/up, and the two paper canvases are single-theme on purpose.
5. **Read the copy as carefully as the styles** (decision #32).
6. **A test that passes against the old screen is not a finding.** Say so in a
   comment and either sharpen it or keep it as a behaviour guard. Three screens
   in this round had no defect at all — the appearance card, the Widal grid and
   the parameter grid — and their commits say that plainly rather than dressing
   structural work up as a fix.

## What is left, and why

Nothing here is a queue. Each is a deliberate exception with a reason.

**35 inline styles**, all values rather than styling:

| Count | File | Why they stay |
| --- | --- | --- |
| 9 | `components/LetterheadDesigner.tsx` | An element's x, y, width, height and rotation. Decision #31: they are the design, and they are what gets serialised for print. |
| 9 | `components/LetterheadA4Preview.tsx` | A4 page geometry computed from `MM`, `PAGE_W`, `MARGIN_X`. Moving a number into CSS to satisfy a counter. |
| 7 | `components/RichTextEditor.tsx` | A swatch drawn in its own colour, a font preview in its own face. |
| 2 | `components/ReceptionPage.tsx`, 2 `StaffPerformance.tsx`, 1 each in five more | A bar's width from a percentage, a logo's size from a prop. |

**2 raw `<table>`s**, both in `components/features/reception/SlipModal.tsx`.
They are paper: `docTable` is sized in px, ruled in black, and dashed in `#ccc`
because that is what a printer puts on the page. Running them through the
system's `Table` would bring a scroll wrapper, a sticky header, hover and theme
tokens onto a printed slip. Decision #31 covers this — *the chrome around the
paper follows the theme; the paper does not.*

**5 pointer handlers.** The metric is named for `onMouseOver`/`onMouseOut` but
the pattern also catches `onMouseEnter`/`onMouseLeave`. What is left is not
hover styling in JavaScript: three are a combobox highlight following the
pointer so it agrees with the arrow keys (`PatientLookup`, `OwnerPicker`,
`TemplatePicker`), and two are the editor's table-size grid preview. Driving
this to zero would mean making those worse.

**4 numeric `zIndex`**, all in `LetterheadA4Preview`: the background frame at 0,
the report at 1, the clear-area guide at 2. Page layering, not app layering.

**69 hex colours**, all in `.tsx` that paints paper or brand: the editor's
palette, the designer, the A4 preview, the logo, and the theme boot script in
`app/layout.tsx`.

**3 `!important`**, all in `app/globals.css`, all inside `@media print` or
`prefers-reduced-motion`.

## What the queue was

Every row below is done. The commit for each says what was wrong before it says
what moved.

| File | The defect the tests found |
| --- | --- |
| `app/invite/[token]/InviteScreen.tsx` | A slow-network warning stayed over the form after the lookup succeeded. |
| `app/onboarding/OnboardingScreen.tsx` | Unlabelled fields on the front door. |
| `components/features/registration/ReferralSelection.tsx` | Suggestions were `<div onClick>`; the clear button had no name. |
| `app/[slug]/settings/ProfileScreen.tsx` | Supabase errors are plain objects, so the real cause never reached the user. |
| `app/update-password/NewPasswordScreen.tsx` | A redirect timer with no cleanup; two fields one substring apart. |
| `app/[slug]/admin/AdminOverviewScreen.tsx` | A second `<h1>` under the shell's. |
| `components/features/registration/TestSelection.tsx` | Department by colour alone. |
| `components/features/queue/PatientCard.tsx` | Test status by chip fill alone; pending had no icon or word at all. |
| `app/[slug]/admin/referrals/ReferralsOverviewScreen.tsx` | A failed load caught by nothing; four em dashes for ever. |
| `components/features/registration/PatientLookup.tsx` | Mouse-only suggestions; an unnamed search box. |
| `components/TemplateManager.tsx` | The last hand-rolled overlay. No role, no trap, no Escape. |
| `components/LetterheadA4Preview.tsx` | A made-up patient announced as a record. |
| `components/features/registration/TestSearchPicker.tsx` | Toggles with no pressed state; department by colour. |
| `QuickFacilityModal.tsx`, `QuickDoctorModal.tsx` | Hand-rolled overlays over eight unnamed fields. |
| `components/features/queue/QueueHeader.tsx` | Filter selection by fill alone, in two unnamed groups. |
| `components/features/queue/QueueList.tsx` | An uncounted `<div>` of cards. |
| `components/features/queue/PatientSearchFilters.tsx` | Nothing rendered it. Deleted. |
| `components/features/wallet/WalletTab.tsx` | An overdrawn account in red, with the minus buried mid-string. |
| `components/features/settings/AppearanceSettings.tsx` | None. Structural only, and the tests say so. |
| `components/shell/CommandPalette.tsx` | The dialog was named; the box you type in was not. |
| `components/features/registration/RegistrationForm.tsx` | Seven unnamed fields on the patient's own details. |
| `components/features/registration/RegistrationTab.tsx` | Neither column of the desk was a landmark. |
| `components/features/department/ParameterTable.tsx` | None. Structural only. |
| `components/features/department/SensitivityTable.tsx` | The antibiotic was not its row's header. |
| `components/features/department/WidalEntryForm.tsx` | None. Structural only. |
| `app/[slug]/admin/tests/TestCatalogueScreen.tsx` | A second `<h1>`; `minHeight: 100vh` inside a shell that already fills the window. |

Retired along the way, and no longer in the tree:

- `components/features/registration/styles.ts` — the last shared inline-style
  helper. Its `inputStyle()` set `outline: 'none'` on every registration field,
  and being a `.ts` file it never showed up in the ratchet's count of removed
  focus rings.
- `components/features/registration/Field.tsx` — a `<label>` with no `htmlFor`
  over a control with no `id`, which is why every field in that folder was
  beyond a screen reader's reach.
- `components/features/queue/PatientSearchFilters.tsx` — dead.

The system grew twice to absorb this work, rather than the screens reaching
around it (rule 4): `SegmentedControl` gained an optional icon per option, and
`Table` gained `rowHeader`, `cellClassName`, `className` and `rowClassName`, so
a clinical data-entry grid can be a system table without being flattened into a
listing. The panic-row treatment moved into `Surface.module.css` at the same
time, and now covers a row header as well as a cell — which the old rule in
`ParameterTable.module.css` silently did not.

## The recipe

This worked for every screen. It takes about an hour each.

1. **Read the screen.** `cat` it. Count `style={{`. Note anything that is a
   claim about the product, a hard-coded version, a `<div onClick>`, a
   `<label>` with no `htmlFor`, a colour-only state, a `setTimeout` with no
   cleanup, a fixed overlay, a promise with no `.catch`.
2. **Find who renders it** and whether a test file exists. If nothing renders
   it, stop and say so — one screen in this round turned out to be dead.
3. **Write the tests** in `<Screen>.test.tsx` beside it. Mock `next/navigation`,
   `@/components/AuthProvider`, `@/lib/supabase`, `@/components/RequireRole`
   and `@/components/Notices` the way the existing tests do (see
   `app/[slug]/admin/staff/StaffScreen.test.tsx` and
   `app/signup/SignUpScreen.test.tsx`). Query by role and name — never by
   placeholder or display value when you can avoid it. Assert:
   - every field can be found with `getByRole('textbox' | 'combobox' | 'spinbutton', { name })`
   - errors and confirmations are `role="alert"` / `role="status"`
   - toggles carry `aria-pressed`, menu openers `aria-haspopup` + `aria-expanded`
   - nothing links to `href="#"`
   - the one or two behaviours the screen exists for
4. **Run them against the old screen.** They should fail. If a test passes on
   the old screen it is either vacuous or the old screen was fine there — say
   which in a comment. Use `git stash push <one file>` to re-check a sharpened
   test against the old screen without losing the new stylesheet.
5. **Write the CSS module** beside the screen. Semantic tokens only
   (`--text-primary`, `--surface-raised`, `--accent-subtle`…). Verify every
   token name exists: `grep -c "^\s*--NAME:" styles/tokens.css`. Names that do
   *not* exist and are easy to guess wrong: `--accent-surface` (it is
   `--accent-subtle`), `--focus-ring` (it is `--focus-color`),
   `--leading-relaxed` (it is `--leading-normal`), `--text-tertiary` (it is
   `--text-muted`). Never write `*/` inside a CSS comment — a comment about
   `--gray-*/--teal-*` closes itself early and the build fails with an
   unhelpful `Unexpected '/'`.
6. **Rewrite the TSX** on `@/components/ui`: `Field`/`Input`/`Select`/`Textarea`
   for forms, `Button` (with `loading`, `icon`, `intent`), `Alert` (with
   `live`), `Dialog` for anything modal, `SegmentedControl` for a small
   switch, `Table` for any grid, `Card`/`CardHeader`/`CardBody`. Keep behaviour
   identical unless a test you wrote says it was wrong. Two things that catch
   people out: `Input`'s `suffix` renders inside `aria-hidden="true"`, so an
   interactive control cannot go there — use the chosen-line-plus-named-Remove
   pattern from `components/features/wallet/OwnerPicker.tsx`; and a required
   `Field`'s accessible name gains `" (required)"`, so anchor a test's regex at
   a word boundary rather than at end-of-string.
7. **Verify, in this order, separately** (running them together starves the
   machine): `npx tsc --noEmit` → the screen's tests → the folder's tests →
   `node scripts/check-tokens.mjs` → `node scripts/check-contrast.mjs` →
   `npx next build`.
8. **Lock the ratchet and commit by name:**
   ```bash
   node scripts/check-tokens.mjs --update
   git add path/Screen.tsx path/Screen.test.tsx path/screen.module.css scripts/ui-budget.json
   git commit
   ```
   The commit message says what was wrong, in the user's terms, before it says
   what moved where. Read `git log -12` for the tone. End with the ratchet
   movement and the co-author trailer.
9. **Report** in a few lines: the defects found, the test count, the ratchet.

## Things the code cannot decide

Raise these with the owner; do not resolve them silently. **Every one of these
is still open** — nothing in this round touched any of them.

1. **Testimonials on the landing page.** `app/LandingScreen.tsx` carries three
   named people at named organisations with five-star ratings, and a "100+
   diagnostic centres across Africa" figure. If they are not real, they are a
   legal problem in most jurisdictions. Preserved verbatim, flagged twice.
2. **Privacy Policy and Terms of Service** do not exist as pages. The footer
   used to link to `#` for both; the links were removed. A sign-up page that
   collects an email address needs them.
3. **Widal and MPS forms open pre-answered negative.** An untouched Widal saves
   as eight Negatives; an untouched MPS as a full negative. A test named
   `'saves an untouched MPs form as six negative rows'` pins this as deliberate.
   Recommendation was to start them unset with a one-click "Mark all negative".
4. **The PWA install prompt.** The old `components/Header.tsx` (deleted; dead
   since the shell) was the only thing capturing `beforeinstallprompt`. If the
   browser-installed PWA still matters, it needs a home in the shell.
5. **`test-zip-extract/`** — 196 MB of build output including `node.exe`,
   tracked in the public repo despite being gitignored. No secrets. Untracking
   it is a one-liner but the owner has not said to.
6. **`enteritis` radiology template** has no impression written. Pinned as an
   exception in `lib/radiologyTemplates.test.ts`; clinical judgement, not code.

## Owed by the owner

Hand verification that no test can do: click the wallet through in the running
app; walk every workspace screen since the shell hoist; sit with the portal on a
phone as a real patient. The screens rebuilt in this round have been checked by
`tsc`, by their own tests, by the contrast checker across both themes and by a
clean production build — but nobody has yet put a mouse down and tabbed through
them.
