# Use-case audit — 5 September 2026

Every action every role can take, walked through the code and checked.

**The short answer to "is everything going well": no.** Most of the clinical
workflow is sound. The way the system decides *who is allowed to do what* is
not — and three server routes let anyone on the internet act as an administrator
of any clinic.

This is a review of the code as it stands on `main`. Nothing here is fixed
except where it says so.

---

## How to read this

Each use case is marked:

- **OK** — walked through, behaves correctly.
- **DEFECT** — it does the wrong thing, or does nothing when it should do
  something.
- **GAP** — the action a person needs to take is not supported at all.

New findings are numbered **U-01** onward, to keep them apart from the D-numbers
in [STATUS.md](STATUS.md).

Severity is about the clinic: **S0** = anyone outside the clinic can cause harm.
**S1** = money, patient data or the medical record can be lost or falsified.
**S2** = someone is blocked or shown the wrong thing. **S3** = it will hurt later.

---

## Roles in the system

| Role | Where they work |
|---|---|
| `reception` | Registration, patient queue, results handout, wallets and billing |
| `lab` / `lab_tech` | Lab bench — result entry |
| `radiology` | Radiology bench — report entry |
| `admin` | All of the above, plus staff, referrals, pricing, custom tests, settings |
| *patient* | Separate portal, email + one-time code, reads their own results |

---

## The headline finding: nothing checks who you are

**U-01 · Any signed-in user can open any screen** — S1
No page in the app checks the signed-in user's role. There is no middleware, and
`app/[slug]/admin/*` pages read `organization` from the session but never
`profile.role`.

A lab technician who types `/amana/admin/staff` into the address bar gets the
staff management screen and can change roles and remove colleagues. The same
applies to referral commissions (what every doctor is owed), pricing, and
organisation settings.

The role is used only to decide *where to send you after login*
(`getWorkspacePath`), never to decide *what you may open*.

**U-02 · Three server routes act as an administrator for anyone who asks** — S0

These have no authentication of any kind, use the Supabase **service role key**
(which bypasses every row-level security rule), and are part of the cloud
deployment — not hub-only. I confirmed they carry no runtime-mode gate and
appear in the production build.

| Route | What an unauthenticated caller can do |
|---|---|
| `POST /api/staff/update` | Set any user's role to `admin`, or remove any user from their organisation. Takes a `staffId` and a `role`. No session, no organisation check — a caller can target a user in a **different clinic**. |
| `POST /api/auth/profile` | Upsert **any** profile row by `userId`, with arbitrary contents — including `role` and `organization_id`. Grants yourself administrator of any clinic. |
| `POST /api/send-result` | Send an arbitrary PDF attachment to an arbitrary email address from the clinic's verified sender, and have the server fetch arbitrary URLs (`fetchImageAsBase64`) on the caller's behalf. |

`/api/send-result` deserves separate mention: the recipient (`patient.email`),
the attachment (`pdfBase64`), and the fetched image URLs all come straight from
the request body. It is an open mail relay wearing the clinic's identity, plus a
server-side request forgery into whatever network the server sits on.

**U-03 · `GET /api/diagnostic` is public and reports on the server's keys** — S3
Returns whether the service-role key is present, what role it carries, and
whether it is identical to the anon key. It does not leak the key, but it is a
public confirmation of the server's configuration. There is no reason for it to
be reachable without authentication.

---

## Reception

### Register a patient
| Use case | Verdict |
|---|---|
| Fill the form, pick tests, register | **OK** — required fields validated; a referring doctor *or* facility is required |
| Slip number issued and printed | **OK** since D-06 was fixed; the hub settles the number under its write lock and returns the one it recorded |
| New patient appears in the queue at once | **OK** |
| Registration is one transaction | **OK** where the wallet SQL is applied; the documented fallback is not atomic and says so |

**U-04 · A returning patient's details can never be corrected** — S2, **GAP**
Nothing in the codebase ever runs an `UPDATE` on `patient_profiles`. It is
insert-only. The permanent record is what "returning patient" lookup prefills
from (`handleSelectProfile` reads `p.firstName`, `p.phone`, `p.email`, …).

