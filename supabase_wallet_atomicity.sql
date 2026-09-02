-- ─────────────────────────────────────────────────────────────────────────────
-- Wallet atomicity: make a department charge debit the wallet and record it
-- in one transaction.
--
-- PROBLEM
-- The client performed three separate writes: debit the wallet, insert the
-- ledger entry, insert the charge row. A failure between them left the patient
-- debited with nothing recording why. It also read the balance and wrote it
-- back without a lock, so two concurrent charges could each see the same
-- starting balance and both succeed, together overspending the credit limit.
--
-- APPROACH
-- One plpgsql function. A function body runs inside a single transaction, so a
-- RAISE anywhere rolls back everything before it. The account row is taken with
-- FOR UPDATE, so a concurrent charge waits rather than reading a stale balance.
--
-- SECURITY
-- SECURITY INVOKER (the default) is deliberate: the function runs as the
-- calling user, so the existing RLS policies still decide which rows they may
-- touch. This adds atomicity, not privilege. Do NOT switch it to SECURITY
-- DEFINER without pinning search_path and re-checking organisation isolation.
--
-- WHY jsonb PARAMETERS
-- The rows are passed as jsonb and expanded with jsonb_populate_record against
-- the table's own row type, so the columns adopt whatever types the live schema
-- actually has. The client passes exactly the row objects it already builds.
--
-- HOW TO APPLY
-- Run this whole file in the Supabase SQL editor (Dashboard → SQL Editor).
-- It is idempotent — safe to run more than once.
--
-- The application does NOT require this function to be present. If it is
-- missing, the client falls back to the previous sequential writes and logs a
-- warning, so deploying the app before running this is safe; you simply do not
-- get atomicity until it is applied.
--
-- TO VERIFY after applying, see the checks at the bottom of this file.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.log_external_department_charge(
  p_charge jsonb,
  p_ledger jsonb
)
returns void
language plpgsql
as $$
declare
  v_account_id text    := p_charge ->> 'billing_account_id';
  v_method     text    := p_charge ->> 'payment_method';
  v_amount     numeric := (p_charge ->> 'amount')::numeric;
  v_at         text    := p_charge ->> 'created_at';
  v_balance    numeric;
  v_credit     numeric;
  v_available  numeric;
begin
  -- Only a wallet charge touches the wallet. A cash charge is recorded against
  -- the department alone, even when the patient has an account linked.
  if v_method = 'wallet' and v_account_id is not null then

    -- Casting the column to text rather than the parameter to the column's type
    -- keeps this working whether ids are uuid, text or bigint. FOR UPDATE holds
    -- the row until this transaction ends.
    select coalesce(balance, 0), coalesce(credit_limit, 0)
      into v_balance, v_credit
      from public.billing_accounts
     where id::text = v_account_id
     for update;

    if not found then
      raise exception 'BILLING_ACCOUNT_NOT_FOUND';
    end if;

    v_available := v_balance + v_credit;

    -- Spending into the credit limit is allowed: the balance may go negative
    -- down to that limit, but no further.
    if v_available < v_amount then
      -- Machine-readable on purpose; the client formats this for the user so
      -- the wording stays identical to the pre-existing message. JSON because
      -- register_patient_with_wallet below also needs the account name, and one
      -- error protocol across both functions is easier to keep right.
      raise exception 'INSUFFICIENT_FUNDS:%', json_build_object('available', v_available)::text;
    end if;

    update public.billing_accounts
       set balance    = v_balance - v_amount,
           updated_at = v_at
     where id::text = v_account_id;

    insert into public.billing_ledger_transactions
    select * from jsonb_populate_record(null::public.billing_ledger_transactions, p_ledger);
  end if;

  insert into public.external_department_charges
  select * from jsonb_populate_record(null::public.external_department_charges, p_charge);
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Registration: create the visit and take payment from the wallet together.
--
-- Same problem, larger blast radius. The client wrote the profile, debited the
-- wallet, inserted the patient, wrote the ledger entry and inserted the tests
-- as five separate requests. A failure after the debit charged a patient for a
-- visit that was never created, with no ledger row to explain it.
--
-- Only the cloud path needed this: the local hub already wraps registration in
-- a SQLite transaction.
--
-- Insert order matters and matches the previous client order, because the
-- ledger and test rows reference the patient.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.register_patient_with_wallet(
  p_profile jsonb,   -- patient_profiles row, or null for a returning patient
  p_patient jsonb,   -- patients row
  p_tests   jsonb,   -- array of patient_tests rows
  p_ledger  jsonb    -- billing_ledger_transactions row, or null when not paying by wallet
)
returns void
language plpgsql
as $$
declare
  v_account_id text    := p_patient ->> 'billing_account_id';
  v_method     text    := p_patient ->> 'payment_method';
  v_net        numeric := coalesce((p_patient ->> 'net_amount')::numeric, 0);
  v_at         text    := p_patient ->> 'registered_at';
  v_balance    numeric;
  v_credit     numeric;
  v_available  numeric;
  v_name       text;
