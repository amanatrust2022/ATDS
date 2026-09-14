<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Building UI in this repo

The interface is being moved onto a design system. **Read
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) before writing any UI**,
[`docs/UI_DECISIONS.md`](docs/UI_DECISIONS.md) before changing how the system
itself works, and [`docs/UI_PROGRESS.md`](docs/UI_PROGRESS.md) for what is
migrated and what is not. **Continuing the migration? Start with
[`docs/HANDOFF.md`](docs/HANDOFF.md)** — the queue, the recipe, and the rule
about never using `git add -A`.

## The rules

1. **Never type a colour, size, spacing value or ARIA attribute into a screen.**
   Values live in `styles/tokens.css`. Components live in `components/ui`.
2. **Import from `@/components/ui`**, not from the component files directly.
3. **Components use the semantic token layer only** — `--text-muted`,
   `--accent-solid`. Never a primitive (`--n-500`, `--a-700`): only the semantic
   layer is redefined per theme, so a primitive is right in light mode and wrong
   in dark.
4. **If the system lacks something, add it to the system.** Not inline "just
   this once" — that is how the app reached 2,100 inline style objects.
5. **Colour is never the only channel.** Add a word, an icon or a shape. Clinics
   print in monochrome and technologists are sometimes colour-blind.
6. **New overlays, tabs and menus come from Radix**, via `components/ui`. Do not
   hand-roll focus trapping.
7. **The legacy `--gray-*` / `--teal-*` names are frozen.** They still resolve,
   but nothing new may use them.

## Before you commit UI

```bash
npm run check:ui     # contrast in both themes + the ratchet
npx tsc --noEmit
npm test
```

`npm run check:ui` fails the build if any of the ten tracked counts rise above
`scripts/ui-budget.json`. After a migration that lowers one, lock the gain in:

```bash
node scripts/check-tokens.mjs --update
```

Raising a ceiling is a hand edit to `ui-budget.json`, in the same commit, so the
increase is reviewable rather than automatic.

## Check every screen in

- dark mode (`data-theme="dark"` on `<html>`)
- compact and comfortable density
- 390px wide
- with the mouse unplugged

## Mode is not connectivity

Read [`docs/SYNC.md`](docs/SYNC.md) before touching anything that syncs, anything
that asks "are we on a hub?", or anything that asks "are we online?".

1. **Which back end** a screen talks to (`local` hub or `cloud`) comes from
   `lib/runtimeMode.ts` (`getRuntimeMode`, `isHubServer`) or the hook in
   `lib/useRuntimeMode.ts`. Never from the hostname, `localStorage`, or an
   environment variable read in a component. `lib/runtimeMode.guard.test.ts`
   fails the suite on a copy.
2. **Whether the hub can reach the cloud** comes from the sync engine, read
   through `useSyncState()`. Never inferred from the mode, and never from
   `navigator.onLine`.
3. **A screen on a hub writes to the hub**, through its API and `queueSync`.
   It does not call Supabase, and it does not "try the cloud and ignore the
   error". The engine sends what the hub queued, now or when it can.
4. **A new synced table** goes in four places — `lib/localDb.ts`,
   `supabase_sync_integrity.sql`, `lib/sync/tables.ts`, and `queueSync` at the
   write — and `lib/sync/tables.test.ts` fails if they disagree.

## What not to touch

Role-change Undo callbacks capture the original render. Pass the newly assigned
role explicitly as the reversal's previous role; reading captured staff state
records an incorrect before-value in the audit log.

`lib/` is the good part of this codebase — typed repositories, real tests,
atomic wallet operations. The overhaul is a layer replacement, not a rewrite.
Do not restructure data access in the course of a UI change.