So a name, phone number or email typed wrongly at a patient's first visit is
wrong forever, and is re-applied on every subsequent visit. Admin → Patients →
Edit looks like the fix, but it writes only to the visit row — the correction
lasts one visit and then the old value returns.

The email matters most: the patient portal identifies people by email, so a
mistyped address means either the patient can never see their results, or
someone else can.

### The patient queue and results
| Use case | Verdict |
|---|---|
| See today's queue, switch to 7 / 30 days | **OK** |
| Search by name or slip number | **OK** |
| See results as they come back from the bench | **OK** |
| Print or email a report | **OK** functionally — but see U-02 for the route it calls, and U-09 |

**U-05 · Two reports generated at the same moment can be crossed** — S1
`convertHtmlToPdfUsingChrome` names its temporary files from
`Math.random().toString(36).substring(7)`. That is a handful of characters, and
for some values of `Math.random()` it is the **empty string** — giving every
concurrent request the identical path `report-.html`. Two receptionists printing
at the same time can have one report's HTML overwritten by the other's, and the
wrong patient's results emailed out. Low probability, severe consequence, and it
is a one-line fix (`crypto.randomUUID()`).

### Wallets and billing
| Use case | Verdict |
|---|---|
| Open a wallet for a patient or family | **DEFECT** — see D-05 in STATUS.md (ghost patients), still open |
| Find a patient to put on a wallet | **OK** — now searched in the database, not in the on-screen queue |
| Charge a visit to a wallet | **OK** where the wallet SQL is applied |
| Log a department charge against a wallet | **OK** where the wallet SQL is applied |
| Change a credit limit | **OK** |
| View and print a ledger statement | **OK** |

**U-06 · Taking a deposit can silently lose money** — S1
`deposit` reads the balance, adds the amount, and writes it back — with no lock,
on **both** the hub and the cloud. Two deposits at the same moment leave only
one of them; the other is gone from the balance while still appearing in the
ledger.

The atomicity work covered registration and department charges. It did not cover
deposits: `supabase_wallet_atomicity.sql` defines only
`register_patient_with_wallet` and `log_external_department_charge`. On the hub,
`action === 'deposit'` is the only money-moving handler that never opens a
transaction — the balance update and the ledger entry are separate writes, so a
crash between them moves money with no record of why.

**U-07 · Amounts are only checked in the browser** — S2
`amount <= 0` is rejected in the modal. The hub API accepts whatever it is given
and puts it straight into arithmetic. Nothing server-side rejects a negative
deposit, a non-numeric amount, or an absurd one.

**U-08 · There is no way to reverse a mistaken charge** — S2, **GAP**
The ledger supports `deposit` and `charge`. If a receptionist charges the wrong
wallet — an easy mistake on a family account — there is no reversal, correction
or void. The only route is a compensating deposit with an explanatory note,
which leaves the original wrong charge standing in the patient's statement.

---

## Lab and radiology

| Use case | Verdict |
|---|---|
| See this bench's outstanding work | **OK** |
| Open a test, enter results, save | **OK** |
| Structured entry for MCS / Widal / MPs | **OK** |
| Radiology templates and free text | **OK** |
| Result reaches reception immediately | **OK** |
| Alerts for newly arrived tests | **OK** |

**U-09 · The name signed on a result is free text** — S1
`professional` is pre-filled from the signed-in user's profile but stays
editable, and it is what gets stored as `completed_by` and printed on the
report. The **signature image** beside it comes from the signed-in profile
(`profile.signature_url`).

So a technician can type a colleague's — or a doctor's — name as the person who
authorised a result, and the report will show that name against their own
signature. On a clinical document that is a record-integrity problem, not a
cosmetic one. It is also the field the performance report attributes work by.

**U-10 · Abandoning a half-entered result under-counts the bench's workload** — S2
Opening a test immediately sets it to `in_progress`. Closing the modal without
saving leaves it that way — correctly shown as "In Progress · Continue" in the
list, which is good. But `pendingCount`, the number on the tab badge and the
"Pending" statistic, counts only `status === 'pending'`. A test that someone
opened and walked away from disappears from the count of outstanding work while
still being outstanding.

