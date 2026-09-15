# Admin restructure continuation

Plan: `C:/Users/SURFACE/.claude/plans/come-with-the-implemetntation-melodic-shell.md`.

## Checkpoint on 14 September 2026

- Phase 0 was committed as `2bd81dd`: Stat/Sparkline, notice actions, audit schema and repositories, initial API fixes.
- Phase 1 was committed as `c3f5fea`: Today route, aggregation, screen and tests.
- Phase 2 was committed as `845ae16`: nine-entry Administration rail, Reports screen split out of Staff, role-change undo, Settings tabs with a dirty guard.
- Phase 3 was committed as `071a3bb`: Investigations and Price list merged into one screen (`app/[slug]/admin/tests/TestCatalogueScreen.tsx`) sharing one `prices` array owned by the screen; `PriceList` (moved to `components/features/catalogue/`) is prop-driven and no longer fetches its own data; `TestManager` gained optional `prices`/`onPricesChanged`/`initialTab` props and now writes `catalogue.test_added/updated/retired` and `price.changed` audit rows; `/admin/referrals/pricing` redirects to `/admin/tests?tab=prices`.
- Phase 4 (Referrers merge + Payouts) — committed in the next commit. `ReferralsOverviewScreen.tsx` is retired; `/admin/referrals` now renders the merged `ReferrersScreen`. `/admin/referrals/doctors` and `/admin/referrals/facilities` redirect to `/admin/referrals`. `CommissionsScreen` gained four ageing stat cards, `?referrer=` URL pre-filter, `settleMany` bulk settle with Undo, `SettleReferrerDialog` for batch referrer payouts, `commission.settled`/`commission.reversed` audit rows, and partial-failure alerts. The old irreversible "cannot be undone" copy is gone.
- Phase 5 (Audit screen) — committed in the commit after Phase 4. `app/[slug]/admin/audit/AuditScreen.tsx` reads `fetchAuditLog`, filters by action and actor, expands a row to show the before/after diff, and auto-refreshes on `visibilitychange`.

## Deployment prerequisite observed locally

The development hub reports `Could not find the table 'public.audit_log' in the schema cache`.
The cloud SQL from Phase 0 has not yet been applied to the connected database.
Run `supabase_audit_log.sql`, then `supabase_sync_integrity.sql`, including their VERIFY blocks, through the documented SQL-editor workflow before validating cloud audit writes or hub audit synchronization.

Do not include `redian_clinic.db-wal` in a code commit. It was already modified at the start of this continuation and is live runtime data.

## Follow-through checks

Keep tests for Reports under `app/[slug]/admin/reports/`; People no longer fetches performance.
The report request is bounded to 365 days, so its widest period is labelled Past year.
`TabPanel` supports `keepMounted` plus explicit `hidden` for editors that must preserve local undo state.
Settings reports an audit-write failure separately from the already-successful settings save.

After the remaining phases, verify both cloud and hub flows, redirects, 390px layout,
light/dark themes, density and keyboard operation. Do not claim the restructure deployed based only on local tests.



