# Where the project stands

Plain-English status. Last updated **4 September 2026**.
For the technical detail behind any of this, see `amana-diagnostics/.agents/AGENTS.md`.

---

## The short version

The code has had a big tidy-up over the last few days. It is finished, tested, and
committed — but **none of it has been released to the clinic yet**. The live system
is still running the version from **6 July 2026** (v1.2.20) for the desktop app.

On 4 September the code was audited ahead of the architecture migration. It found
**fifteen defects that no test catches**, six of which could lose money or patient
records silently, plus one performance problem that got worse every day the system
ran.

**Nine of the fifteen are now fixed, along with the performance problem.** Six
remain open; three of those are waiting on a decision from you rather than on
work. The test suite went from 335 tests to 391 in the process.

None of it has reached the clinic. Four things need your attention, under **What
needs you** — the first is a database change that two of the fixes depend on.

---

## What the tidy-up was for

The app had grown three enormous files that did too much each. Big files are where
bugs hide: a change in one corner quietly breaks something in another, and nobody
notices until a receptionist does. The work split them into small pieces, each with
automated tests that run every time the code changes.

Concretely: the automated test suite went from **23 tests to 391**. Those tests now
catch mistakes before they reach you, rather than after.

Along the way it uncovered real bugs that were already live. Every one is logged in
[BUGFIXES.md](BUGFIXES.md); the ones you would notice:

| Bug | Status |
|---|---|
| Newly registered patients did not appear in the Patient Queue | Fixed, **not yet released** |
| Patient names showed blank on every queue card | Fixed, **not yet released** |
| Searching a patient by name never worked, for anyone | Fixed, **not yet released** |
| "Apply & Insert into Report" deleted the end of an obstetric scan report | Fixed, **not yet released** |
| Wallet charges could be lost if the internet dropped mid-payment | Attempted, rolled back — see below |
| Two people charging the same wallet at once could overspend the limit | Same as above |
| Wallet balances and payment records could go missing on a hub, silently | Fixed 4 Sep, **not yet released** |
| A day's offline work could be dropped if syncing hit a snag | Fixed 4 Sep, **not yet released** |
| Syncing could freeze completely with no way out but a developer | Fixed 4 Sep, **not yet released** |
| Two desks could be given the same slip number | Fixed 4 Sep, **needs the SQL applied** |
| Registration would eventually start failing with a database error | Fixed 4 Sep, **needs the SQL applied** |
| Every screen got slower every day the clinic stayed open | Fixed 4 Sep, **not yet released** |

---

## What is running right now

- **Registration works.** It is a little slower than before. That is expected and
  harmless: it now saves the patient in several small steps instead of one, so it
  makes a few more trips to the server. Nothing is at risk.
- **The wallet safety feature is switched off.** It was switched on last week, had a
  fault, and was removed again on 2 September. The system reverted to the way it has
  worked for the past two years. This is a safe, stable state to sit in.
- **Syncing is still the old version.** The three faults that could lose wallet
  data or freeze the queue are fixed in the code but not on any clinic machine.
  Until the next release, a hub that hits a network problem mid-sync can still
  quietly end up missing payment records.
- **The queue problems are fixed but not released.** Newly registered patients now
  appear instantly rather than after a page reload, and their names show. Neither
  reaches the clinic until the next release.

### Why the wallet feature was switched off

The database was given two new instructions to make wallet payments safer. One of
them was written incorrectly and stopped patient registration entirely. Removing the
two instructions restored registration immediately.

A corrected version exists in `supabase_wallet_atomicity.sql`, but **it has not been
tested against a real database**, and it should not be applied until it has been.
That file now ends with a set of checks that prove it works before you trust it, and
it documents how to switch it back off if anything goes wrong.

There is no hurry. The clinic ran without this feature for two years.

---

## What needs you

### 1. Apply the SQL, on staging first

