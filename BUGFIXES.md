# Bugs found and fixed

A running log. Newest first. Each entry says what a user would have seen, what
actually caused it, and where the guard against it now lives.

Two conventions:

- **"Released?"** means *has this reached the clinic*. The last release tag is
  `v1.2.20` (6 July 2026), so everything below is unreleased on the desktop app.
  The web build tracks `main` and gets fixes as they are pushed.
- Anything marked **self-inflicted** was introduced during this refactor, not
  found in the original code. They are listed with everything else on purpose.

---

## 2026-09-04

Nine defects from the pre-migration audit, fixed together. All were found by
reading the code rather than by anyone reporting them, and all of them survived
a passing test suite and a clean type check — which is why each entry below
names the test that would now catch it.

Released: **no**, for every entry in this section.

### The hub could permanently skip wallet and ledger data from the cloud
`D-01`. Released: no.

Wallet balances and payment records could quietly go missing on a hub, with
nothing on screen to say so.

Sync kept one "last synced" timestamp for the whole organisation and advanced it
at the end of every run — including runs where the billing pulls had failed and
been swallowed with a line in the log. Any row that failed to arrive during that
one attempt was never asked for again. A single network blip was enough.

Each table now keeps its own cursor (`lib/sync/cursors.ts`) and moves it only
when that table's own pull succeeded. A table that fails is merely behind, and
catches up next time. The sync result now reports `partial_sync` and names the
tables that are behind, instead of showing a clean tick over a run that did not
finish.

**Guard:** `cursors.test.ts` asserts one table advancing leaves the others where
they were.

### A failed sync row was deleted instead of retried
`D-02`. Released: no.

If the cloud reported that a table did not exist, the pending local change was
deleted from the outbox and treated as done. That change was gone — the
mechanism that would silently drop a whole day's offline work if a table were
renamed or a migration half-applied.

A row is now deleted only once the cloud has accepted it. There is exactly one
`DELETE`, on the success path.

**Guard:** `outbox.test.ts` sends a row that the cloud refuses and asserts it is
still there afterwards.

### One bad row blocked all syncing, forever, with no alarm
`D-03`. Released: no.

The outbox was processed in order and stopped dead at the first row that failed.
There was no retry counter and no way to set a poisoned row aside, so one
permanently-unacceptable record froze every later change indefinitely. The
screen said "sync stalled" with a number and offered no way out.

Rows now carry an attempt count. A transient failure still stops the run — order
matters, because a patient must reach the cloud before their tests do — but after
five attempts a row is set aside and the queue drains past it. Set-aside rows are
kept, not deleted, are reported by `GET /api/sync`, and can be put back with
`POST /api/sync {action:'requeueDeadLetters'}` once whatever the cloud objected
to has been dealt with.

**Guard:** `outbox.test.ts` covers all three: deleted only on success, stalls
rather than skipping, and sets aside after the limit so later rows still go up.

### Patient IDs were random and would have started colliding
`D-04`. Released: no.

IDs for both patients and patient profiles were drawn at random from 90 million
values. By the ordinary birthday maths a repeat becomes more likely than not at
around 11,000 records, and every registration brought it closer. A collision
would have surfaced as an unreadable primary-key error in front of a waiting
patient.

The on-premise hub already allocated sequentially (`lib/idGenerator.ts`); only
the cloud drew at random. IDs now come from a counter in the database, seeded
above whatever is already in use, via `allocate_numeric_id` in
`supabase_id_and_slip_integrity.sql`.

If that function has not been applied yet the old random ID is used and a warning
is logged, so an app release cannot outrun the migration — the same guard the
wallet functions use.

**Guard:** `patientIds.test.ts` and `patients.test.ts` assert the IDs are
reserved before anything is written, that the reserved ID is what gets stored,
and that a returning patient does not burn a profile ID.

### Two receptionists could be issued the same slip number
`D-06`. Released: no.

The next slip number was worked out by counting today's registrations and adding
one, so two front desks registering in the same moment both arrived at the same
number. The slip number is also what a wallet charge is filed under, so the
collision reached the ledger.

