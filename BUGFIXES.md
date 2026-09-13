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

## 2026-09-12

Two faults reported from the clinic, and everything found reading the code
around them. The two reports — "communication sent from lab to reception
disappears" and "managing staff throws *authentication required*" — each turned
out to be one line; the rest of this section is what an audit of the letterhead
editor, the printed report, the lab result form and the radiology templates
turned up on the way.

Released: **no**, for every entry in this section.

### A result released today never reached reception if the visit was older
`E-01`. Released: no.

The bench enters a result, is told **"result sent to reception ✓"**, and the
result never appears in reception's **Results ready**. Nothing on either screen
says why. It happens whenever the specimen was registered on an earlier day than
the one it is reported on — an afternoon culture read the next morning, an
outstanding test finished on Monday, anything held overnight.

Reception asked the database one question: *which patients were registered
inside the chosen date window*. That is the wrong question for a results list. A
result belongs to the day it was **released**, not the day the patient walked
in, so a report finished today for Friday's visit landed in a list that only
admits today's registrations. The bench's own screen had this right already —
it asks for work `completedSince` a moment — and the two had quietly disagreed
for as long as both have existed.

Reception now asks both questions and merges the answers
(`components/ReceptionPage.tsx`), and `selectCompletedPatients` decides
membership by `completedAt` rather than `registeredAt`
(`lib/store/useQueueStore.ts`). A patient found only by the second question is
re-read whole, so the card still shows the rest of the visit.

**Guard:** `useQueueStore.test.ts` — a result released today for a visit
registered six days ago appears under "Today"; an old result on a visit
registered today does not.

### The Results tab silently applied the department filter it does not show
`E-02`. Released: no.

A receptionist narrows the queue to **Radiology**, moves to **Results ready** to
print a blood count, and sees an empty list. The department control is hidden on
that tab — deliberately, a report is a report — but the filter was still being
applied, so there was no control on screen to explain the emptiness and nothing
to switch back.

`ResultsTab` now passes `'all'` (`components/features/queue/ResultsTab.tsx`).
The list matches the filters visible above it.

### Every attempt to change a colleague's role failed with "Authentication required"
`E-03`. Released: no.

An administrator changes someone's role, or removes them from the workspace, and
gets **"Authentication required"** every time. Nothing on the staff screen works.

`/api/staff/update` holds the Supabase service-role key, which bypasses every
row-level-security rule in the database, so it was correctly gated behind
`requireAdmin`. The guard went in; the two call sites did not. Both posted with
nothing but a `Content-Type`, so the request was refused before it was read.

Both now send the administrator's bearer token (`lib/authHeaders.ts`,
`app/[slug]/admin/staff/StaffScreen.tsx`), read live from the Supabase client
rather than from React state — an access token is short-lived, and a screen open
since the morning held an expired one. On a hub with no cloud session there is
no token and never will be, so the cloud call is skipped rather than made and
then reported as a failure over a local write that succeeded.

`ResultModal` emailed reports through the same kind of stale token; it reads live
now too.

**Guard:** `StaffScreen.test.tsx` asserts an `Authorization: Bearer` header on
both the role change and the removal.

### A "<" typed into a comment deleted the rest of the report
`E-04`. Released: no.

A technologist writes `Hb < 7.0 g/dL and falling` in the comment box. The browser
reads `<` as the start of a tag and swallows everything up to the next `>`, so
the comment — and however much of the report followed it — vanished from the
printed page, with nothing to show that anything was missing. Reference ranges
are the same shape by nature: `< 200`, `> 40`, `<1:80`.

Every value a person typed is now escaped on the way into the report
(`esc` in `lib/templates.ts`): results, units, ranges, comments, names,
specimens, organisms, antibiotics, the report title.

**Guard:** `templates.test.ts` prints a comment containing `<` and asserts the
signature block still follows it.

### The running footer printed over the last lines of the report
`E-05`. Released: no.

A letterhead footer overlapped the body text at the foot of every page.

The room for it was reserved by enlarging `@page margin-bottom`, which does not
do what it looks like it does: in paged media a `position: fixed` element is
placed against the *page area*, the box inside the page margins. Growing the
margin moved the bottom of the text column and the footer down together, and the
text still ran underneath. The page simply got shorter for nothing.

