# How a change reaches the other desk

Written 12 September 2026, after reception reported that results entered on
the lab bench were not arriving, and that radiology's arrived only sometimes.
This file is the audit: how a change travels in each deployment, what was
found broken on the way, what was changed, and how to check it is working.

---

## The three ways the app is deployed

| Deployment | What the screen talks to | How it hears about changes |
| --- | --- | --- |
| **Web** (amanadiagnostics.com) | Supabase directly, under RLS | A realtime channel on five tables, with a 20 s poll while the channel is down |
| **Desktop / LAN hub** (the Tauri app, or `amana-server.exe`, and every laptop pointed at its `192.168.x.x:3000`) | The hub's own API routes and SQLite | *Now:* an event stream from the hub, with a 5 s version poll while it is down. *Before:* the 5 s poll alone |
| **Mixed** — some desks on the web, some on the hub | Both of the above | The hub's outbox pushes to the cloud and its pull fetches from it, every 15 s per open tab (`SyncStatus`), and *now* immediately after any write on the hub |

A result entered on a hub bench reaches a web reception desk by: SQLite →
outbox → push (`/api/sync`) → Postgres → realtime → reception. A result
entered on the web reaches a hub reception desk by: Postgres → pull
(`/api/sync`, `updated_at > cursor`) → SQLite → event stream → reception.

Everything below is a place one of those hops could silently stop.

---

## What was found

### 1. Web: the realtime channel died on re-subscribe and never said so

`supabase.channel(topic)` returns an *existing* channel with the same topic,
and `removeChannel()` only takes a channel out of that list once the server
has acknowledged the leave — a network round trip later. Every screen used the
same topic, `patients-org-<id>`. So any screen that unsubscribed and
subscribed again within that window was handed the channel that was on its
way out. Its `subscribe()` saw a channel that was not closed and did nothing:
no join, no events, and — the part that made it invisible — no status
callback, so the fallback poll never started either.

When did that happen? Reception's `refresh` callback depends on the date
filter, so **changing the date window** re-ran the subscription effect. A
technologist moving from the lab bench to radiology in the same tab did the
same. React's development StrictMode does it on every mount. After any of
those, that screen stopped changing until someone reloaded it.

**Fixed:** every subscription gets a topic with a nonce
(`patients-org-<id>-<8 chars>`), so a dying channel can never be handed back.
`lib/repositories/patients.ts`, test "never reuses a topic".

### 2. Web: nothing recovered a channel the server closed, and nothing caught up

A `CLOSED` status is the server ending the subscription — an expired token, a
realtime restart. The library does not rejoin after it. The screen went onto
the 20-second fallback poll for the rest of the day, with nobody told.

Separately, when a channel *did* come back (after a laptop woke, or the
network blipped), nothing re-read the queue. Events that happened while it
was down were simply never delivered.

**Fixed:** `CLOSED`, `CHANNEL_ERROR` and `TIMED_OUT` all replace the channel
after a backoff (1 s doubling to 30 s), and every `SUBSCRIBED` — the first
and each one after — triggers one read. A replaced channel's late opinions
are ignored. Tests "replaces a channel the server closed" and "does not open
a replacement after the screen has unsubscribed".

### 3. Hub: the only way to hear about a change was to ask every five seconds

Five seconds on a LAN is not "instant", and a browser slows a background
tab's timers to once a minute, so a reception tab behind a browser window was
a minute behind. Every open screen paid for the asking whether or not
anything had happened.

**Fixed:** the hub has a change bus (`lib/changeBus.ts`) that every write
rings — from `queueSync`, which every registration, result and wallet
movement already passes through — and an event-stream route
(`app/api/events`) that passes the ring to every open screen. The screen
re-reads within the debounce (400 ms). The 5-second version poll is kept, and
runs only while the stream is down; a reconnect triggers one read to catch
up. Tests under "Hub change stream".

### 4. Mixed: a result on the hub waited up to fifteen seconds to leave

The outbox is pushed by `SyncStatus` on a 15-second timer. A result saved on
a hub bench sat there until the next tick before a web reception desk could
possibly see it.

**Fixed:** every write the hub accepts dispatches a `redian:sync-now` event
(`lib/sync/nudge.ts`, rung from `postJson`); `SyncStatus` runs the sync at
once, and re-runs if a nudge lands mid-run. Fifteen seconds is now the
ceiling, not the norm. Test "is rung by every write the hub accepts".

### 5. Mixed: the hub's pull cursor was the hub PC's clock

The pull asks the cloud for rows with `updated_at > cursor`, and the cursor
was `new Date()` on the hub — captured before the read, which is the right
instinct for a single clock. But the rows are stamped by the cloud's clock.
On a hub whose clock ran ahead of Supabase, a result completed on the web in
the gap between the two clocks carried a cloud timestamp *earlier* than the
cursor the hub had just written, and was never asked for again. The result
existed; reception on the hub simply never saw it. Clinic PCs drift by
minutes.

This is the most likely cause of "radiology's results arrive only sometimes"
in a mixed deployment.

