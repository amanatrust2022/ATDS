-- ─────────────────────────────────────────────────────────────────────────────
-- Wallet atomicity: make a wallet debit and the rows that explain it commit
-- together, or not at all.
--
-- PROBLEM
-- The client performed each write separately: debit the wallet, insert the
-- ledger entry, insert the charge or patient rows. A failure between them left
-- the patient debited with nothing recording why. It also read the balance and
-- wrote it back without a lock, so two concurrent charges could each see the
-- same starting balance and both succeed, together overspending the credit
-- limit.
--
-- APPROACH
-- One plpgsql function per money-moving operation. A function body runs inside
-- a single transaction, so a RAISE anywhere rolls back everything before it.
-- The account row is taken with FOR UPDATE, so a concurrent charge waits rather
-- than reading a stale balance.
--
-- SECURITY
-- SECURITY INVOKER (the default) is deliberate: the function runs as the
-- calling user, so the existing RLS policies still decide which rows they may
-- touch. This adds atomicity, not privilege. Do NOT switch it to SECURITY
-- DEFINER without pinning search_path and re-checking organisation isolation.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-09-02 CORRECTION — read this before editing the inserts.
--
-- The first version of this file inserted rows with
--
--     insert into T select * from jsonb_populate_record(null::T, p_row);
--
-- That is WRONG, and it broke registration in production with
-- "null value in column created_at of relation patient_profiles violates
-- not-null constraint".
--
-- jsonb_populate_record materialises EVERY column of T, filling the ones absent
-- from the jsonb with NULL. `insert ... select *` then supplies all of them
-- explicitly, and an explicit NULL overrides a column DEFAULT. So every column
-- the client leaves out — created_at, updated_at, generated ids — lost its
-- default and hit its NOT NULL constraint.
--
-- PostgREST does not behave that way: `.insert(row)` names only the keys the
-- row actually has and lets the defaults fill the rest. These functions now
-- reproduce that, by building the column list from the keys present in the
-- jsonb, intersected with the table's real columns:
--
--     insert into T (<present columns>)
--     select <present columns> from jsonb_populate_record(null::T, p_row);
--
-- Keys that are not columns of T are ignored, exactly as jsonb_populate_record
-- ignored them before. The column list is built from pg_attribute and passed
-- through quote_ident, and the table names are literals, so there is no
-- injection surface.
--
-- If you add an insert here, use the same shape. Do not go back to `select *`.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- HOW TO APPLY
-- Run this whole file in the Supabase SQL editor (Dashboard → SQL Editor).
-- It is idempotent — safe to run more than once, and it replaces the broken
-- version in place.
--
-- The application does NOT require these functions to be present. If they are
-- missing, the client falls back to the previous sequential writes and logs a
-- warning. That fallback is not atomic, but it works — so dropping both
-- functions is a valid way to restore service if anything here misbehaves:
--
--     drop function if exists public.register_patient_with_wallet(jsonb, jsonb, jsonb, jsonb);
--     drop function if exists public.log_external_department_charge(jsonb, jsonb);
--     notify pgrst, 'reload schema';
--
-- TO VERIFY after applying, run the checks at the bottom of this file. They
-- exercise a real registration inside a transaction you roll back yourself.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- A department charge: debit the wallet and record what it was for.
--
-- Only a wallet charge touches the wallet. A cash charge is recorded against
-- the department alone, even when the patient has an account linked.
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
  v_balance    numeric;
  v_credit     numeric;
  v_available  numeric;
  v_cols       text;
  -- Declared as the column's own type so this works whether the schema stores
  -- timestamps as timestamptz or as text. A plpgsql assignment applies the I/O
  -- conversion; an UPDATE target would not.
  v_at         public.billing_accounts.updated_at%TYPE;
begin
  v_at := p_charge ->> 'created_at';

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
      raise exception 'INSUFFICIENT_FUNDS:%', json_build_object('available', v_available)::text;
    end if;

    update public.billing_accounts
       set balance    = v_balance - v_amount,
           updated_at = v_at
     where id::text = v_account_id;

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
  end if;

  select string_agg(quote_ident(a.attname), ', ')
    into v_cols
    from pg_attribute a
   where a.attrelid = 'public.external_department_charges'::regclass
     and a.attnum > 0
     and not a.attisdropped
     and jsonb_exists(p_charge, a.attname);

  if v_cols is null then
    raise exception 'EMPTY_CHARGE_ROW';
  end if;

  execute format(
    'insert into public.external_department_charges (%s) '
    'select %s from jsonb_populate_record(null::public.external_department_charges, $1)',
    v_cols, v_cols)
  using p_charge;
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
-- Only the cloud path needs this: the local hub already wraps registration in
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
  v_balance    numeric;
  v_credit     numeric;
  v_available  numeric;
  v_name       text;
  v_cols       text;
  v_at         public.billing_accounts.updated_at%TYPE;