The database now refuses a duplicate outright — a unique index on
`(organization_id, slip_number)` in both SQLite and Postgres. Registration takes
the next number and tries again rather than failing at the desk. The hub settles
the number inside its write lock and hands back the one it actually recorded, so
the slip that gets printed matches the row.

On the non-atomic fallback path the retry deliberately wraps the patient insert
alone: the wallet has already been debited by that point, and re-running the
whole registration would charge the patient twice.

**Guard:** `patientIds.test.ts` covers the retry, the give-up limit, and not
retrying unrelated failures. `patients.test.ts` asserts the printed slip is the
recorded one and that a retry does not burn a second ID.

**Note:** the unique index will refuse to build on a database that already
contains duplicates. Both the SQL file and the SQLite path log the query that
finds them. Settle those rows before applying.

### One malformed result blob took down the whole queue
`D-08`. Released: no.

Every stored result was decoded with no guard as the patient list was built, so
one corrupt value — from an interrupted write, a failed sync, a restored backup —
returned an error for every user, not just for that one patient.

That test now comes back with empty results and a line in the log; everyone
else's work stays on screen.

**Guard:** covered by `parseResults` returning `[]` on unreadable input.

### Sync ran on top of itself, once per open tab
`D-12`. Released: no.

Sync fired every 15 seconds whether or not the previous run had finished, so a
slow run overlapped the next and the two raced each other over the same outbox
rows. A run now declines to start while one is in flight.

### The local database had no indexes at all
`D-13`. Released: no.

Not one index existed. Every lookup by clinic, every lookup of a patient's tests
and every ordering by registration date was a full table scan — invisible at a
few thousand rows, dominant at a few hundred thousand. Indexes now cover exactly
the columns the queries filter and sort on.

### The duplicated field-coercion block in sync
`D-15`. Released: no.

The same fifteen lines converting booleans and decoding JSON appeared twice, once
for updates and once for inserts, so a column added to one branch and not the
other produced a bug that showed up only on updates or only on inserts. Both now
call `toRemotePayload` (`lib/sync/outboxPayload.ts`).

It also no longer modifies the caller's row, which matters now that a failed row
is retried rather than discarded, and an unparseable JSON column is left alone
for the database to reject rather than throwing away the whole sync run.

**Guard:** `cursors.test.ts` asserts both actions convert identically and that
the queued row is left untouched.

---

## 2026-09-02

### Registration rejected: "Could not find the 'name' column of 'patients'"
**Self-inflicted.** `6cbe6f5` fixes `3e0b831`. Released: no.

Registration failed outright for every patient.

`patients` has no `name` column. The insert had just been changed to write one,
on the strength of `update()` containing `name: updates.name`. That line was
never proof — it only appeared to work because `updates.name` is normally
undefined, and undefined keys are dropped before the request is sent. A broken
write had been sitting there unnoticed.

The name is now derived at read time from first/middle/surname
(`lib/store/patientName.ts`) and never stored.

**Guard:** `patients.test.ts` asserts the insert payload contains no `name` key.

**Rule learned:** code that writes to a column is not evidence the column exists.

### Patients had no name in the queue, and could not be searched for
`3e0b831`. Released: no.

Every patient card showed a blank where the name should be, and typing a name
into the search box matched nothing — for any patient, ever.

Both the card and the search read `patient.name`, which is not a column and is
therefore always empty. Both now use `patientDisplayName`.

**Guard:** `QueueTab.test.tsx` renders and searches a patient carrying only the
name parts, which is what every real row looks like.

### A newly registered patient only appeared after a page reload
`3e0b831`. Released: no.

Registration saved the patient, printed the slip, cleared the form — and told
the queue nothing. The list only updated if the Supabase realtime channel
happened to deliver. When it didn't, the receptionist had to reload the page.

`addWithReferral` now returns the new id, and registration hands the patient
straight to the queue from data already in hand. No network round trip.

