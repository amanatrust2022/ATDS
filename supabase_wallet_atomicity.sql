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
      -- the wording stays identical to the pre-existing message.
      raise exception 'INSUFFICIENT_FUNDS:%', v_available;
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

-- Since 2026-04-28 new objects in the public schema are not automatically
-- exposed to the Data API, so grant execute explicitly. The argument list may
-- be omitted because the function name is unique.
grant execute on function public.log_external_department_charge to authenticated;

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
