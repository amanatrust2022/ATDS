# The DiagnosticOS design system

How to build a screen. Read this before writing UI.

---

## The one rule

**Never type a colour, a size, a spacing value or an ARIA attribute into a screen.**

Values come from `styles/tokens.css`. Components come from `components/ui`.
If the system does not have what you need, add it to the system — not inline
"just this once". That is how the app reached 2,100 inline style objects.

`npm run check:ui` enforces this. It fails the build if any of the counts go up.

---

## Where things live

| Path | What it is |
| --- | --- |
| `styles/tokens.css` | Every colour, size, space, duration. Three layers: primitive → semantic → component. |
| `components/ui/` | The component library. Import from `@/components/ui`, never from the files directly. |
| `app/globals.css` | Base element styles, focus, print, `.sr-only`, the skip link. Nothing component-specific. |
| `scripts/check-contrast.mjs` | Verifies every colour pair against WCAG 2.1 AA, both themes. |
| `scripts/check-tokens.mjs` | The ratchet. Counts what must keep going down. |
| `scripts/ui-budget.json` | The current ceilings. Lowered by `--update`, raised only by hand. |

---

## Tokens

### The three layers

```
PRIMITIVE   --n-500, --a-700, --rd-500        raw ramps
     ↓
SEMANTIC    --text-muted, --accent-solid      what it is FOR   ← use these
     ↓
COMPONENT   --control-height-md               shared control sizing
```

**Components read the semantic layer and nothing else.** Only the semantic layer
is redefined per theme, so a component that reaches a primitive is correct in
light mode and wrong in dark. There is no exception to this.

### Colour

Pick by role, not by hue.

```css
/* Surfaces */
--surface-page       the page behind everything
--surface-raised     a card, a panel, a dialog
--surface-sunken     a table header, a footer, a well
--surface-hover      a row under the pointer
--surface-selected   a row the user picked
--surface-scrim      behind a modal

/* Text — each is verified above 4.5:1 on every surface it is used on */
--text-primary       body text and headings
--text-secondary     labels, supporting text
--text-muted         the floor for anything readable
--text-disabled      NEVER for content that matters. 3.1:1.
--text-inverse       on a solid accent or status fill
--text-link

/* Borders */
--border-subtle      separating like from like (rows in a table)
--border-default     the edge of a control
--border-strong      a boundary that carries meaning. 3:1.
--border-heavy       a deliberate hard rule

/* Accent — the product's blue. Actions, selection, focus. */
--accent-solid  --accent-solid-hover  --accent-solid-text
--accent-subtle --accent-subtle-text  --accent-border  --accent-text

/* Status — deliberately NOT blue, so "success" and "primary action" differ */
--critical-*   --warning-*   --success-*   --info-*
  each has:  -solid  -solid-text  -subtle  -text  -border
```

Status colour is separate from the accent and never doubles as it.

### Everything else

```css
--space-1 … --space-16     4px base. Replaces 199 ad-hoc paddings.
--text-2xs … --text-3xl    nine steps. Replaces 80 font sizes.
--weight-normal … -bold
--leading-tight … -loose
--radius-none … -full      the product's look is square; change it here
--shadow-sm … -xl          spend by role, not on every block
--z-sticky … --z-tooltip   seven layers. Replaces 14 ad-hoc z-index values.
--duration-fast … -slow    with --ease-out / --ease-in-out
--control-height-sm/md/lg  responds to density
```

### Themes

Three states, not two:

| User setting | `<html>` attribute | Resolved by |
| --- | --- | --- |
| System (default) | *nothing* | `@media (prefers-color-scheme: dark)` |
| Light | `data-theme="light"` | beats a dark OS |
| Dark | `data-theme="dark"` | beats a light OS |

Every token is declared in the bare `:root` first. Theme blocks **redefine,
never introduce** — a colour whose only definition sits inside a theme block
does not exist for system-setting users, which is most of them.

`appearanceBootScript` runs in `app/layout.tsx` before the first paint. Reading
the stored theme in an effect is always too late and flashes the wrong theme.

### Density

`data-density="compact" | "comfortable"` on `<html>` or any container. It moves
`--control-height-*`, `--row-padding-*` and `--control-font`, so the whole
screen changes together. A lab bench scanning forty results and a front desk
registering one patient want different row heights.

---

## Components

```ts
import { Button, Field, Input, Table, Dialog } from '@/components/ui';
```

### Button

```tsx
<Button intent="primary" size="md" loading={saving} onClick={save}>
  Save result
</Button>

<Button intent="dangerQuiet" icon={<RiArrowGoBackLine size={14} />}>
  Reverse payment
</Button>

{/* Icon-only requires a label. The types enforce it. */}
<Button aria-label="Close" icon={<RiCloseLine />} intent="ghost" />
```

Intents: `primary` `secondary` `ghost` `danger` `dangerQuiet` `link`.
`loading` disables the control and keeps the label's width so rows do not reflow.

### Field + controls

`Field` mints one id, wires `htmlFor`, `aria-describedby`, `aria-invalid` and
`required`, and announces the error with `role="alert"`. A control inside a
Field cannot be unlabelled.

