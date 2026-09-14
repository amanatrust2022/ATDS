-- ─────────────────────────────────────────────────────────────────────────────
-- The audit log: who changed what in the administration, and when.
--
-- WHY THIS EXISTS
--
-- A role change, a price edit, a commission marked paid, a referrer removed —
-- none of these left a record. A price changed at 11pm was a fact nobody could
-- reconstruct, and "who did that?" had no answer. This table is that answer.
--
-- It is append-only. An undo is a second row whose reverses_id points at the
-- first; nothing is ever updated or deleted, by anyone, through the API. Both
-- the hub and the cloud write rows with the same id, so a change made on a hub
-- and pushed later lands once (the hub's outbox upserts by id).
--
-- BEFORE YOU RUN THIS
--
-- 1. This repository's .sql files are hand-run scripts. Run this in the
--    Supabase SQL editor once per project. It is safe to re-run.
-- 2. Run supabase_tighten_rls.sql first — this file uses public.get_my_org_id().
-- 3. Then re-run supabase_sync_integrity.sql, which now lists audit_log and
--    gives it the tombstone trigger and the realtime publication.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.audit_log (
  id              uuid        primary key,
  organization_id uuid        not null,
  actor_id        uuid,
  actor_name      text,
  action          text        not null,   -- 'staff.role_changed', 'price.changed', … (lib/audit.ts)
  entity_type     text        not null,   -- 'profile', 'test_price', 'patient', …
  entity_id       text        not null,
  entity_label    text,
  before          jsonb,                  -- the fields that changed, as they were
  after           jsonb,                  -- the same fields, as they are now
  reason          text,
  reverses_id     uuid,                   -- set on an undo row
  origin          text        not null,   -- 'hub' | 'cloud'
  created_at      timestamptz not null default now()
);

create index if not exists audit_log_org_created_idx
  on public.audit_log (organization_id, created_at desc);

alter table public.audit_log enable row level security;

-- Read your own clinic's log.
drop policy if exists "audit_log_read_org" on public.audit_log;
create policy "audit_log_read_org" on public.audit_log
  for select to authenticated
  using (organization_id = public.get_my_org_id());

-- Write a row about your own clinic, as yourself. A hub's rows arrive through
-- the sync engine under the signed-in administrator's session, so actor_id is
-- either that person or null (a hub that had no session to name).
drop policy if exists "audit_log_insert_org" on public.audit_log;
create policy "audit_log_insert_org" on public.audit_log
  for insert to authenticated
  with check (
    organization_id = public.get_my_org_id()
    and (actor_id is null or actor_id = auth.uid())
  );

-- No update policy and no delete policy, on purpose. The service role (used
-- only by server routes that have already checked the caller is an
-- administrator) bypasses RLS and is the one writer that can upsert by id.

-- Realtime, so a second admin's screen sees the row land. Guarded: the
-- publication rejects a table that is already in it.
do $pub$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_log'
  ) then
    alter publication supabase_realtime add table public.audit_log;
  end if;
end
$pub$;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY (run as a signed-in user, not as the service role)
--
-- 1. The table and its policies exist:
--
--      select policyname, cmd from pg_policies
--       where schemaname = 'public' and tablename = 'audit_log' order by cmd;
--      -- expect exactly: audit_log_insert_org (INSERT), audit_log_read_org (SELECT)
--
-- 2. A row about your own clinic goes in:
--
--      insert into public.audit_log (id, organization_id, actor_id, action, entity_type, entity_id, origin)
--      values (gen_random_uuid(), public.get_my_org_id(), auth.uid(), 'settings.saved', 'organization', 'verify', 'cloud')
--      returning id, created_at;
--
-- 3. A row about another clinic does not:
--
--      insert into public.audit_log (id, organization_id, action, entity_type, entity_id, origin)
--      values (gen_random_uuid(), gen_random_uuid(), 'settings.saved', 'organization', 'verify', 'cloud');
--      -- expect: new row violates row-level security policy
--
-- 4. Nothing can be changed or removed:
--
--      update public.audit_log set reason = 'x' where entity_id = 'verify';   -- 0 rows
--      delete from public.audit_log where entity_id = 'verify';               -- 0 rows
--
-- 5. It is published:
--
--      select 1 from pg_publication_tables
--       where pubname = 'supabase_realtime' and tablename = 'audit_log';
--
-- ROLLBACK
--
--      drop policy if exists "audit_log_read_org" on public.audit_log;
--      drop policy if exists "audit_log_insert_org" on public.audit_log;
--      alter publication supabase_realtime drop table public.audit_log;
--      drop table public.audit_log;
-- ─────────────────────────────────────────────────────────────────────────────
