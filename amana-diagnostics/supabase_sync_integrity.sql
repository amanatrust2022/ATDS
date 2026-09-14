-- ─────────────────────────────────────────────────────────────────────────────
-- Sync integrity: what the cloud has to guarantee for a hub to stay in step.
--
-- WHY THIS EXISTS
--
-- A hub pulls the cloud's changes by asking for rows whose `updated_at` is at
-- or after the last stamp it saw. That only works if every change moves the
-- stamp. It did not: the web app updates referring doctors, facilities and
-- patients without touching `updated_at`, so those edits were invisible to
-- every hub for ever. And nothing at all told a hub about a delete — a doctor
-- removed on the web stayed on the hub's list, and a template deleted on the
-- web came back from the hub on its next push.
--
-- This file gives every synced table three things, idempotently:
--
--   1. An `updated_at` column that is always set: `now()` on insert if the
--      client sent nothing, and `now()` on update unless the client sent a
--      stamp of its own (a hub does, in the cloud's clock — see
--      lib/sync/clock.ts — and it must be kept, or the hub's conflict rule
--      compares a stamp the hub never wrote).
--   2. A row in `sync_tombstones` on every delete, so a hub can apply the
--      delete on its side. Tombstones carry the same "org:key" identity the
--      hub's outbox uses, and are pulled by cursor like any other table.
--   3. Membership of the `supabase_realtime` publication, so the hub's
--      engine hears the change as it happens rather than on its next poll.
--
-- The list of tables below is the same list as lib/sync/tables.ts. Add a
-- table there, add it here.
--
-- Safe to run more than once. Tables that do not exist are skipped.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. updated_at, always ────────────────────────────────────────────────────

create or replace function public.sync_touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'INSERT' then
    if new.updated_at is null then
      new.updated_at := now();
    end if;
  elsif tg_op = 'UPDATE' then
    -- A client that sent no new stamp gets one. A client that sent a stamp
    -- (the hub) keeps it, unless it would move the row backwards in time —
    -- a stamp older than the row's own would hide this change from every
    -- hub's cursor, and the hub's own push refuses to apply an older change
    -- anyway (lib/sync/outbox.ts, conditionalUpdate).
    if new.updated_at is null
       or new.updated_at is not distinct from old.updated_at
       or new.updated_at < old.updated_at then
      new.updated_at := now();
    end if;
  end if;
  return new;
end
$fn$;


-- ── 2. Tombstones ────────────────────────────────────────────────────────────

create table if not exists public.sync_tombstones (
  id              bigserial primary key,
  organization_id uuid        not null,
  table_name      text        not null,
  -- The row's identity as the hub's outbox spells it: the id, or
  -- "organization_id:key" for tables keyed by a pair.
  record_key      text        not null,
  deleted_at      timestamptz not null default now()
);

create index if not exists sync_tombstones_org_deleted_idx
  on public.sync_tombstones (organization_id, deleted_at, id);

alter table public.sync_tombstones enable row level security;

-- Written only by the triggers below (security definer), read by the clinic.
drop policy if exists "sync_tombstones_read_org" on public.sync_tombstones;
create policy "sync_tombstones_read_org" on public.sync_tombstones
  for select to authenticated
  using (organization_id = public.get_my_org_id());

-- Tombstones older than this are of no use: a hub that has been away
-- longer re-pulls everything anyway. Pruned by the trigger, so no cron.
create or replace function public.sync_record_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_org uuid;
  v_key text;
  v_key_column text := tg_argv[0];   -- e.g. 'id' or 'test_id'
  v_row jsonb := to_jsonb(old);
begin
  if tg_table_name = 'organizations' then
    v_org := old.id;
    v_key := old.id::text;
  else
    v_org := (v_row ->> 'organization_id')::uuid;
    if tg_nargs > 1 and tg_argv[1] = 'composite' then
      v_key := (v_row ->> 'organization_id') || ':' || (v_row ->> v_key_column);
    else
      v_key := v_row ->> v_key_column;
    end if;
  end if;

  if v_org is not null then
    insert into public.sync_tombstones (organization_id, table_name, record_key)
    values (v_org, tg_table_name, v_key);
  end if;

  -- Opportunistic pruning: one in a while, drop tombstones nobody needs.
  if random() < 0.01 then
    delete from public.sync_tombstones where deleted_at < now() - interval '90 days';
  end if;

  return old;
