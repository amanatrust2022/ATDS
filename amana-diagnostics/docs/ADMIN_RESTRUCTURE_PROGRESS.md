# Admin restructure continuation

Plan: `C:/Users/SURFACE/.claude/plans/come-with-the-implemetntation-melodic-shell.md`.

## Checkpoint on 14 September 2026

- Phase 0 was committed as `2bd81dd`: Stat/Sparkline, notice actions, audit schema and repositories, initial API fixes.
- Phase 1 was committed as `c3f5fea`: Today route, aggregation, screen and tests.
- Claude stopped during Phase 2 with navigation, Reports extraction and People undo edits in the working tree. Those edits have been preserved.
- The continuation adds Reports tests and error retry, restores staff-row details, fixes the captured previous role in Undo, and implements Settings tabs, dirty-state warning, persistent designer panels, sticky Save and audit writes.
- Phase 3 (Catalogue and Price list), Phase 4 (Referrers and Payouts), and Phase 5 (Audit screen and complete mutation coverage) remain to implement. The navigation already names their intended destinations; legacy referrer routes are still present.

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