**Fixed:** the cursor is now the newest `updated_at` (or `created_at`)
actually seen in the pulled rows — the cloud's clock, compared against the
cloud's clock. A pull that returns nothing leaves the cursor where it was.
`cursorAfter` in `lib/sync/cursors.ts`, three tests.

### 6. Mixed: a lapsed session dead-lettered the morning's results

The push treats any refusal as the row's fault: five refusals and the row is
set aside as permanently un-sendable, "safe here but will not send until
someone looks at them". An expired or missing Supabase session makes the
cloud refuse *every* row under RLS. Five sync ticks is 75 seconds. A hub
whose session had lapsed while online quietly set aside every pending result
within two minutes, and the badge said "Not fully synced" with no hint that
signing in again was the fix — and signing in did not re-queue them.

**Fixed:** a refusal that is about the caller (`PGRST301`, `42501`, 401,
"JWT", "row-level security", "permission denied") stalls the run without
spending an attempt, and `/api/sync` does not push at all without a token.
`SyncStatus` shows **Sign in to sync · N waiting**. Rows go up untouched once
there is a session. `isAuthFailure` in `lib/sync/outbox.ts`, five tests.

### 7. Mixed: rows pulled from the cloud landed silently

The pull wrote rows straight into SQLite. Nothing told the hub's screens; they
found out on their next 5-second poll.

**Fixed:** a pull that wrote rows rings the change bus (item 3), so a web
result reaches a hub reception desk within the debounce of landing.

### 8. Both: nothing re-read on wake

A tab the browser had parked, a laptop coming back from sleep, a phone
regaining signal: the channel or stream reconnects on its own, but what
happened in between was never delivered.

**Fixed:** `subscribeToPatients` now also re-reads on `visibilitychange`
(to visible) and `online`. `refreshOnWake` in `lib/repositories/patients.ts`.

### 9. Reception was never *told*

The bench chimes when a patient is registered. Reception had no equivalent: a
result arriving changed the number on the *Results ready* tab, and a
receptionist on the registration tab with a patient in front of them saw
nothing. Some of "the results never arrived" was "the results arrived and
nobody was told".

**Fixed:** `useResultAlerts` (mirror of the bench's `useNewTestAlerts`) —
a chime, a notice naming the department, test and patient, and a desktop
notification if allowed. The day's backlog on first load is silent, and so is
anything older than ten minutes that appears because the date window was
widened. Both hooks share `lib/notifications.ts`.

---

## What was checked and found sound

- The hub's version stamp (`/api/patients?action=version`) does change on a
  result: `updated_at` is set on every `patient_tests` write.
- The cloud's `patient_tests.updated_at` is set by the database on update
  (microsecond precision, `now()`), so the hub's pull sees web-side results.
  Verified against live rows on 12 September 2026.
- `supabase-js` 2.110 forwards a refreshed auth token to the realtime socket
  on `TOKEN_REFRESHED`; the channel does not go stale on the hour.
- The RLS `select` policies (`supabase_tighten_rls.sql`) let an authenticated
  member of the organisation read all five realtime tables, which is what
  realtime checks before delivering an event.
- The service worker passes `/api/*` straight to the network, so the event
  stream is not intercepted.

---

## What is still assumed, and how to check it

1. **The five tables are in the `supabase_realtime` publication.** Run
   `supabase_realtime.sql` once per project; its VERIFY block shows how to
   confirm. Without it the web falls back to the 20-second poll — correct, not
   instant.

2. **Two browsers, side by side.** Register a patient at reception; it should
   appear on the bench within a second. Enter and submit the result; it
   should leave the bench and land in reception's *Results ready* within a
   second. On the web, twenty seconds means the channel is down (check the
   publication, and that nothing between the clinic and Supabase closes
   websockets). On the hub, five seconds means the event stream is down
   (check the browser's Network tab for `/api/events` — it should be a
   pending request that never finishes).

3. **Mixed deployment.** Watch the badge in the shell. *All changes saved* is
   the state to expect; *Saving · N* for more than a few seconds means the
   push is stalling; *Sign in to sync* means exactly that; *Offline* means
   the hub cannot reach Supabase at all.

4. **The hub's clock.** Item 5 removed the dependency, but a clock that is
   wrong by hours still produces wrong `registered_at` and `completed_at`
   values. Keep the hub PC on a time server.

---

## What was not done

- **The hub does not listen to the cloud in real time.** A web-side change
  reaches a hub screen within 15 seconds (the pull tick), not within one. The
  hub's Node process would need a Supabase session of its own to open a
  realtime channel server-side; today the only sessions are in browsers. It
  is the one remaining hop that is not event-driven.
- **Conflict resolution stays last-writer-wins by `updated_at`**, and the two
  sides' `updated_at` come from different clocks. A hub far ahead of the
  cloud can win a conflict it should lose. Item 5 fixed the pull cursor, not
  this; it wants a server-assigned stamp on the hub's writes, which is a
  schema change.
