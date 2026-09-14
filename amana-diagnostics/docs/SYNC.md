# How a hub and the cloud stay in step

Written 13 September 2026, after two findings from the clinics: that data
reached the cloud from a hub but not the other way, and that the app said
"offline" whenever it was on a hub, internet or no internet. This file is
the design that replaced both, and the rules that keep them replaced.
[REALTIME.md](REALTIME.md) is the companion: how a change reaches the *other
desk*; this is how it reaches the *other side*.

---

## Two words that are not the same

| Word | Question it answers | Decided by | Read through |
| --- | --- | --- | --- |
| **Mode** — `local` or `cloud` | *Where does this screen's data live?* A hub on the LAN, or Supabase directly. | Once per page load, from the server's answer (`/api/config`), else the hostname. | `getRuntimeMode()`, `isHubServer()` in `lib/runtimeMode.ts`; `useRuntimeMode()` in `lib/useRuntimeMode.ts` |
| **Connectivity** — `online`, `offline`, `signed_out` | *Can the hub reach the cloud right now, and as whom?* | The hub's sync engine, every run, from an actual request to the cloud. | `useSyncState()` in `lib/sync/useSyncState.ts` |

A hub is in local mode all day. It is online most of the day. These were
one variable in eight components, each with its own copy of the hostname
check, and half of them read "local" as "no internet": staff changes on a
hub were *skipped* ("the local write is the whole operation"), letterhead
edits fired a cloud update and swallowed its failure, and the only real
connectivity check in the app lived inside one browser tab's badge.

The rule now:

- **Nothing outside `lib/runtimeMode.ts` decides the mode.**
  `lib/runtimeMode.guard.test.ts` scans `app/`, `components/`, `lib/` and
  `pages/` and fails the suite on another copy — of the hostname check, of
  the `amana_local_mode` read, of the environment flag.
- **Nothing decides connectivity by itself.** Not from the mode, not from
  `navigator.onLine` (that is the laptop's Wi-Fi, not the hub's internet),
  not from a fetch of its own. The engine publishes one state; the badge,
  the boot screen and the event stream show it.
- **A screen on a hub never calls the cloud for a write.** It writes to the
  hub. The hub queues what the cloud needs (`queueSync`) and the engine
  sends it — now if online, later if not. A screen that wants to know
  whether that has happened reads the badge, like the receptionist does.

---

## The engine

`lib/sync/engine.ts`. One per hub process, started with the process
(`instrumentation.ts`), so a hub syncs with no browser open and before
anyone has signed in.

```
                     ┌──────────── hub process ─────────────┐
   LAN browsers      │                                       │        Supabase
   ──────────────    │  /api/*  ──▶ SQLite ──▶ sync_outbox   │
   write ──────────▶ │                │            │  bell   │
                     │                │            ▼         │
                     │   /api/sync ─▶ ENGINE  ◀── timer      │ ──push──▶ tables
   badge ◀── /api/events ◀── state   │      ◀── realtime ◀── │ ◀─events─ tables + tombstones
                     │                └─pull─▶ SQLite ──bell─▶│ ◀──pull── rows since cursor
                     └───────────────────────────────────────┘
```

