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