The room is now taken out of the flow, by the repeating `tfoot` spacer the
full-page background already used for its clear area, so the footer lands in a
strip no text can reach. The footer's height is measured with
`letterheadHeight` (`lib/letterheadStyles.ts`) instead of a regex matching one
exact serialiser output — an imported or older footer used to fall back to a
guess of 120px — and is capped, so a mis-measurement cannot hand half the page
away.

**Guard:** `templates.test.ts` asserts a 90px footer reserves 102px on every
page, and that the page margin is back to 15mm.

### A full-page letterhead frame sat 20mm lower on page two
`E-06`. Released: no.

The first page had no top margin so the letterhead could sit at the very top;
every page after it had 20mm. The background is a fixed layer anchored to the
page area, so it moved down with the margin and the printed frame stopped lining
up with the paper from page two onwards.

When a full-page background is in use every page now has the same geometry, and
the clear area at the top comes from the repeating spacer row, which is in the
flow and therefore honest.

### The signature sat on the right margin; section headings sat in the corner
`E-07`. Released: no.

Requested, and right: the signature closes the report at the extreme lower left
of the last page — where a signature is looked for on a clinical document, and
clear of the right-hand watermark or frame a full-page letterhead often carries.
It now also prints the releasing professional's title when there is one, and will
not break across a page.

The name of each investigation is the heading of its section, so it is centred
over the section it heads rather than tucked into the left corner of the blue
bar. Applied to the ordinary parameter block, the culture block, the Widal/MPs
block and the radiology block.

**Guard:** `templates.test.ts`.

### The letterhead editor printed its own placeholder on every report
`E-08`. Released: no.

Add a text box, do not type into it, save: **"Double-click to edit"** was
serialised into the letterhead and printed at the top of every report the clinic
issued. The box is still kept — deleting it behind the designer's back would be
worse — but it carries no words until someone types some.

### A phone photograph of a letterhead became a five-megabyte database row
`E-09`. Released: no.

Every picture in a letterhead is base64 inside one HTML column, read back on
every screen that renders a letterhead, embedded in every report printed,
emailed and shown in the patient portal, and pushed through the offline sync.
Nothing anywhere said no, and nothing said how big it had got.

Imports and logos are now bounded to 1600px on their longest side and
re-encoded (`MAX_IMAGE_PX` in `components/LetterheadDesigner.tsx`) — comfortably
2× what the 740px canvas needs at print resolution. The settings screen shows the
size once it passes 1.5 MB and refuses to save past 4 MB, naming what to do
about it.

### Everything else found in the letterhead editor
`E-10`. Released: no.

- **A picture the browser could not read did nothing at all.** No `onerror` on
  either the file read or the decode: no element, no message, nothing to try
  next. Logo picking now shares the one loader with the letterhead import, and
  says so when it cannot use what it was given.
- **`window.alert` on a failed import** — freezes the tab, cannot be styled or
  logged, and the rest of this app stopped using it deliberately. It goes
  through `Notices` like everything else.
- **A width of 0 typed into the inspector made an element unselectable** and a
  negative one inverted the box, so screen and paper disagreed. Dragging a
  corner had always stopped at 8px; typing did not. Every numeric field is now
  clamped to the same limits the drag uses.
- **Dragging an opacity or zoom slider re-serialised the whole design on every
  frame** — a megabyte of base64 rebuilt sixty times a second, which is what
  made the canvas unusable the moment a real letterhead was imported. The
  sliders hold the emit for the length of the drag, as a drag already did.
- **There was no way out of a text box but the mouse.** Escape now leaves it.
- **The canvas was mouse-only.** Nothing on it could be focused, so the
  arrow-key nudge, Delete, Ctrl+D and the whole inspector were unreachable
  without a click. Tab now walks the design in stacking order, Enter opens a
  text box, and focus selects.
- **Touch and pen did nothing.** The drag machinery listened for mouse events
  only; it is on pointer events now, so the canvas works on a tablet.
- **A drag that outlived the canvas threw** out of a window listener — a section
  switch mid-drag took the settings screen down with it.
- **"Remove footer" and "Remove background" threw a design away on one click**,
  with no warning. Both ask first.