`supabase_id_and_slip_integrity.sql` closes two defects that cannot be fixed in
the app alone: patient IDs that would eventually collide, and two front desks
being issued the same slip number. Nothing else in this work depends on it — if
it is not applied, the app keeps its old behaviour and writes a warning, so a
release cannot break registration by arriving first.

Two things before you run it:

- **It will refuse to build if the database already contains duplicate slip
  numbers.** That is the point. The file carries the query that finds them; settle
  those rows by hand first. Do not force it.
- **Read the VERIFY block at the end and actually run it.** It proves the counter
  started above the IDs already in use and that a duplicate slip is now refused.
  The ROLLBACK block undoes everything.

`supabase_wallet_atomicity.sql` from last week is still unapplied and still
untested against a real database. Treat these as two separate decisions — do not
apply both in one sitting.

### 2. Release this in three parts, not one

There is now a great deal sitting unreleased: the August tidy-up, the queue and
name fixes from 2 September, and nine defect fixes plus the performance work from
4 September. Shipping that as one release is exactly the shape of change that had
to be rolled back last week.

A sensible split, smallest and safest first:

| Release | What is in it | Why first |
|---|---|---|
| **v1.2.21** | The August tidy-up, the queue and name fixes, the pop-up and index changes | Already tested, no database change, and it is the batch that has been waiting longest |
| **v1.2.22** | The sync fixes (D-01, D-02, D-03, D-12, D-15) | Self-contained, no schema change on the cloud, and it is the one that stops silent data loss |
| **v1.2.23** | The performance work, then the ID and slip changes once the SQL is applied and verified | Touches the most screens, and the last part depends on a migration |

Each wants a real login and a few practice registrations on staging before it
goes to the front desk. Releasing is described in `RELEASE.md`.

### 3. Confirm D-07 against the live database

One open defect cannot be settled by reading code. Someone needs to look at
whether patients created through the wallet flow actually carry a registration
timestamp in the live database. If they do not, those patients are invisible in
every queue view. It is a two-minute check and it decides how serious that entry
is.

### 4. Decide who wins on D-10, and whether to schedule D-05 and D-11

Three open defects need a decision rather than a fix:

- **D-10** — when the hub and the cloud disagree about a test result, which one
  should win? Today wallet balances compare timestamps and test results simply
  take the cloud's copy. Nobody chose that.
- **D-05** — ghost patients from a half-filled wallet form. The fix is to check
  the whole form before saving anything, which changes how that modal behaves.
- **D-11** — schema changes that fail silently. The fix is a proper migration
  table, which is its own piece of work.

None are urgent this week. All get harder after the architecture migration moves
the code.

---

## Open defects — found 4 September 2026

A code audit ahead of the architecture migration found fifteen defects. **Nine
are now fixed** (logged in [BUGFIXES.md](BUGFIXES.md) under 4 September, none
released yet); six remain open and are listed at the end of this section.

They were found by reading the code, not by anyone reporting them. Worth knowing:
the test suite passed and the type checker was clean before any of this — every
defect below survived both. That is the point. These are the failures that only
show up with real data volume, a real network, or two people working at once.

Severity is about the clinic, not the code: **S1** = money or patient data can be
lost silently. **S2** = someone is blocked or sees the wrong thing. **S3** = it
will hurt later.

### Fixed — S1, silent loss of money or data

**D-01 · The hub could permanently skip wallet and ledger data** — FIXED
Sync kept one "last synced" clock for everything and moved it on at the end of
every run, including runs where the billing pulls had failed and been swallowed
into the log. One network blip and those wallet balances and payment records were
never asked for again. Each table now keeps its own place and only moves it when
that table's own pull worked. A run that did not finish now says so and names
what is behind, instead of showing a clean tick.

**D-02 · A failed sync row was deleted instead of retried** — FIXED
If the cloud said a table did not exist, the pending change was deleted and
counted as done. A row is now removed only once the cloud has accepted it.

