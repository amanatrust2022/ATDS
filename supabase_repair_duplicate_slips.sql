-- Repair historical duplicate patient slip numbers before applying
-- amana-diagnostics/supabase_id_and_slip_integrity.sql.
--
-- This script is intentionally scoped to the organisation reported on
-- 2026-09-15. It preserves every visit and every patient_test row. For each
-- duplicate slip it keeps the earliest registered visit unchanged and assigns
-- only the later visits new numbers above the highest number already used on
-- that date. A linked registration wallet transaction is updated by patient_id.
--
-- Run the whole file once in Supabase SQL Editor. The transaction rolls back
-- automatically if any duplicate remains or the unique index cannot be built.

begin;

-- Prevent another registration from taking a number while the repair mapping
-- is being calculated and the unique index is being installed.
lock table public.patients in share row exclusive mode;

do $$
begin
  if exists (
    select 1
      from public.patients
     where organization_id = '23769997-a11f-492c-bb12-6b9331dc1009'::uuid
       and slip_number is not null
     group by organization_id, slip_number
    having count(*) > 1
       and slip_number !~ '^ATD/[0-9]{8}/[0-9]+$'
  ) then
    raise exception 'DUPLICATE_SLIP_HAS_UNEXPECTED_FORMAT';
  end if;
end;
$$;

create temporary table slip_repairs as
with ranked as (
  select
    p.id as patient_id,
    p.organization_id,
    p.slip_number as old_slip,
    p.registered_at,
    regexp_replace(p.slip_number, '[0-9]+$', '') as slip_prefix,
    length(substring(p.slip_number from '([0-9]+)$')) as suffix_width,
    row_number() over (
      partition by p.organization_id, p.slip_number
      order by p.registered_at nulls last, p.id
    ) as duplicate_position
  from public.patients p
  where p.organization_id = '23769997-a11f-492c-bb12-6b9331dc1009'::uuid
    and p.slip_number is not null
),
later_visits as (
  select *
  from ranked
  where duplicate_position > 1
),
prefix_maximums as (
  select
    prefixes.organization_id,
    prefixes.slip_prefix,
    max(substring(p.slip_number from '([0-9]+)$')::bigint) as maximum_suffix
  from (
    select distinct organization_id, slip_prefix
    from later_visits
  ) prefixes
  join public.patients p
    on p.organization_id = prefixes.organization_id
   and regexp_replace(p.slip_number, '[0-9]+$', '') = prefixes.slip_prefix
   and p.slip_number ~ '^ATD/[0-9]{8}/[0-9]+$'
  group by prefixes.organization_id, prefixes.slip_prefix
),
numbered as (
  select
    later_visits.*,
    row_number() over (
      partition by later_visits.organization_id, later_visits.slip_prefix
      order by later_visits.registered_at nulls last, later_visits.patient_id
    ) as repair_position
  from later_visits
)
select
  n.patient_id,
  n.organization_id,
  n.old_slip,
  n.slip_prefix || lpad(
    (m.maximum_suffix + n.repair_position)::text,
    greatest(n.suffix_width, 4),
    '0'
  ) as new_slip,
  n.registered_at
from numbered n
join prefix_maximums m
  on m.organization_id = n.organization_id
 and m.slip_prefix = n.slip_prefix;

alter table slip_repairs
  add column wallet_rows_updated bigint not null default 0;

-- Registration charges use the patient id as their durable relationship and
-- the slip as a human-readable reference. Change only a matching reference on
-- the visit whose slip is being repaired; deposits and unrelated entries stay
-- untouched.
with changed as (
  update public.billing_ledger_transactions ledger
     set reference_id = repairs.new_slip,
         description = replace(ledger.description, repairs.old_slip, repairs.new_slip)
    from slip_repairs repairs
   where ledger.organization_id::text = repairs.organization_id::text
     and ledger.patient_id::text = repairs.patient_id::text
     and ledger.reference_id = repairs.old_slip
  returning ledger.patient_id::text as patient_id
),
totals as (
  select patient_id, count(*) as changed_count
  from changed
  group by patient_id
)
update slip_repairs repairs
   set wallet_rows_updated = totals.changed_count
  from totals
 where repairs.patient_id::text = totals.patient_id;

update public.patients patients
   set slip_number = repairs.new_slip,
       updated_at = now()
  from slip_repairs repairs
 where patients.id = repairs.patient_id
   and patients.organization_id = repairs.organization_id
   and patients.slip_number = repairs.old_slip;

do $$
begin
  if exists (
    select 1
      from public.patients
     where slip_number is not null
     group by organization_id, slip_number
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_SLIPS_REMAIN; transaction rolled back';
  end if;
end;
$$;

create unique index if not exists patients_org_slip_number_key
  on public.patients (organization_id, slip_number)
  where slip_number is not null;

commit;

-- This is the final result shown by SQL Editor. For the supplied data, expect
-- eight rows. Patient 10000043 should report wallet_rows_updated = 1; the
-- remaining rows should report 0.
select
  patient_id,
  old_slip,
  new_slip,
  registered_at,
  wallet_rows_updated
from slip_repairs
order by registered_at, patient_id;
