-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: let the queues change without anybody pressing reload.
--
-- WHY THIS EXISTS
--
-- Reception and the department benches both open a realtime channel and expect
-- to be told when a patient is registered or a result is entered. A channel is
-- not enough on its own: Postgres only publishes changes for tables that are in
-- the `supabase_realtime` publication. A table that is not in it produces no
-- events at all — no error, nothing to see — so the screen quietly stops
-- changing and the staff learn to press F5.
--
-- The app now polls every twenty seconds while the channel is down, so the
-- queues are correct either way. This file is what makes them instant.
--
-- Safe to run more than once.
--
--
-- ABOUT REPLICA IDENTITY
--
-- Realtime applies row-level security to every event before delivering it, and
-- it filters on `organization_id`. For UPDATE and DELETE it can only do that if
-- the old row is in the write-ahead log, which is what REPLICA IDENTITY FULL
-- means. Without it, a result being completed — an UPDATE — may be filtered out
-- and never reach the bench that is waiting for it.
--
-- The cost is a larger WAL: every update writes the whole previous row, not
-- just its key. These tables are small and the clinic is one site, so this is
-- the right trade. Note it if the database ever grows a great deal.
-- ─────────────────────────────────────────────────────────────────────────────

do $realtime$
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

    -- Old rows in the WAL, so realtime can apply RLS to updates and deletes.
    execute format('alter table public.%I replica identity full', t);

    if exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = t
    ) then
      raise notice '% is already published', t;
    else
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'added % to supabase_realtime', t;
    end if;
  end loop;
end
$realtime$;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY
--
-- 1. All five are published:
--
--      select tablename from pg_publication_tables
--       where pubname = 'supabase_realtime' and schemaname = 'public'
--       order by tablename;
--
-- 2. And carry their old rows:
--
--      select relname, relreplident from pg_class
--       where relname in ('patients', 'patient_tests', 'billing_accounts',
--                         'billing_ledger_transactions',
--                         'external_department_charges');
--
--    relreplident = 'f' is FULL. 'd' is the default and is not enough.
--
-- 3. Then two browsers, side by side. Register a patient at reception and watch
--    it appear on the lab bench without a reload; enter the result and watch it
--    leave the bench and arrive in reception's Results tab. If it takes about
--    twenty seconds, the channel is still down and you are seeing the fallback
--    poll — check that Realtime is enabled for the project, and that nothing
--    between the clinic and Supabase is closing websockets.
--
-- TO ROLL BACK:
--
--      alter publication supabase_realtime drop table public.patients;
--      -- ...and the same for the other four, then:
--      alter table public.patients replica identity default;
--
-- The screens fall back to polling; they do not break.
-- ─────────────────────────────────────────────────────────────────────────────