**U-11 · Nothing stops a completed result being changed** — S2
There is no lock, no confirmation, and no record of amendment once a result has
been signed and sent to reception. For a diagnostic report that has already been
handed to a patient, an amendment should at minimum be visible as one.

---

## Admin

| Use case | Verdict |
|---|---|
| Invite a staff member by email | **OK** — token, expiry, single use |
| Change a staff member's role | **OK in the UI** — but see U-01 and U-02 |
| Remove a staff member | **OK in the UI** — same caveats |
| Manage referring doctors and facilities | **OK** |
| Set test prices and commission rates | **OK** |
| Mark commissions paid / unpaid | **OK** |
| Create and edit custom tests | **OK** |
| Edit a patient record | **DEFECT** — see U-04; the correction lasts one visit |
| Set the letterhead | **DEFECT** — see U-13 |

**U-12 · Invitation acceptance breaks past 50 users** — S2
`/api/invite/accept` calls `supabaseAdmin.auth.admin.listUsers()` with no
pagination and then searches the result for the invited email. That call returns
the **first page only** — 50 users by default, across every organisation in the
project, not just this clinic.

Once the project passes 50 users, an existing person accepting a new invitation
will not be found, the code takes the "create new user" branch, and the creation
fails because the email is already registered. The invite becomes unacceptable
with a confusing error. This gets worse with every clinic onboarded.

The same handler also updates `accepted_at` only *after* creating the user, and
only logs a failure — so two requests racing on one token both pass the
"already accepted" check.

**U-13 · The letterhead is rendered as raw HTML and is never sanitised** — S1
`cleanLetterhead` is a whitespace tidier. It strips trailing empty tags. It does
nothing about `<script>`, `onerror=`, or `javascript:` URLs — and the result
goes through `dangerouslySetInnerHTML` in the settings preview and is injected
into every report template.

That HTML then reaches:

- every staff member who views or prints a report,
- **every patient**, through `/api/portal/render/[patientId]`,
- emailed reports,
- and headless Chrome in `send-result`, which is run with `--no-sandbox` against
  a `file://` URL. A script there can read local files on the hub and send them
  out.

Combined with U-01 (no role checks) and the permissive `organizations` update
policy, the person who sets this need not be an administrator, and need not be
in that clinic.

The same 20-line "cleaning" block is copied into both
`app/[slug]/admin/settings/page.tsx` and `lib/templates.ts` — another instance of
the duplication pattern in D-09/D-15.

---

## Patient portal

| Use case | Verdict |
|---|---|
| Request a one-time code by email | **DEFECT** — U-14, U-15 |
| Sign in with the code | **DEFECT** — U-14 |
| See only your own results | **OK** — correctly scoped by `getPatientByIdAndEmail` |
| Download or email your report | **OK** |

**U-14 · The one-time code can be brute-forced** — S1
`PUT /api/portal/otp` verifies a 6-digit code with **no attempt counter, no
lockout and no rate limit**. The check is stateless — the same `state` token can
be submitted with a different code as many times as you like inside the ten
minute window, and there is no limit on requesting fresh codes either.

A million possibilities with no throttle is not a meaningful barrier, and what it
protects is a patient's diagnostic results.

Two things make it worse: the code comes from `Math.random()` rather than a
cryptographic source, and the session it issues lasts **30 days** with no way to
revoke it — the token is stateless, so there is no logout that actually invalidates
anything.

**U-15 · The anti-enumeration measure does not work** — S3
The handler deliberately returns success for an unknown email, with the comment
*"don't reveal if email exists — return success to prevent enumeration"*. But it
returns the `state` token **only** when the patient exists. The two responses are
trivially distinguishable, so the protection is defeated by the next line of the
same function.

**U-16 · A hardcoded fallback signing secret** — S2
If reading the secret from the hub database fails, `getJwtSecret` falls back to
the literal `'amana-diagnostics-local-fallback-secret-2026'`. Every hub that hits
that path shares one signing key, so a portal token minted on any of them is
valid on all of them.

---

## Sign-up, onboarding and login

| Use case | Verdict |
|---|---|
| Create a clinic and an admin account | **OK** |
| Sign in | **OK** |
| Accept an invitation | **DEFECT** — U-12 |
| Reset a password | **OK** |
| Work offline against the hub | **OK** |