**One run** is: ping (which also reads the cloud's clock), push the outbox,
pull every registered table, pull the tombstones, publish the state.

What makes it different from the browser-driven sync it replaced:

| Before | Now |
| --- | --- |
| Ran only while a tab with the badge was open. | Runs from process start. A hub PC with the browser closed overnight is current in the morning. |
| Every open tab ran its own copy every 15 s; five tabs raced over the same rows and cursors. | Single-flight. Requests that arrive during a run fold into exactly one run after it. |
| A push that stalled `return`ed before the pull. One row the cloud would not take meant nothing came *down* — this was the one-way sync. | Push then pull, unconditionally. The only thing that stops a pull is having nobody to act as. |
| Heard about cloud changes by polling. | Opens a realtime channel on every registered table, server-side, and pulls on any event. Poll is the floor, not the mechanism. |
| Rang the cloud every 15 s while offline. | Backs off, 15 s doubling to 2 min, while unreachable. |
| Acted as whichever browser last asked. | Acts as the service role if the hub has that key (unattended); else as the most recently signed-in browser, whose token every `useSyncState` hands over on mount, on change and every five minutes. |

**Credential.** Without a service-role key the hub can act only while some
staff browser is signed in. With one it syncs unattended. `.env.local` on
the hub decides; the launcher injects it into the process and never into a
browser.

**Clock.** Every hub write stamps `updated_at` with `hubNowIso()`
(`lib/sync/clock.ts`), which is the clinic PC's clock corrected by the
offset learned from the cloud's `Date` header on the last ping. Conflicts
are decided by comparing stamps, and both sides now write in the same clock
to one second. REALTIME.md item 5 fixed the cursor; this fixes the rule.

---

## The registry

`lib/sync/tables.ts`. One entry per table, in dependency order, and both
directions read it: the push converts JSON and boolean columns from it, the
pull builds its upsert from it.

| Table | Pulled by | Conflict | Notes |
| --- | --- | --- | --- |
| `organizations` | whole (by id) | cloud wins | |
| `profiles` | whole | cloud wins | A colleague missing from the clinic's set is detached locally (`organization_id = null`). They used to stay on the hub's staff list for ever. |
| `referring_facilities`, `referring_doctors` | `updated_at` cursor | newer wins | |
| `test_prices` | whole | cloud wins | A price missing from the set is deleted locally. |
| `custom_tests` | `updated_at` cursor | newer wins | composite key `(organization_id, id)` |
| `radiology_templates` | `updated_at` cursor | newer wins | |
| `patient_profiles`, `patients`, `patient_tests` | `updated_at` cursor | newer wins | |
| `billing_accounts` | `updated_at` cursor | newer wins | See *known limits*. |
| `billing_ledger_transactions`, `external_department_charges` | `created_at` cursor | cloud wins | Append-only. |
| `sync_tombstones` | `deleted_at` cursor | — | Applied as deletes. |

**Conflict rule, both directions.** A row is written only where the other
side's `updated_at` is not newer. The pull always did this; the push did
not — a result edited on a hub while offline overwrote a later web edit
the moment the hub reconnected. `conditionalUpdate` in `lib/sync/outbox.ts`
now applies an UPDATE only where the cloud's stamp is not newer, and if the
cloud's is newer, the hub's change is dropped and the cloud's row comes
down on the next pull.

**Deletes.** The cloud records a tombstone (`table_name`, `record_key`,
`deleted_at`) on every delete, by trigger. The hub pulls them by cursor and
deletes its copy — unless the copy was changed after the delete, in which
case the hub's edit is the newer fact and the push puts the row back. When
the delete wins, any outbox row for that record is dropped too, or the
push would resurrect it.

**A row the hub cannot write** (a foreign key the cloud never satisfied) is
set aside in `sync_pull_failures`, the rows after it still land, the cursor
moves on, and the row is fetched again by identity on later runs. After
`MAX_PULL_ATTEMPTS` it is reported ("Not fully synced") rather than retried
for ever — the pull's counterpart of the outbox's dead letters. Both are
put back by `/api/sync` with `action: 'requeue'`.

**Paging** is by keyset — `(stamp, key)` from the last row seen — not by
offset, and the cursor is inclusive. Both are ways the old pull lost rows.

**Whole-set reconciliation** happens only after a complete, successful
read of the set. A network blip cannot detach every colleague from the
clinic.

### Command rows

Some things only the cloud can do: changing a colleague's role touches the
auth service, not just a table. A hub queues those as outbox rows whose
`table_name` is `command:<route>` and whose payload is the request body;
the engine POSTs them to the cloud deployment under the current session.
They are independent of the table rows around them — a command waiting for
an administrator to sign in does not hold up a morning's results.

`/api/staff/hub` is the one such route today. It updates the hub's copy of
the profile and queues `command:api/staff/update`.

---

## What the cloud has to guarantee

`supabase_sync_integrity.sql`, once per project, safe to re-run. For every
registered table it installs:

1. **`updated_at`, always set.** `now()` on insert if the client sent
   nothing; on update, `now()` unless the client sent a stamp of its own
   that is not older than the row's. The web app updated referring doctors
   and patients without touching `updated_at`, so those edits were
   invisible to every hub — this was most of "the hub does not get the
   cloud's data".
2. **A tombstone on delete**, with the same `org:key` identity the outbox
   uses.
3. **Membership of the realtime publication**, so the engine hears the
   change as it happens.

Until it is applied, the pull still works for anything whose stamp moves,
and logs one line per run that deletes are not reaching the hub.

---

## Adding a table

1. Create it in `lib/localDb.ts`, same columns as the cloud, `updated_at TEXT`.
2. Add it to the list in `supabase_sync_integrity.sql` and run the file.
3. Append an entry to `SYNC_TABLES` in `lib/sync/tables.ts`, after every
   table it has a foreign key to.
4. On the hub, write to it through `queueSync`.

`lib/sync/tables.test.ts` fails if any of the four disagree: a table queued
but not registered, registered but not created, registered but not in the
migration, or a child registered before its parent.

## Adding a screen

- Need to know which back end you are on? `useRuntimeMode()`.
- Need to know whether the clinic is online? `useSyncState()` — and ask
  whether you really do. A screen that writes to the hub does not need to
  know; the engine does.
- Writing on a hub? Through the hub's API and `queueSync`. Never a
  Supabase call from a screen in local mode, and never "try the cloud too,
  ignore the error".
- Something only the cloud can do? A command row.

---

## Reading the badge

| Badge | Meaning | What to do |
| --- | --- | --- |
| **All changes saved** (lightning bolt) | Online, nothing waiting, and the hub is hearing cloud changes live. | Nothing. |
| **All changes saved** (cloud) | Online, nothing waiting, realtime channel not up; the hub is polling every 15 s. | Nothing urgent. If it never turns into the bolt, check that `supabase_sync_integrity.sql` has been run (it adds the tables to the publication). |
| **Saving · N** | N changes waiting; the hub is online and sending. | Wait. More than a minute means a row the cloud keeps refusing — the hover text says which. |
| **Offline · N waiting** | The hub cannot reach the cloud. Everything keeps working; N changes go up when it can. | Check the hub PC's internet. Nothing is lost. |
| **Sign in to sync · N waiting** | The hub could reach the cloud but has nobody to act as. | Any staff member signing in on any browser fixes it. Give the hub a service-role key and it never shows. |
| **Not fully synced** | Something needs a person: rows the cloud refused, cloud rows the hub could not write, or a table that could not be fetched. | Hover for detail. `POST /api/sync {action:'requeue'}` after the cause is fixed. |

Hub-side, `GET /api/sync` returns the whole state, including `lastError`,
`failedTables`, `clockOffsetMs`, `realtime` and `nextRunInMs`.

---

## Known limits

- **Wallet balances are last-writer-wins on the whole row.** A charge on
  the hub while offline and a deposit on the web in the same window: one of
  the two balance changes loses, whichever way the stamps fall. The ledger
  rows themselves are append-only and both survive, so the balance can be
  rebuilt from them; making the balance *derived* from the ledger rather
  than stored would remove the conflict. Schema change; not done here.
- **One clinic per hub.** The engine syncs the organisation the first
  browser told it about (persisted in `sync_metadata`). Two clinics on one
  hub would need one engine each.
- **The hub's session is in memory.** Without a service-role key, a hub
  restarted overnight waits for the first sign-in of the morning before it
  can act. A refresh token on disk would remove that wait; it is a
  security choice not made here.
- **Realtime needs a runtime with `WebSocket`.** Node 22+ has it. Where it
  is missing the engine says so once and polls.
