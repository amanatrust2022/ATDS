-- First-class health-check packages and package provenance on ordered tests.
-- Safe to run repeatedly before deploying the matching application release.

alter table if exists public.custom_tests
  add column if not exists kind text not null default 'investigation',
  add column if not exists investigation_ids jsonb not null default '[]'::jsonb;

alter table if exists public.patient_tests
  add column if not exists package_id text,
  add column if not exists package_name text;

alter table if exists public.custom_tests
  drop constraint if exists custom_tests_kind_check;

alter table if exists public.custom_tests
  add constraint custom_tests_kind_check
  check (kind in ('investigation', 'package'));

create index if not exists idx_patient_tests_package
  on public.patient_tests (organization_id, package_id)
  where package_id is not null;
