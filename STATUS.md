# Where the project stands

Plain-English status. Last updated **2 September 2026**.
For the technical detail behind any of this, see `amana-diagnostics/.agents/AGENTS.md`.

---

## The short version

The code has had a big tidy-up over the last few days. It is finished, tested, and
committed — but **none of it has been released to the clinic yet**. The live system
is still running the version from **6 July 2026** (v1.2.20) for the desktop app.

Two things need your attention. They are listed at the bottom.

---

## What the tidy-up was for

The app had grown three enormous files that did too much each. Big files are where
bugs hide: a change in one corner quietly breaks something in another, and nobody
notices until a receptionist does. The work split them into small pieces, each with
automated tests that run every time the code changes.

Concretely: the automated test suite went from **23 tests to 328**. Those tests now
catch mistakes before they reach you, rather than after.

Along the way the tidy-up uncovered four real bugs that were already live:

| Bug | Status |
|---|---|
| Newly registered patients did not appear in the Patient Queue | Fixed in the code, **not yet released** |
| Wallet charges could be lost if the internet dropped mid-payment | Fixed, then rolled back — see below |
| Two people charging the same wallet at once could overspend the limit | Same as above |
| "Apply & Insert into Report" deleted the end of an obstetric scan report | Fixed in the code, **not yet released** |

---

## What is running right now

- **Registration works.** It is a little slower than before. That is expected and
  harmless: it now saves the patient in several small steps instead of one, so it
  makes a few more trips to the server. Nothing is at risk.
- **The wallet safety feature is switched off.** It was switched on last week, had a
  fault, and was removed again on 2 September. The system reverted to the way it has
  worked for the past two years. This is a safe, stable state to sit in.
- **The queue problem is still there**, because the fix has not been released.

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

### 1. Decide when to release the tidy-up

Everything described above is finished and sitting in the repository. Until it is
released, the clinic sees none of it — including the queue fix and the report fix.

Releasing is described in `RELEASE.md`: bump the version number in four files, commit,
tag it `v1.2.21`, and push the tag. That triggers the build automatically.

**Test it on staging first.** This release changes a lot at once. It should be given a
real login and a few practice registrations before it reaches the front desk.

### 2. The queue problem needs one look at the data

Registered patients still do not appear in the queue. The fix for the known cause is
in the code but unreleased, so that may be the whole story — or there may be a second
cause. A single, read-only check will tell us which. It is written out in the
conversation; it only reads, it changes nothing.

---

## Not started

- `ReceptionPage.tsx` is still large (2188 lines) and could get the same treatment
  the other two files got. Not urgent.
- The report generator has a second known quirk: it writes the expected delivery date
  at the end of an obstetric report instead of replacing the line already there. It
  is recorded and understood, but deliberately left alone — deciding the correct
  behaviour is a clinical judgement, not a technical one.
