-- Attribute direct registration payments to the receptionist who received them.
--
-- Apply once in the Supabase SQL editor before deploying the matching app build.
-- Safe to re-run. Existing rows remain NULL because the receiver cannot be
-- reconstructed reliably from historical payment data.

alter table public.patients
  add column if not exists received_by_profile_id uuid;

comment on column public.patients.received_by_profile_id is
  'Immutable profile id of the staff member who received direct payment at registration.';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'patients_received_by_profile_id_fkey'
       and conrelid = 'public.patients'::regclass
  ) then
    alter table public.patients
      add constraint patients_received_by_profile_id_fkey
      foreign key (received_by_profile_id)
      references public.profiles(id)
      on delete set null;
  end if;
end
$$;

create index if not exists patients_receiver_org_registered_idx
  on public.patients (received_by_profile_id, organization_id, registered_at desc)
  where received_by_profile_id is not null;

-- A cloud browser may name the logged-in profile in its payload, but the
-- database is the authority. Authenticated inserts are stamped from the JWT.
-- Service-role hub sync has no auth.uid(), so it preserves the receiver that
-- the trusted hub recorded. Updates can never move an existing receipt to a
-- different member of staff.
create or replace function public.enforce_patient_payment_receiver()
returns trigger
language plpgsql
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if v_user_id is not null then
      new.received_by_profile_id := v_user_id;
    end if;
  elsif new.received_by_profile_id is distinct from old.received_by_profile_id then
    new.received_by_profile_id := old.received_by_profile_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_patient_payment_receiver()
  from public, anon, authenticated;

drop trigger if exists patients_payment_receiver_guard on public.patients;
create trigger patients_payment_receiver_guard
before insert or update of received_by_profile_id on public.patients
for each row execute function public.enforce_patient_payment_receiver();

notify pgrst, 'reload schema';

-- Verification after applying:
-- select column_name, data_type
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'patients'
--    and column_name = 'received_by_profile_id';
-- Expect one row with data_type = uuid.
--
-- select tgname
--   from pg_trigger
--  where tgrelid = 'public.patients'::regclass
--    and tgname = 'patients_payment_receiver_guard'
--    and not tgisinternal;
-- Expect one row.