### Queue cards read "35yrs ? Male"
`3e0b831`. Released: no.

A literal `?` where the `•` separator should be, lost to an encoding slip during
an earlier extraction. Cosmetic, but on every card.

### Wallet functions destroyed column defaults, stopping registration
**Self-inflicted.** `fba4af1` fixes `a17b464`. Released: n/a — the functions were
dropped from the database the same day.

Registration failed with "null value in column created_at of relation
patient_profiles violates not-null constraint".

`insert into T select * from jsonb_populate_record(null::T, p_row)` materialises
*every* column of `T`, filling absent ones with NULL — and an explicit NULL
overrides a column DEFAULT. The client deliberately omits `created_at` because
the column has one. PostgREST never behaved this way.

Each insert now builds its column list from the keys actually present. **The
corrected SQL has never been run against Postgres** and both functions remain
dropped; the client is on its non-atomic fallback.

**Guard:** AGENTS.md §8, and a VERIFY block in `supabase_wallet_atomicity.sql`
that reproduces the exact failure inside a rolled-back transaction.

---

## 2026-09-01

### "Apply & Insert into Report" deleted the end of an obstetric report
`b957661`. Released: no.

Pressing it on a template-prefilled obstetric scan silently dropped everything
after the biometry line — the expected delivery date and the foetal weight — and
left an unclosed `</p>`. A 625-character report came back as 509.

The rich-text editor stores reports as HTML with **no newline characters at
all**, but the replacement used `[^\n]*` to mean "the rest of the line". Against
HTML that matches to the end of the document. Now `[^\n<]*`.

**Guard:** `lib/store/obstetrics.test.ts` runs a real template through the real
converter. Every hand-written plain-text fixture passed while this was live.

**Still open, deliberately:** the same converter upper-cases labels, so the
`Expected date of delivery` branch never matches an HTML report and the delivery
date is appended after the closing tag rather than replacing the line already
there. Deciding the correct behaviour is a clinical judgement.

### A freshly registered patient was counted but never listed
`ebdb11a`. Released: no.

The "Patient Queue" badge counted the patient; the list underneath stayed empty.
Reception had to wait for a department to pick up a test before the patient
appeared at all — despite the empty state reading "Register a patient to get
started".

**Self-inflicted by an earlier extraction:** the badge used
`some(status !== 'completed')` while the extracted list used
`some(status === 'in_progress')`. Both now call the same selector.

### Tab badge counts ignored the selected date window
`d7b8d59`. Released: no.

Switching the queue to "Last 7 days" changed the list but not the number on the
tab, which stayed pinned to today. The `dateFilter` setter was never called —
the extraction had copied the state instead of moving it, so the page held a
second, frozen copy.

Invisible to the compiler: replacing it with `const dateFilter = 'today'` still
compiled cleanly.

### Two Quick Register buttons rendered nowhere
`142fbc8`. Released: no.

**Self-inflicted by an earlier extraction.** The rewritten `Field` helper stopped
forwarding its `actionNode` prop, so both buttons vanished; and the modals they
opened had never been carried over, so the state they set rendered nothing.

Alongside: five `setForm(prev => ...)` calls against a Zustand `Partial` setter
(silent no-ops) and a call to a `setDiscountValue` that no longer existed.

**Rule learned:** AGENTS.md §5, "Extraction Hazard" — never type an extracted
component's props as `any`; the props interface is what makes these fail loudly.

---

## Standing hazards

Recorded so they are not rediscovered the hard way. Full detail in
`amana-diagnostics/.agents/AGENTS.md`.

| Hazard | Where |
|---|---|
| An explicit NULL overrides a column DEFAULT | §8 |
| Report text is HTML with no newlines — never match `[^\n]*` | §9 |
| Extractions break silently unless props are typed | §5 |
| Functional `setState` updates compose; `onChange({...value})` does not | §5 |
| Money-moving writes must commit as one transaction | §8 |
| No agent in this environment can execute SQL — it is unverified until a human runs it | §8 |