---

## What I could not check from the code

**The live row-level security rules.** The `.sql` files in this repository are
scripts that were run by hand at various times; they are not a migration history,
and nothing guarantees the live database matches them. What they *say* is that
`billing_accounts`, `billing_ledger_transactions` and
`external_department_charges` grant read, write **and delete** to any
authenticated user with `USING (true)`, that `organizations` can be updated by
any authenticated user, and that `invitations` are readable by **anonymous**
callers — which would expose every pending invitation token.

There are no policies in the repository at all for `patients`,
`patient_profiles`, `test_prices`, `custom_tests`, `referring_doctors`,
`referring_facilities` or `radiology_templates`, and `get_my_org_id()` is used
but never defined here.

I am not asserting the live database is in that state. **Someone should dump the
live policies and compare.** Until that is done, the true blast radius of U-01 is
unknown — and note that U-02 bypasses RLS entirely regardless of what it says.

---

## What is genuinely going well

Worth saying plainly, because the list above is long:

- The clinical path — register, order tests, enter results, hand back a report —
  works correctly end to end, in both online and offline modes.
- The structured result entry (MCS, Widal, MPs, radiology templates) is careful
  and well covered by tests.
- The portal's results endpoint is correctly scoped: a signed-in patient cannot
  read another patient's record by changing the id in the URL.
- Registration and department charges are properly atomic where the wallet SQL is
  applied.
- Offline working, and the queue and sync behaviour after the 4 September fixes,
  are sound.

The pattern in the defects is consistent and worth naming: **the application
layer is in good shape; the boundary layer — who may call what — was never
built.** Role is used for navigation, not for permission, and several server
routes were written as trusted internal helpers and then deployed to the public
internet.

---

## Suggested order

1. **U-02** — three unauthenticated service-role routes. Hours, not days, and it
   is the only finding an outsider can reach today.
2. **U-01** — role checks on pages and on the server.
3. **Dump the live RLS policies** and compare with this repository.
4. **U-14 / U-15** — portal code brute-force and enumeration.
5. **U-13** — sanitise the letterhead; drop `--no-sandbox`.
6. **U-06 / U-07** — make deposits atomic and validate amounts server-side.
7. **U-04, U-09, U-12, U-05** — the record-integrity items.
8. **U-08, U-10, U-11** — workflow gaps; these need a decision about how the
   clinic should work, not just code.

---

# Second pass — 5 September 2026

The first pass above marked several use cases **OK** on a quick scan rather than
a real walkthrough. This pass went through those properly: referral commissions,
custom tests and templates, sign-up and onboarding, and the older duplicated
screens. Six more findings, and one correction to my own earlier work.

## U-17 · Deleting a custom test destroys what old results depend on — S2

The button says "deactivate/delete". The code hard-deletes:
`DELETE FROM custom_tests WHERE organization_id = ? AND id = ?`.

Historical `patient_tests` rows still carry that `test_id`. Once the definition
is gone, `getTestById` returns `undefined`, and in `DepartmentPage.openEntry`
that makes `isFreeText` true — so reopening an old **structured** test presents
it as a blank free-text box instead of its parameter grid.

The schema already has `is_active`, and the catalogue merge in both
`ReceptionPage` and `TestManager` honours it. The soft delete exists; the delete
button just does not use it.

## U-18 · A user can very likely make themselves an administrator — S0

This one needs checking against the live project before you act on it, but the
code path is unambiguous.

In Supabase, `user_metadata` is **writable by the user themselves** through the
ordinary client SDK (`auth.updateUser`); it is `app_metadata` that is protected.
This codebase treats `user_metadata` as trusted:

- `AuthProvider` — when no `profiles` row is found, its last-resort branch builds
  a profile from `user_metadata.role` and `user_metadata.organization_id` and
  **upserts it into `profiles`**.
- The `profiles_insert_self` policy permits that insert whenever
  `auth.uid() = id`, which is satisfied — it constrains *which row* you may write,
  never *what role you may claim*.
- `signup` and `invite/accept` both write the role into `user_metadata` in the
  first place, so the field is load-bearing.