- **The A4 preview was not showing what prints.** It drew the footer 6px from
  the paper edge rather than at the foot of the page area, and let the sample
  body run straight into it — the one thing it existed to show. It now reserves
  the same strip the printer does and draws it.

**Guard:** `LetterheadDesigner.test.tsx` covers the placeholder, the clamps and
the keyboard reach.

### The flag shown on the bench was not the flag that printed
`E-11`. Released: no.

The reference range has been read and the flag derived since the last overhaul —
but only for the screen. The row was saved with whatever the override dropdown
held, which is nothing unless someone touched it. A haemoglobin of 9.4 against a
range of 12–16 read **"L — Low"** on the bench and printed on the patient's
report with no flag at all.

What is seen is now what is stored, and what is stored is what prints
(`resolveFlags` in `components/features/department/ParameterTable.tsx`). A row
with no result is left unflagged: a blank line is not normal.

**Guard:** `DepartmentPage.test.tsx` asserts the derived `L` reaches the save
payload.

### There was no way to say a result was normal
`E-12`. Released: no.

Reported from the clinic: some investigations offer only **high** and **low**.

An in-range result derived an empty string, and an empty string was also what a
parameter whose range could not be read carried, and what an untouched dropdown
held. Three different facts — *this is normal*, *nothing is known about this*,
and *nobody has said* — wore the same value. So the Flag column on a panel with
unparseable ranges could only ever show H or L, and a technologist who wanted to
record "normal" had no way to record it.

`'N'` is now a flag in its own right (`lib/clinical/referenceRange.ts`),
offered in the override dropdown, shown in the Flag column and printed on the
report. `''` asserts nothing, and the screen-reader text for it says so
instead of claiming "within reference range". The critical tiers now print in
red and blue like H and L, having previously fallen through to plain black —
the one result on the page that has to be seen from across a desk looked like
every other.

### The comment box went out empty on almost every report
`E-13`. Released: no.

Requested. Writing the same sentence about the same panel forty times a day is
the first thing a busy bench stops doing, and what is lost is not decoration:
the comment is the only part of the report that says, in words, which values are
outside their range and which of them matter now.

The flags now write a draft into the comment box as results are entered
(`lib/clinical/autoComment.ts`). The rule is narrow on purpose:

- it reports what the flags say and nothing more — *"Haemoglobin 9.1 g/dL
  (reference 12-16) is low."* is a reading of the reference range;
  *"the patient is anaemic"* is a diagnosis, and this does not make diagnoses;
- critical values lead, and carry the line about informing the requesting
  clinician without delay;
- a parameter with no readable reference range is **named as not assessed**,
  never counted among the ones found to be normal;
- it fills an empty box and nothing else. The moment the technologist types a
  character of their own it is theirs, and the generated text is offered as a
  button — *replace* or *append* — rather than substituted. Nothing marks the
  comment as machine-written inside the text itself: that has no place on a
  document a patient keeps.

**Guard:** `autoComment.test.ts` (13 cases, including "offers no diagnosis") and
two cases in `DepartmentPage.test.tsx`.

### Radiology reports printed the word "IMPRESSION" twice
`E-14`. Released: no.

Reported. The impression prints inside a section headed **IMPRESSION /
CONCLUSION:**, and almost every template's own text began with the same word —
because that is how the impression is identified when a template is written or
imported. The word came out on the report twice, one line under the other, on
every scan report the centre issued.

Once the keyword has done its job of finding the section, it is removed from the
wording (`stripImpressionHeading` in `lib/radiology-templates.ts`). It is applied
at every point a template becomes an impression, so it covers the built-ins, the
custom ones, anything imported from a document, and anything added in future:

- `splitTemplateContent`, where an imported report is cut in two;
- applying a template on the radiology entry form, and the default template the
  form pre-fills;
- saving, importing or editing a custom template in the template manager, so the
  stored copy is clean from then on;
- and both report renderers, so results already saved with the duplicate print
  correctly too.

Only ever at the start of the text: a "conclusion" written inside a sentence is
a word the radiologist chose, not a heading.

**Guard:** `radiologyTemplates.test.ts` — the spellings in use, the HTML
wrappers an imported template puts round the word, that no built-in template
survives with a heading, and that the radiologist's own prose is untouched.

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