```tsx
<Field label="Surname" required error={errors.surname} hint="As on the ID card">
  <Input value={surname} onChange={(e) => setSurname(e.target.value)} />
</Field>

<FieldRow>
  <Field label="Amount"><Input numeric prefix="₦" /></Field>
  <Field label="Department">
    <Select placeholder="Choose one">…</Select>
  </Field>
</FieldRow>
```

`Select` is the native element on purpose: on a clinic tablet the OS picker is
faster, more familiar, and works offline.

### Dialog

Built on Radix, so focus trapping, `Escape`, scroll lock, return-focus and
`inert` on the page behind all come for free.

```tsx
<Dialog
  open={open}
  onOpenChange={setOpen}
  title="Reverse this payment"        {/* required — never decoration */}
  description="₦12,000 from Amina Bello's wallet"
  size="sm"
  footer={<>
    <Button intent="ghost" onClick={() => setOpen(false)}>Cancel</Button>
    <Button intent="danger" onClick={reverse}>Reverse</Button>
  </>}
>
  …
</Dialog>
```

`variant="drawer"` anchors right. `dismissible={false}` only where closing would
lose work — never merely to insist on attention.

### Tabs

```tsx
<Tabs
  value={tab}
  onValueChange={setTab}
  ariaLabel="Reception sections"
  items={[
    { value: 'queue', label: 'Queue', count: waiting },
    { value: 'results', label: 'Results', count: unread, alert: true },
  ]}
>
  <TabPanel value="queue">…</TabPanel>
</Tabs>
```

Arrow keys move between tabs; only the selected tab is in the tab order.

### Table

```tsx
<Table
  caption="Patients waiting for lab results"
  rows={patients}
  rowKey={(p) => p.id}
  sort={sort}
  onSortChange={(key, direction) => setSort({ key, direction })}
  onRowClick={open}
  isRowCritical={(p) => p.hasUnacknowledgedCritical}
  empty={<EmptyState title="Nobody is waiting">…</EmptyState>}
  columns={[
    { key: 'name', header: 'Patient', render: (p) => p.name, sortable: true },
    { key: 'amount', header: 'Balance', numeric: true, render: (p) => fmt(p.balance) },
    { key: 'do', header: '', actions: true, headerLabel: 'Actions',
      render: (p) => <Button size="sm">Open</Button> },
  ]}
/>
```

Sticky header, `aria-sort` on the cell, keyboard-operable rows, tabular figures
in numeric columns, and an empty state that is part of the contract.

### Status marks

**Nothing here encodes meaning in colour alone.** The result grid this replaced
tinted a cell and printed a bare letter, which is invisible to a colour-blind
technologist, lost on a monochrome printout, and read aloud as "H".

```tsx
<Badge tone="success">Paid</Badge>
<StatusPill label="In progress" tone="accent" shape="pulse" />

<ResultFlag value="HH" />        {/* letter + word + colour + fill */}
<ResultDelta previous={4.2} current={11.8} unit="mmol/L" significant />
```

`ResultFlagValue` is `'' | 'H' | 'L' | 'HH' | 'LL'`. `HH`/`LL` are critical
values — a different kind of thing from abnormal, with their own thresholds and
a release interlock. The type keeps them from being conflated.

### Feedback

```tsx
<Alert tone="warning" title="Sync incomplete" live>
  3 results have not reached the cloud. They are safe on this machine.
</Alert>

<SkeletonRows rows={6} columns={[3, 2, 2, 1]} />   {/* shaped like the table */}

<EmptyState title="No tests added yet" action={<Button>Add a test</Button>}>
  Tests you add appear here and become billable at reception.
</EmptyState>

<ErrorBoundary area="wallet ledger">…</ErrorBoundary>
```

Wrap each independent region in its own `ErrorBoundary`, not the app. With none,
one throw in the ledger blanked the whole reception screen — including the queue
the receptionist was working from.

---

## Writing the words

- Name things the way the user does. A person manages **notifications**, not
  webhook config; their work is **saved**, not persisted.
- A control says what happens: "Publish" → "Published".
- An error says what went wrong **and what to do**. No apologies, no "an error
  occurred".
- Never surface the architecture. "Synced to Supabase Cloud" and `sync_stalled`
  are our vocabulary, not theirs.

---

## Accessibility floor

Non-negotiable, checked in CI:

- Every control has a label. Use `Field`, or pass `aria-label`.
- Focus is always visible. Never `outline: none` without a replacement ring.
- Colour is never the only channel. Add an icon, a word, or a shape.
- Every workflow completes with the mouse unplugged.
- Touch targets ≥44px in the tablet layout.
- Motion respects `prefers-reduced-motion`.
- Contrast: 4.5:1 body text, 3:1 large text and meaningful boundaries.

---

## Migrating an old screen

1. Delete its inline `style={{…}}` objects; reach for `components/ui` first.
2. Anything left that is genuinely one-off: a CSS module beside the component.
3. Swap legacy `var(--gray-*)` / `var(--teal-*)` for the semantic token they
   already resolve to. `styles/tokens.css` has the mapping at the bottom.
4. Run `npm run check:ui`, then `node scripts/check-tokens.mjs --update` to lock
   the gains in.
5. Check the screen in dark mode and at 390px wide before calling it done.