begin
  if p_profile is not null and p_profile <> 'null'::jsonb then
    insert into public.patient_profiles
    select * from jsonb_populate_record(null::public.patient_profiles, p_profile);
  end if;

  if v_method = 'wallet' and v_account_id is not null then
    select coalesce(balance, 0), coalesce(credit_limit, 0), name
      into v_balance, v_credit, v_name
      from public.billing_accounts
     where id::text = v_account_id
     for update;

    if not found then
      raise exception 'BILLING_ACCOUNT_NOT_FOUND';
    end if;

    v_available := v_balance + v_credit;
    if v_available < v_net then
      raise exception 'INSUFFICIENT_FUNDS:%',
        json_build_object('available', v_available, 'name', v_name)::text;
    end if;

    update public.billing_accounts
       set balance    = v_balance - v_net,
           updated_at = coalesce(v_at, now()::text)
     where id::text = v_account_id;
  end if;

  insert into public.patients
  select * from jsonb_populate_record(null::public.patients, p_patient);

  if v_method = 'wallet' and v_account_id is not null
     and p_ledger is not null and p_ledger <> 'null'::jsonb then
    insert into public.billing_ledger_transactions
    select * from jsonb_populate_record(null::public.billing_ledger_transactions, p_ledger);
  end if;

  if p_tests is not null and jsonb_array_length(p_tests) > 0 then
    insert into public.patient_tests
    select * from jsonb_populate_recordset(null::public.patient_tests, p_tests);
  end if;
end;
$$;

-- Since 2026-04-28 new objects in the public schema are not automatically
-- exposed to the Data API, so grant execute explicitly. The argument list may
-- be omitted because each function name is unique.
grant execute on function public.log_external_department_charge to authenticated;
grant execute on function public.register_patient_with_wallet to authenticated;

-- PostgREST caches the schema; without this the first call 404s.
notify pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY (optional — run these separately after applying)
--
-- 1. The function exists and is callable by authenticated users:
--
--    select p.proname,
--           pg_get_function_identity_arguments(p.oid) as args,
--           p.prosecdef                               as is_security_definer,
--           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_call
--      from pg_proc p
--      join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.proname = 'log_external_department_charge';
--
--    Expect one row, is_security_definer = false, authenticated_can_call = true.
--
-- 2. An over-limit charge rolls back completely. Against a test account with a
--    known balance, in a transaction you abort yourself:
--
--    begin;
--      select public.log_external_department_charge(
--        jsonb_build_object(
--          'id', gen_random_uuid()::text, 'organization_id', '<org>',
--          'patient_id', '<patient>', 'billing_account_id', '<account>',
--          'department', 'pharmacy', 'receipt_number', 'VERIFY-1',
--          'amount', 999999999, 'payment_method', 'wallet', 'status', 'paid',
--          'created_by', 'verification', 'created_at', now()::text
--        ),
--        '{}'::jsonb
--      );
--    rollback;
--
--    Expect: ERROR "INSUFFICIENT_FUNDS:<available>", and afterwards the
--    account balance is unchanged and no charge row exists for VERIFY-1.
-- ─────────────────────────────────────────────────────────────────────────────