begin
  v_at := coalesce(p_patient ->> 'registered_at', now()::text);

  if p_profile is not null and p_profile <> 'null'::jsonb then
    select string_agg(quote_ident(a.attname), ', ')
      into v_cols
      from pg_attribute a
     where a.attrelid = 'public.patient_profiles'::regclass
       and a.attnum > 0
       and not a.attisdropped
       and jsonb_exists(p_profile, a.attname);

    if v_cols is not null then
      execute format(
        'insert into public.patient_profiles (%s) '
        'select %s from jsonb_populate_record(null::public.patient_profiles, $1)',
        v_cols, v_cols)
      using p_profile;
    end if;
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
           updated_at = v_at
     where id::text = v_account_id;
  end if;

  select string_agg(quote_ident(a.attname), ', ')
    into v_cols
    from pg_attribute a
   where a.attrelid = 'public.patients'::regclass
     and a.attnum > 0
     and not a.attisdropped
     and jsonb_exists(p_patient, a.attname);

  if v_cols is null then
    raise exception 'EMPTY_PATIENT_ROW';
  end if;

  execute format(
    'insert into public.patients (%s) '
    'select %s from jsonb_populate_record(null::public.patients, $1)',
    v_cols, v_cols)
  using p_patient;

  if v_method = 'wallet' and v_account_id is not null
     and p_ledger is not null and p_ledger <> 'null'::jsonb then
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

  if p_tests is not null and p_tests <> 'null'::jsonb and jsonb_array_length(p_tests) > 0 then
    -- The union of keys across the elements, so a row that carries an extra
    -- column is not silently truncated to match the first one.
    select string_agg(quote_ident(a.attname), ', ')
      into v_cols
      from pg_attribute a
     where a.attrelid = 'public.patient_tests'::regclass
       and a.attnum > 0
       and not a.attisdropped
       and exists (
         select 1 from jsonb_array_elements(p_tests) e
          where jsonb_exists(e, a.attname)
       );

    if v_cols is not null then
      execute format(
        'insert into public.patient_tests (%s) '
        'select %s from jsonb_populate_recordset(null::public.patient_tests, $1)',
        v_cols, v_cols)
      using p_tests;
    end if;
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
-- VERIFY — run these after applying. 1 and 2 are safe anywhere; 3 and 4 write,
-- so they roll themselves back.
--
-- 1. Both functions exist, are SECURITY INVOKER, and are callable:
--
--    select p.proname,
--           pg_get_function_identity_arguments(p.oid) as args,
--           p.prosecdef                               as is_security_definer,
--           has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_call
--      from pg_proc p
--      join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public'
--       and p.proname in ('log_external_department_charge', 'register_patient_with_wallet');
--
--    Expect two rows, is_security_definer = false, authenticated_can_call = true.
--
-- 2. Which columns have defaults that the old version was destroying — this is
--    the list that must survive an insert the client does not mention:
--
--    select c.relname, a.attname, pg_get_expr(d.adbin, d.adrelid) as default_expr,
--           a.attnotnull
--      from pg_attribute a
--      join pg_class c on c.oid = a.attrelid
--      join pg_namespace n on n.oid = c.relnamespace
--      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
--     where n.nspname = 'public'
--       and c.relname in ('patient_profiles', 'patients', 'patient_tests',
--                         'billing_ledger_transactions', 'external_department_charges')
--       and a.attnum > 0 and not a.attisdropped
--       and d.adbin is not null
--     order by c.relname, a.attnum;
--
-- 3. THE REGRESSION. A cash registration with no created_at supplied must
--    succeed and must let the default fill it. Substitute a real <org>:
--
--    begin;
--      select public.register_patient_with_wallet(
--        jsonb_build_object(
--          'id', 999000001, 'organization_id', '<org>',
--          'first_name', 'Verify', 'surname', 'Rollback',
--          'phone', '08000000000', 'address', 'Kano', 'sex', 'Male'
--        ),
--        jsonb_build_object(
--          'id', 999000002, 'organization_id', '<org>',
--          'patient_profile_id', 999000001, 'slip_number', 'VERIFY-1',
--          'first_name', 'Verify', 'surname', 'Rollback', 'age', '30yrs',
--          'sex', 'Male', 'phone', '08000000000', 'address', 'Kano',
--          'payment_method', 'cash', 'net_amount', 0,
--          'registered_at', now()::text
--        ),
--        '[]'::jsonb,
--        null
--      );
--      -- created_at must be populated even though it was never passed:
--      select id, created_at from public.patient_profiles where id = 999000001;
--    rollback;
--
--    Expect: no error, and created_at not null. Before this correction, the
--    call failed with a not-null violation on created_at.
--
-- 4. An over-limit charge still rolls back completely. Against a test account
--    with a known balance:
--
--    begin;
--      select public.log_external_department_charge(
--        jsonb_build_object(
--          'id', gen_random_uuid()::text, 'organization_id', '<org>',
--          'patient_id', '<patient>', 'billing_account_id', '<account>',
--          'department', 'pharmacy', 'receipt_number', 'VERIFY-2',
--          'amount', 999999999, 'payment_method', 'wallet', 'status', 'paid',
--          'created_by', 'verification', 'created_at', now()::text
--        ),
--        null
--      );
--    rollback;
--
--    Expect: ERROR 'INSUFFICIENT_FUNDS:{"available":...}', and afterwards the
--    account balance is unchanged and no charge row exists for VERIFY-2.
-- ─────────────────────────────────────────────────────────────────────────────
