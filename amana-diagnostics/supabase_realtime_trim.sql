-- ─────────────────────────────────────────────────────────────────────────────
-- Take the write-ahead-log cost back off, now that realtime is working.
--
-- Run this AFTER supabase_realtime.sql, and after you have seen the queues
-- update on their own.
--
--
-- WHY
--
-- supabase_realtime.sql set REPLICA IDENTITY FULL on five tables. That makes
-- every update write the whole previous row into the write-ahead log, not just
-- its key — the cost mentioned at the top of that file, and the thing that
-- grows as the clinic does.
--
-- FULL exists so that realtime can hand a subscriber the row as it was before
-- the change, and so that it can apply row-level security to a DELETE, where
-- the new row does not exist to be checked.
--
-- This app needs neither:
--
--   * The handler ignores the payload entirely. It is a doorbell, not a letter
--     — every event does the same thing, which is to re-read the queue. See
--     `subscribe` in lib/repositories/patients.ts.
--
--   * Nothing deletes a patient or a test. There is no delete path in the
--     application for either, and the ledger tables now have no delete policy
--     at all (supabase_tighten_rls.sql), because a wrong entry is corrected by
--     another entry.
--
-- Inserts and updates carry the full new row regardless of replica identity, so
-- both the `organization_id` filter and the RLS check still work. Dropping back
-- to the default costs nothing that is being used.
--
--
-- IF YOU ARE WRONG ABOUT THIS
--
-- The symptom would be a bench that stops updating on its own again. The app
-- falls back to polling every twenty seconds, so nothing breaks or goes
-- missing — it just stops being instant. Put FULL back on the table in
-- question and it returns:
--
--     alter table public.patient_tests replica identity full;
-- ─────────────────────────────────────────────────────────────────────────────

do $trim$
declare
  t text;
begin
  foreach t in array array[
    'patients',
    'patient_tests',
    'billing_accounts',
    'billing_ledger_transactions',
    'external_department_charges'
  ]
  loop
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice 'skipping %: table does not exist', t;
      continue;
    end if;

    execute format('alter table public.%I replica identity default', t);
    raise notice '% back to replica identity default', t;
  end loop;
end
$trim$;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY
--
-- 1. All five are back to the default:
--
--      select relname, relreplident from pg_class
--       where relname in ('patients', 'patient_tests', 'billing_accounts',
--                         'billing_ledger_transactions',
--                         'external_department_charges');
--
--    relreplident = 'd' is the default. 'f' is FULL.
--
-- 2. They are still published — this file does not touch that:
--
--      select tablename from pg_publication_tables
--       where pubname = 'supabase_realtime' and schemaname = 'public';
--
-- 3. Two browsers again. Register a patient and watch it reach the bench;
--    enter the result and watch it reach reception. Both should still be
--    immediate, not twenty seconds.
-- ─────────────────────────────────────────────────────────────────────────────