**D-03 · One bad row blocked all syncing, forever** — FIXED
The queue stopped dead at the first row the cloud would not take, with no retry
count and no way past it. Rows now count their attempts; after five, one is set
aside and the rest of the queue drains past it. Set-aside rows are kept and
listed, and there is now a way to put them back once the cause is dealt with —
previously that needed a developer with a database tool.

**D-04 · Patient IDs were random and would have started colliding** — FIXED
IDs were drawn at random from 90 million values, which becomes more likely than
not to repeat at around 11,000 records. They now come from a counter, so each
number is handed out once. **Needs `supabase_id_and_slip_integrity.sql` applied**
— until then the old random IDs are used and a warning is logged, so a release
cannot break registration by arriving before the migration.

**D-06 · Two receptionists could be issued the same slip number** — FIXED
The number was worked out by counting today's registrations and adding one, so
two desks at the same moment got the same one — and it is what a wallet charge is
filed under. The database now refuses a duplicate and registration quietly takes
the next number. The printed format is unchanged. **Same SQL file as D-04.**

### Fixed — S2 and S3

**D-08 · One malformed result took down the whole queue** — FIXED
One corrupt stored result returned an error for every user. That test now comes
back empty; everyone else's work stays on screen.

**D-12 · Sync ran on top of itself** — FIXED
It fired every 15 seconds whether or not the last run had finished. It now
declines to start while one is in flight.

**D-13 · No database indexes existed at all** — FIXED
Every lookup was a full table scan. Indexes now cover the columns actually
filtered and sorted on.

**D-15 · The duplicated field-coercion block** — FIXED
Fifteen lines copied once for inserts and once for updates, so a new column could
be handled on one path only. Both now call the same function.

### Still open

**D-05 · Half-built wallet accounts leave ghost patients in the queue** — S1
`lib/store/useWalletStore.ts:236-280`
Opening a family wallet registers the owner, then each dependant one at a time,
and checks each dependant's details only when it reaches them. A blank surname on
the third throws after the owner and first two are already saved. The wallet is
never created, but three patients now sit in the queue owned by nobody. Retrying
creates three more. *Not fixed: the honest fix is to check the whole form before
writing anything, which is a change to how that modal works rather than a
one-line guard.*

**D-07 · Patients created through the wallet flow may be invisible in the queue** — S2
`lib/repositories/patients.ts` · `lib/store/useQueueStore.ts`
The registration used for wallet owners and dependants sets no registration
timestamp, and the queue drops any patient without one. It also creates no
patient profile, so the same person cannot later be found as a returning patient.
*Not fixed: needs someone to check the live database first — if the cloud column
has a default, only the profile half of this is real.*

**D-09 · The hub and the cloud build patient names differently** — S2
`app/api/patients/route.ts` vs `lib/store/patientName.ts`
The name-blank bug fixed on 2 September was fixed in one of the two places names
are assembled. They agree today, and nothing holds them together.

**D-10 · Two conflicting rules for who wins when cloud and hub disagree** — S2
`app/api/sync/route.ts`
Wallet accounts resolve conflicts by comparing timestamps. Patients and test
results simply take whatever the cloud last said, so a result typed on the hub can
be overwritten by an older cloud copy. Nobody chose this; the two halves were
written at different times. *Not fixed: which one should win is a decision about
the clinic's workflow, not a technical one.*

**D-11 · Schema changes fail silently** — S2
`lib/localDb.ts`
Around thirty schema updates run on every start-up, each wrapped so any error is
discarded. That is how "this column already exists" is handled — so a genuine
failure is handled the same way, silently, and the app then runs against a schema
it believes is correct. There is no record of which schema version a machine is
on. *Not fixed: wants a real migration table, which is its own piece of work.*

**D-14 · Errors are reported by browser pop-up** — S3
About seventy blocking `alert()` calls carry failure messages. They cannot be
styled, logged, or captured for support, and each freezes the tab until clicked.