A newly signed-up account has no `profiles` row yet. Set your own
`user_metadata` to `role: 'admin'` and `organization_id: '<someone else's org>'`,
load the app, and the last-resort branch writes exactly that into `profiles`.

**Verify before acting:** confirm on the live project that `user_metadata` is
self-writable (it is by default) and that `profiles_insert_self` is still the
live policy. If both hold, this is reachable with nothing but the public anon key
and does not depend on U-02 at all.

## U-19 · Two staff screens that change roles differently — S2

There are two staff-management screens: `app/admin/staff/page.tsx` (248 lines,
no workspace slug) and `app/[slug]/admin/staff/page.tsx` (1,680 lines).

They do not behave the same way:

- The `[slug]` one calls `/api/staff/update`, which updates **both** the auth
  user's metadata and the `profiles` row.
- The legacy one writes `supabase.from('profiles').update({ role })` directly,
  leaving `auth.user_metadata.role` stale. Given U-18, a stale metadata role is
  not harmless.
- The legacy one also creates staff by typing a password for them, which is a
  second account-creation path alongside the invitation flow.

One more thing worth knowing: the legacy page is the **only page in the entire
app that checks a role** — and the check it makes is
`profile?.role !== 'admin' && profile?.role !== 'reception'`, which lets
reception manage staff.

## U-20 · The custom-test approval gate is decorative — S2

New tests created by non-admins are meant to land as `is_active: false` and wait
for an admin. The decision is made in the browser
(`const isAdmin = profile?.role === 'admin'`) and `is_active` is then sent in the
request body. `/api/custom-tests` accepts whatever it is given. Anyone can post
`is_active: true`.

## U-21 · The commission period drops its first hour — S2

The two ends of the date range are parsed differently:

- `new Date(dateFrom).toISOString()` — a bare `YYYY-MM-DD` is parsed as **UTC**
  midnight.
- `new Date(dateTo + 'T23:59:59').toISOString()` — a date *with* a time is parsed
  as **local**.

In Nigeria (UTC+1) that means the range starts at 01:00 local on the first day.
Any visit registered between midnight and 1am on the "from" date is missing from
every commission report, and from the CSV export. Small window, real money, and
silent.

## U-22 · Sign-up is a two-phase operation coordinated by the browser — S3

The organisation row is created first to reserve the slug, then the user account.
If the second step fails there is a rollback — but it runs in the browser's
`catch` block. Close the tab, lose the connection, or crash between the two, and
the organisation is orphaned and the clinic's chosen workspace ID is burned with
no way to reclaim it from the UI.

---

## A correction to my own work

The performance change I made on 4 September bounded the queue, the department
screens and the wallet lookups — but **not** the commission report or the admin
patient list. Both still called `fetchPatients` with no query, so both still
loaded every patient the centre had ever registered and narrowed the list in the
browser. My note in `PatientQuery` claimed that was deliberate. For the admin
patient list it is; for the commission report it was not — that screen is run for
a chosen period, and the period was sitting right there unused.

**Fixed:** `PatientQuery` now takes `until` as well as `since`, and
`fetchCommissionReport` passes the period it was asked for. Three tests cover it.

Note that this does **not** fix U-21 — the range is now applied by the database
instead of the browser, but it is still the same wrongly-parsed range. U-21 is a
separate, unfixed defect.

---

## Revised order

U-18 moves to the top alongside U-02, on the condition that the live-project
check confirms it.

1. **U-02 and U-18** — the two ways in from outside. U-18 needs its live check
   first, and that check takes minutes.
2. **U-01** — role checks on pages and on the server. U-19 and U-20 largely
   dissolve once this exists.
3. **Dump the live RLS policies** and compare with this repository.
4. **U-14 / U-15** — portal code brute-force and enumeration.
5. **U-13** — sanitise the letterhead; drop `--no-sandbox`.
6. **U-06 / U-07** — atomic deposits, server-side amount validation.
7. **U-04, U-09, U-12, U-05, U-17, U-21** — record integrity and money accuracy.
8. **U-08, U-10, U-11, U-19, U-22** — workflow gaps needing a decision about how
   the clinic should work, not just code.
