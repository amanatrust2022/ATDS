-- ─────────────────────────────────────────────────────────────────────────────
-- Taking a deposit, atomically.
--
-- Companion to supabase_wallet_atomicity.sql, which made registration and
-- department charges atomic and stopped there. Deposits were left as a
-- read-then-write from the browser:
--
--     select balance ... ; update balance = balance + amount ; insert ledger
--
-- Two receptionists taking money at the same moment both read the same starting
-- balance and both write their own total, so one deposit disappears — the
-- ledger still shows it, the balance never had it. And a failure between the
-- balance update and the ledger insert moved money with no record of why.
--
-- Same conventions as the wallet file: SECURITY INVOKER so row-level security
-- still applies, id compared as text so this works whether ids are uuid, text
-- or bigint, and the timestamp declared as the column's own type so it works
-- whether the column is timestamptz or text.
--
-- The application does NOT require this function. If it is absent the client
-- falls back to the old sequential writes, so an app release cannot outrun this
-- migration. Dropping it is a valid way to restore the old behaviour:
--
--     drop function if exists public.deposit_to_wallet(jsonb, jsonb);
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.deposit_to_wallet(
  p_account jsonb,  -- { id, organization_id, amount, updated_at }
  p_ledger  jsonb   -- billing_ledger_transactions row
)
returns numeric
language plpgsql
as $$
declare
  v_account_id text    := p_account ->> 'id';
  v_org_id     text    := p_account ->> 'organization_id';
  v_amount     numeric := (p_account ->> 'amount')::numeric;
  v_balance    numeric;
  v_new        numeric;
  v_cols       text;
  v_at         public.billing_accounts.updated_at%TYPE;
begin
  v_at := p_account ->> 'updated_at';

  if v_amount is null or v_amount <= 0 then
    raise exception 'INVALID_DEPOSIT_AMOUNT';
  end if;

  -- FOR UPDATE holds the row until this transaction ends, so a second deposit
  -- waits here rather than reading a balance that is about to change.
  select coalesce(balance, 0)
    into v_balance
    from public.billing_accounts
   where id::text = v_account_id
     and (v_org_id is null or organization_id::text = v_org_id)
   for update;

  if not found then
    raise exception 'BILLING_ACCOUNT_NOT_FOUND';
  end if;

  v_new := v_balance + v_amount;

  update public.billing_accounts
     set balance    = v_new,
         updated_at = v_at
   where id::text = v_account_id;

  -- Insert only the ledger columns this database actually has, so a schema that
  -- is behind or ahead of the client still works.
  if p_ledger is not null and p_ledger <> 'null'::jsonb then
    select string_agg(quote_ident(a.attname), ', ')
      into v_cols
      from pg_attribute a
     where a.attrelid = 'public.billing_ledger_transactions'::regclass
       and a.attnum > 0
       and not a.attisdropped
       and jsonb_exists(p_ledger, a.attname);

    if v_cols is not null then
      execute format(
        'insert into public.billing_ledger_transactions (%s) '
        'select %s from jsonb_populate_record(null::public.billing_ledger_transactions, $1)',
        v_cols, v_cols)
      using p_ledger;
    end if;
  end if;

  return v_new;
end;
$$;

grant execute on function public.deposit_to_wallet to authenticated;

-- PostgREST caches the schema; without this the first call 404s.
notify pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFY — run these before trusting the function.
--
-- 1. It exists, is SECURITY INVOKER, and is callable:
--
--      select p.proname,
--             pg_get_function_identity_arguments(p.oid) as args,
--             p.prosecdef as security_definer
--        from pg_proc p
--        join pg_namespace n on n.oid = p.pronamespace
--       where n.nspname = 'public' and p.proname = 'deposit_to_wallet';
--
--    Expect one row, security_definer = false.
--
-- 2. A deposit adds up and writes exactly one ledger row. Against a scratch
--    account, note the balance, deposit 1000, and check:
--
--      select balance from public.billing_accounts where id = '<account>';
--      select count(*) from public.billing_ledger_transactions
--       where billing_account_id = '<account>' and type = 'deposit';
--
-- 3. A zero or negative deposit is refused:
--
--      select public.deposit_to_wallet(
--        jsonb_build_object('id','<account>','amount',-500,'updated_at',now()::text),
--        null);
--
--    Expect: ERROR  INVALID_DEPOSIT_AMOUNT.
--
-- 4. Two at once do not lose one. In two psql sessions, both run:
--
--      begin;
--      select public.deposit_to_wallet(
--        jsonb_build_object('id','<account>','amount',1000,'updated_at',now()::text),
--        null);
--
--    The second blocks until the first commits. Commit both: the balance must
--    have risen by exactly 2000.
-- ─────────────────────────────────────────────────────────────────────────────