---

## The performance problem — fixed

It was not many small inefficiencies. It was one decision repeated everywhere:
**every screen loaded the entire history of the clinic, then filtered it in the
browser.** The cost grew with how long the centre had been open rather than with
how busy today was, so the system got slower every day it ran and nothing in it
ever got faster.

What changed:

- **The date window is now part of the query.** The "Today / 7 days / 30 days"
  filter used to run in the browser after every patient ever registered had
  arrived. The database applies it now. The same function defines the boundary
  for both, so they cannot drift apart.
- **A department screen asks only for its own department's work.** It never read
  another department's tests, so nothing is lost — it simply stops downloading
  the whole clinic to show one bench's queue.
- **A burst of changes is now one reload.** Registering one patient with five
  tests produces roughly seven separate change events, and each used to trigger a
  full reload on every open screen in the building. They arrive as one.
- **The hub polls a cheap stamp instead of the whole queue.** It had no live
  updates and simply re-fetched everything every five seconds, per screen,
  forever. It now asks a small question and only reloads when the answer changes.
- **The login context stopped re-rendering every screen** on every render.
- **The hub loads only the tests belonging to the patients it selected**, rather
  than every test in the organisation to attach a handful of them.

One thing deliberately *not* bounded by date: the wallet screens. They look up
account owners, members and past visits, and a family member seen six months ago
must still be found. Those load by account rather than by date, and the two
patient-search boxes in the wallet modal now search the database instead of
filtering whatever the queue happens to be holding.

---

## Lehman's second and fifth laws — what they ask of this project

Two of Lehman's laws of software evolution are worth naming, because the defect
list above is a textbook illustration of both.

**The second law — increasing complexity.** As a system changes, its complexity
rises unless deliberate work is done to hold it down. Left alone, structure
decays. The evidence here was direct: two ways to build a patient's name (D-09),
two conflict rules in one function (D-10), the same coercion block copied twice
(D-15), thirty undifferentiated migrations with no version (D-11). None of these
were decisions. Each was the cheapest next edit, and together they are why the
same bug keeps coming back somewhere new. Two of the four are now fixed; the
other two are still open, and that is the point — what the law asks for is that
reducing complexity becomes *scheduled work with its own budget*, not something
done when it happens to be convenient.

**The fifth law — conservation of familiarity.** The amount of change a system can
absorb per release is roughly constant, and exceeding it costs you in defects. The
evidence is also direct: the wallet feature was released as one large change and
had to be rolled back within days. The pending release is shaped the same way, and
this work has just added to it. What the law asks for is smaller, more frequent
releases at a steady size, rather than one large one after a long quiet period —
which is why the release plan below splits this into three.

Both are addressed by the same discipline: a fixed share of each cycle spent on
structure, and releases kept small enough that the clinic can absorb them.

---

## Still open from before

- `ReceptionPage.tsx` is still around 2,200 lines and could get the same
  treatment the other two files got.
- The report generator writes the expected delivery date at the end of an
  obstetric report instead of replacing the line already there. Recorded and
  understood, but deliberately left alone — deciding the correct behaviour is a
  clinical judgement, not a technical one.

---

## Use-case audit — 5 September 2026

Every action every role can take, walked through the code, is in
[USE-CASE-AUDIT.md](USE-CASE-AUDIT.md). The clinical workflow is sound. The
authorisation layer is not: **three server routes let an unauthenticated caller
act as an administrator of any clinic**, and no page in the app checks the
signed-in user's role. Sixteen findings, numbered U-01 to U-16. None fixed.

---

## Bug history

Bugs found **and fixed** are logged in [BUGFIXES.md](BUGFIXES.md), newest first —
what you would have seen, what caused it, and whether it has reached the clinic
yet. Bugs found and **not yet fixed** are under "Still open" above.
