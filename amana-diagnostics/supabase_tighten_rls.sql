-- ─────────────────────────────────────────────────────────────────────────────
-- Row-level security: scope every table to the caller's own clinic.
--
-- WHY THIS EXISTS
--
-- The policies in supabase-policies.sql grant `USING (true)` to any
-- authenticated user on the money tables — read, write AND delete — and on
-- organizations. `invitations` is readable by `anon`. There are no policies at
-- all in this repository for patients, patient_profiles, test_prices,
-- custom_tests, referring_doctors, referring_facilities or radiology_templates.
--
-- With those in force, any signed-in user of any clinic can read every other
-- clinic's patients and wallets, and delete their financial audit trail. An
-- anonymous visitor can list every pending invitation token and use one.
--
-- The application-side guards (lib/apiAuth.ts, components/RequireRole.tsx) stop
-- the app doing those things. They do not stop anyone holding the public anon
-- key and talking to PostgREST directly. This file is the half that does.
--
--
-- BEFORE YOU RUN THIS
--
-- 1. This repository's .sql files are hand-run scripts, not a migration
--    history. Nothing guarantees the live database matches them. Dump what is
--    actually there first and compare:
--
--      select schemaname, tablename, policyname, cmd, qual, with_check
--        from pg_policies
--       where schemaname = 'public'
--       order by tablename, policyname;
--
-- 2. Run it against staging and sign in as each role before it goes near the
--    clinic. Tightening RLS breaks screens that were quietly relying on being
--    able to read everything, and the failure looks like an empty list rather
--    than an error.
--
-- 3. `get_my_org_id()` is used by supabase_fix_patient_tests_rls.sql but is not
--    defined anywhere in this repository. It is defined below so this file
--    stands on its own; if the live one differs, reconcile before running.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── The two functions every policy is built from ────────────────────────────

-- SECURITY DEFINER so a policy on `profiles` can read `profiles` without
-- recursing into itself. `search_path` is pinned because a definer function
-- that resolves names through the caller's path is a way in.
create or replace function public.get_my_org_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select organization_id::text from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.get_my_org_id to authenticated;
grant execute on function public.is_admin to authenticated;


-- ── Clinical and reference tables: your own clinic, nothing else ────────────
--
-- Everyone who works at the clinic needs to read and write these; the boundary
-- that matters is the clinic, not the role. Role is enforced in the app.

do $$
declare
  t text;
begin
  foreach t in array array[
    'patients', 'patient_profiles', 'patient_tests',
    'test_prices', 'custom_tests', 'radiology_templates',
    'referring_doctors', 'referring_facilities'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_read_org', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_org', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_org', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_org', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id::text = public.get_my_org_id())',
      t || '_read_org', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id::text = public.get_my_org_id())',
      t || '_insert_org', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id::text = public.get_my_org_id()) with check (organization_id::text = public.get_my_org_id())',
      t || '_update_org', t);
    -- Deleting clinical or reference data is an administrator's decision.
    execute format(
      'create policy %I on public.%I for delete to authenticated using (organization_id::text = public.get_my_org_id() and public.is_admin())',
      t || '_delete_org', t);
  end loop;
end $$;


-- ── Money: same scope, and nobody deletes the audit trail ───────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'billing_accounts', 'billing_ledger_transactions', 'external_department_charges'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    -- The permissive starter policies, by their names in supabase-policies.sql.
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    execute format('drop policy if exists %I on public.%I', t || '_read_org', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_org', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_org', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (organization_id::text = public.get_my_org_id())',
      t || '_read_org', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (organization_id::text = public.get_my_org_id())',
      t || '_insert_org', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (organization_id::text = public.get_my_org_id()) with check (organization_id::text = public.get_my_org_id())',
      t || '_update_org', t);
    -- No delete policy at all. A ledger is a record of what happened; a wrong
    -- entry is corrected by a further entry, not by making it never have
    -- happened. The old policy allowed any authenticated user of any clinic to
    -- delete these rows.
  end loop;
end $$;


-- ── The approval gate on new tests, enforced ───────────────────────────────
--
-- A test added by someone who is not an administrator is meant to arrive
-- inactive and wait to be approved. That decision was made in the browser
-- (`const isAdmin = profile?.role === 'admin'`) and `is_active` was then sent in
-- the request body, so anyone could post `true`. Replaces the generic insert
-- policy created above for this one table.

drop policy if exists custom_tests_insert_org on public.custom_tests;

create policy custom_tests_insert_org on public.custom_tests
  for insert to authenticated
  with check (
    organization_id::text = public.get_my_org_id()
    and (is_active is not true or public.is_admin())
  );

drop policy if exists custom_tests_update_org on public.custom_tests;

create policy custom_tests_update_org on public.custom_tests
  for update to authenticated
  using (organization_id::text = public.get_my_org_id())
  with check (
    organization_id::text = public.get_my_org_id()
    -- Approving is the administrator's act; retiring (is_active = false) is not.
    and (is_active is not true or public.is_admin())
  );


-- ── Profiles: read your colleagues, change only yourself ────────────────────

alter table public.profiles enable row level security;

drop policy if exists "profiles_read_authenticated" on public.profiles;
drop policy if exists "profiles_read_org" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profile_admin_update_org" on public.profiles;

-- Was USING (true): every user of every clinic, readable by anyone signed in.
create policy "profiles_read_org" on public.profiles
  for select to authenticated
  using (id = auth.uid() or organization_id::text = public.get_my_org_id());

