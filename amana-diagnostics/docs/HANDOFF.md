# Handoff — finishing the screen migration

Written 11 September 2026 for whoever picks this up next. Read
`AGENTS.md` first; it has the rules. This file has the state, the queue, the
recipe, and the things nobody has decided yet.

---

## Where things stand

- **Ratchet:** 347 inline styles (from 2,100), 201 hex, 79 rgba, 145 legacy
  tokens, 12 hover handlers, 1 hand-rolled overlay, 5 raw tables, 8 zIndex.
  `node scripts/check-tokens.mjs` prints the live numbers.
- **Git:** everything is on `main`. **Nine commits are unpushed** at the time of
  writing (`git log origin/main..HEAD`). Push when the owner says so.
- **Tests:** ~600 across `lib/`, `components/`, `app/`. The full suite can time
  out on a loaded machine (24s/34s failures in files that pass alone); run the
  files you touched, not the world.
- **Build:** `npx next build` compiles clean with no warnings.

## Rules that are not in AGENTS.md

1. **Stage files by name. Never `git add -A`.** The working tree holds untracked
   personal files (`leads_kano.csv`, `sales_strategy.md`, two scraper scripts)
   that were swept into the public repo three times, once carrying a live API
   key. They are gitignored now, but the habit is the protection.
2. **Tests first, then the rebuild** (decision #28). Write the characterisation
   tests against the *old* screen, run them, and let the failures tell you what
   was broken. Every screen so far has had at least one real defect under the
   styling. Fix the ones you find; note the ones you leave.
3. **No screen renders its own page heading** (decision #30). The shell owns
   the `<h1>`; a sentence under it goes through `useShellSlot({ subtitle })`.
   Screens written before the shell all have a duplicate heading and
   `minHeight: 100vh` — remove both.
4. **Only the workspace follows the theme** (decision #31). Marketing pages,
   sign-in/up, and the two paper canvases are single-theme on purpose.
5. **Read the copy as carefully as the styles** (decision #32).

## The queue

Screens with inline styles, most first. One screen per commit.

| Count | File | Notes |
| --- | --- | --- |
| 40 | `app/invite/[token]/InviteScreen.tsx` | Front door for invited staff. Share `app/login/login.module.css` like sign-up does. |
| 29 | `app/onboarding/OnboardingScreen.tsx` | Reads `localStorage.pending_org` written by sign-up. |
| 27 | `components/features/registration/ReferralSelection.tsx` | Has a test file already. |
| 27 | `app/[slug]/settings/ProfileScreen.tsx` | Has `profile.module.css` started. Check for decision #30 duplicates. |
| 21 | `app/update-password/NewPasswordScreen.tsx` | Front door; share the sign-in stylesheet. |
| 21 | `app/[slug]/admin/AdminOverviewScreen.tsx` | Decision #30 likely applies. |
| 16 | `components/features/registration/TestSelection.tsx` | |
| 14 | `components/features/queue/PatientCard.tsx` | |
| 14 | `app/[slug]/admin/referrals/ReferralsOverviewScreen.tsx` | |
| 13 | `components/features/registration/PatientLookup.tsx` | Has a test file. |
| 13 | `components/TemplateManager.tsx` | Radiology template CRUD. Opens the report editor. |
| 12 | `components/LetterheadA4Preview.tsx` | Paper — most of its styles are page geometry and should stay. |
| 11 | `components/features/registration/TestSearchPicker.tsx` | Has a test file. |
| 9 | `QuickFacilityModal.tsx`, `QuickDoctorModal.tsx` | Check they are `Dialog`, not hand-rolled. |
| ≤8 | `QueueHeader`, `RegistrationTab`, `QueueList`, `Field.tsx` (registration), `PatientSearchFilters`, `CommandPalette`, `WalletTab`, `AppearanceSettings` | Small. |

Not in the count, but left over:

- `components/features/registration/styles.ts` exports `inputStyle()` — the
  last shared inline-style helper. Six files import it. Retire it as the
  registration components migrate.
- The last hand-rolled overlay: `grep -rn "position: 'fixed'" --include=*.tsx app components`.
- The five raw `<table>`s: `grep -rln "<table" --include=*.tsx app components | grep -v ui/`.

## The recipe

This has worked for every screen. It takes about an hour each.

1. **Read the screen.** `cat` it. Count `style={{`. Note anything that is a
   claim about the product, a hard-coded version, a `<div onClick>`, a
   `<label>` with no `htmlFor`, a colour-only state, a `setTimeout` with no
   cleanup, a fixed overlay.
2. **Find who renders it** and whether a test file exists.
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
   which in a comment.
5. **Write the CSS module** beside the screen. Semantic tokens only
   (`--text-primary`, `--surface-raised`, `--accent-subtle`…). Verify every
   token name exists: `grep -c "^\s*--NAME:" styles/tokens.css`. Names that do
   *not* exist and are easy to guess wrong: `--accent-surface` (it is
   `--accent-subtle`), `--focus-ring` (it is `--focus-color`),
   `--leading-relaxed` (it is `--leading-normal`).
6. **Rewrite the TSX** on `@/components/ui`: `Field`/`Input`/`Select`/`Textarea`
   for forms, `Button` (with `loading`, `icon`, `intent`), `Alert` (with
   `live`), `Dialog` for anything modal, `SegmentedControl` for a small
   switch, `Card`/`CardHeader`/`CardBody`. Keep behaviour identical unless a
   test you wrote says it was wrong.
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

Raise these with the owner; do not resolve them silently.

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

## Owed by the owner (from before this session)

Hand verification that no test can do: click the wallet through in the running
app; walk every workspace screen since the shell hoist; sit with the portal on a
phone as a real patient.