end
$fn$;


-- ── 3. Apply to every synced table ───────────────────────────────────────────

do $apply$
declare
  t record;
begin
  for t in
    select * from (values
      -- table,                        key column,  composite?
      ('organizations',               'id',        false),
      ('profiles',                    'id',        false),
      ('referring_facilities',        'id',        false),
      ('referring_doctors',           'id',        false),
      ('test_prices',                 'test_id',   true),
      ('custom_tests',                'id',        true),
      ('radiology_templates',         'id',        false),
      ('patient_profiles',            'id',        false),
      ('patients',                    'id',        false),
      ('patient_tests',               'id',        false),
      ('billing_accounts',            'id',        false),
      ('billing_ledger_transactions', 'id',        false),
      ('external_department_charges', 'id',        false),
      ('audit_log',                   'id',        false)
    ) as v(name, key_column, composite)
  loop
    if to_regclass('public.' || quote_ident(t.name)) is null then
      raise notice 'skipping %: table does not exist', t.name;
      continue;
    end if;

    -- 3a. updated_at column and trigger, for tables the hub compares by it.
    -- The ledgers and the audit log are append-only and are pulled by created_at instead.
    if t.name not in ('billing_ledger_transactions', 'external_department_charges', 'audit_log') then
      if not exists (
        select 1 from information_schema.columns
         where table_schema = 'public' and table_name = t.name and column_name = 'updated_at'
      ) then
        execute format('alter table public.%I add column updated_at timestamptz not null default now()', t.name);
        raise notice 'added %.updated_at', t.name;
      end if;

      execute format('drop trigger if exists sync_touch_updated_at on public.%I', t.name);
      execute format(
        'create trigger sync_touch_updated_at before insert or update on public.%I
           for each row execute function public.sync_touch_updated_at()',
        t.name);
    end if;

    -- 3b. Tombstone on delete.
    execute format('drop trigger if exists sync_record_tombstone on public.%I', t.name);
    execute format(
      'create trigger sync_record_tombstone after delete on public.%I
         for each row execute function public.sync_record_tombstone(%L, %L)',
      t.name, t.key_column, case when t.composite then 'composite' else 'single' end);

    -- 3c. Realtime: old rows in the WAL (so RLS can filter updates and
    -- deletes), and membership of the publication.
    execute format('alter table public.%I replica identity full', t.name);
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t.name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t.name);
      raise notice 'added % to supabase_realtime', t.name;
    end if;

    raise notice 'sync integrity applied to %', t.name;
  end loop;

  -- The tombstones themselves are published too, so a hub hears a delete
  -- the moment it happens.
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sync_tombstones'
  ) then
    alter publication supabase_realtime add table public.sync_tombstones;
  end if;
end
$apply$;


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY
--
-- 1. Every synced table has both triggers:
--
--      select event_object_table, trigger_name
--        from information_schema.triggers
--       where trigger_schema = 'public'
--         and trigger_name in ('sync_touch_updated_at', 'sync_record_tombstone')
--       order by 1, 2;
--
-- 2. An update without a stamp moves the stamp:
--
--      update public.referring_doctors set name = name where id = (select id from public.referring_doctors limit 1)
--        returning id, updated_at;   -- updated_at is now()
--
-- 3. A delete leaves a tombstone:
--
--      delete from public.radiology_templates where id = '<some id>';
--      select * from public.sync_tombstones order by id desc limit 1;
--
-- 4. All fourteen are published:
--
--      select tablename from pg_publication_tables
--       where pubname = 'supabase_realtime' and schemaname = 'public'
--       order by tablename;
-- ─────────────────────────────────────────────────────────────────────────────