-- A first profile may be created for yourself, but not with a role or a clinic
-- of your choosing. This is the database half of U-18: `user_metadata` is
-- writable by the account holder, so `role` arriving from the client is a role
-- the user picked. Sign-up goes through /api/auth/profile, which uses the
-- service key and checks that the workspace is empty first.
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (
    id = auth.uid()
    and organization_id is null
    and (role is null or role = 'reception')
  );

-- Your own details, never your own standing.
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and organization_id is not distinct from
        (select p.organization_id from public.profiles p where p.id = auth.uid())
  );

-- An administrator may change standing, but only inside their own clinic.
create policy "profile_admin_update_org" on public.profiles
  for update to authenticated
  using (organization_id::text = public.get_my_org_id() and public.is_admin())
  with check (organization_id::text = public.get_my_org_id() and public.is_admin());


-- ── Organizations: read your own, and only an admin renames it ─────────────

alter table public.organizations enable row level security;

drop policy if exists "organizations_read_authenticated" on public.organizations;
drop policy if exists "organizations_insert_authenticated" on public.organizations;
drop policy if exists "organizations_update_authenticated" on public.organizations;
drop policy if exists "organizations_read_own" on public.organizations;
drop policy if exists "organizations_update_admin" on public.organizations;

create policy "organizations_read_own" on public.organizations
  for select to authenticated
  using (id::text = public.get_my_org_id());

-- Sign-up creates the workspace before the profile that will point at it, so
-- this stays open to any signed-in user. It is a create, not a takeover:
-- attaching yourself to one is what /api/auth/profile refuses unless it is
-- empty.
create policy "organizations_insert_authenticated" on public.organizations
  for insert to authenticated
  with check (true);

-- Was USING (true) — any authenticated user could rewrite any clinic's name,
-- address and letterhead. The letterhead is injected into every report.
create policy "organizations_update_admin" on public.organizations
  for update to authenticated
  using (id::text = public.get_my_org_id() and public.is_admin())
  with check (id::text = public.get_my_org_id() and public.is_admin());


-- ── Invitations: not readable by the world ─────────────────────────────────

alter table public.invitations enable row level security;

drop policy if exists "invitations_read_anon" on public.invitations;
drop policy if exists "invitations_read_authenticated" on public.invitations;
drop policy if exists "invitations_insert_authenticated" on public.invitations;
drop policy if exists "invitations_update_authenticated" on public.invitations;
drop policy if exists "invitations_delete_authenticated" on public.invitations;
drop policy if exists "invitations_read_org" on public.invitations;
drop policy if exists "invitations_admin_write" on public.invitations;

-- The anon policy was `USING (true)`: anyone at all could list every pending
-- invitation in the system, tokens included, and accept one. Accepting an
-- invitation goes through /api/invite/accept, which holds the service key and
-- looks the token up itself — so no client ever needs to read this table.
create policy "invitations_read_org" on public.invitations
  for select to authenticated
  using (organization_id::text = public.get_my_org_id());

create policy "invitations_admin_write" on public.invitations
  for all to authenticated
  using (organization_id::text = public.get_my_org_id() and public.is_admin())
  with check (organization_id::text = public.get_my_org_id() and public.is_admin());


-- ── Portal one-time codes: server-side only ────────────────────────────────
--
-- Created by lib/portalOtp.ts through the service key. No client should read or
-- write these: RLS on with no policies means exactly that.

create table if not exists public.portal_otp_challenges (
  id          uuid primary key,
  email       text        not null,
  code_hash   text        not null,
  expires_at  bigint      not null,
  attempts    integer     not null default 0,
  consumed    integer     not null default 0,
  created_at  bigint      not null
);

create index if not exists idx_portal_otp_email_created
  on public.portal_otp_challenges (email, created_at desc);

alter table public.portal_otp_challenges enable row level security;
revoke all on public.portal_otp_challenges from anon, authenticated;

notify pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY
--
-- 1. Nothing is left wide open:
--
--      select tablename, policyname, cmd, qual
--        from pg_policies
--       where schemaname = 'public' and qual = 'true'
--       order by tablename;
--
--    Expect only organizations_insert_authenticated.
--
-- 2. Nobody can read another clinic. Signed in as a user of clinic A:
--
--      select count(*) from public.patients;              -- only A's
--      select count(*) from public.billing_accounts;      -- only A's
--      select count(*) from public.invitations;           -- only A's
--
-- 3. The ledger cannot be erased. As any authenticated user:
--
--      delete from public.billing_ledger_transactions where id = '<one of yours>';
--
--    Expect 0 rows deleted.
--
-- 4. Nobody can promote themselves. As a non-admin:
--
--      update public.profiles set role = 'admin' where id = auth.uid();
--
--    Expect 0 rows updated.
--
-- 5. Anonymous callers see no invitations. With the anon key and no session:
--
--      select * from public.invitations;
--
--    Expect 0 rows.
--
-- 6. Then sign in as each of admin, reception, lab and radiology and walk the
--    screens they use. An over-tight policy shows up as an empty list, not an
--    error, so this step is not optional.
--
-- TO ROLL BACK: re-run supabase-policies.sql, which restores the permissive
-- starter set. Understand that it restores the problems described at the top of
-- this file.
-- ─────────────────────────────────────────────────────────────────────────────
