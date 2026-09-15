-- Profitability and staff-performance incentives.
-- Apply on staging first. Safe to run more than once.

begin;

alter table public.test_prices
  add column if not exists average_cost numeric not null default 0,
  add column if not exists staff_bonus_type text not null default 'none',
  add column if not exists staff_bonus_value numeric not null default 0;

alter table public.patient_tests
  add column if not exists average_cost numeric not null default 0,
  add column if not exists completed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists staff_bonus_type text not null default 'none',
  add column if not exists staff_bonus_value numeric not null default 0,
  add column if not exists staff_bonus_amount numeric not null default 0;

alter table public.profiles
  add column if not exists role_label text,
  add column if not exists performance_commission_type text not null default 'none',
  add column if not exists performance_commission_value numeric not null default 0;

alter table public.profiles
  drop constraint if exists profiles_performance_commission_type_valid,
  add constraint profiles_performance_commission_type_valid check (
    performance_commission_type in ('none', 'flat', 'percentage')
  ),
  drop constraint if exists profiles_performance_commission_value_valid,
  add constraint profiles_performance_commission_value_valid check (
    performance_commission_value >= 0 and
    (performance_commission_type <> 'percentage' or performance_commission_value <= 100)
  );

alter table public.test_prices
  drop constraint if exists test_prices_average_cost_nonnegative,
  add constraint test_prices_average_cost_nonnegative check (average_cost >= 0),
  drop constraint if exists test_prices_staff_bonus_type_valid,
  add constraint test_prices_staff_bonus_type_valid check (staff_bonus_type in ('none', 'flat', 'percentage')),
  drop constraint if exists test_prices_staff_bonus_value_nonnegative,
  add constraint test_prices_staff_bonus_value_nonnegative check (staff_bonus_value >= 0);

alter table public.patient_tests
  drop constraint if exists patient_tests_financial_snapshots_nonnegative,
  add constraint patient_tests_financial_snapshots_nonnegative check (
    average_cost >= 0 and staff_bonus_value >= 0 and staff_bonus_amount >= 0
  ),
  drop constraint if exists patient_tests_staff_bonus_type_valid,
  add constraint patient_tests_staff_bonus_type_valid check (staff_bonus_type in ('none', 'flat', 'percentage'));

commit;

-- Verification (includes the financial snapshots, exact staff attribution and plan fields):
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('test_prices', 'patient_tests', 'profiles')
  and column_name in (
    'average_cost', 'staff_bonus_type', 'staff_bonus_value', 'staff_bonus_amount',
    'completed_by_profile_id', 'performance_commission_type', 'performance_commission_value'
  )
order by table_name, column_name;
