<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Building UI in this repo

The interface is being moved onto a design system. **Read
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) before writing any UI**,
[`docs/UI_DECISIONS.md`](docs/UI_DECISIONS.md) before changing how the system
itself works, and [`docs/UI_PROGRESS.md`](docs/UI_PROGRESS.md) for what is
migrated and what is not.

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

## What not to touch

`lib/` is the good part of this codebase — typed repositories, real tests,
atomic wallet operations. The overhaul is a layer replacement, not a rewrite.
Do not restructure data access in the course of a UI change.
