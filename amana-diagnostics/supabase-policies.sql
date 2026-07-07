-- Run this in the Supabase SQL editor.
-- This is a permissive starter policy set for the auth/onboarding flow.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

CREATE POLICY "profiles_read_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_self"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_self"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "organizations_read_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "organizations_insert_authenticated" ON public.organizations;
DROP POLICY IF EXISTS "organizations_update_authenticated" ON public.organizations;

CREATE POLICY "organizations_read_authenticated"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "organizations_insert_authenticated"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "organizations_update_authenticated"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "invitations_read_authenticated" ON public.invitations;
DROP POLICY IF EXISTS "invitations_insert_authenticated" ON public.invitations;
DROP POLICY IF EXISTS "invitations_update_authenticated" ON public.invitations;

CREATE POLICY "invitations_read_authenticated"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "invitations_insert_authenticated"
  ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "invitations_update_authenticated"
  ON public.invitations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Billing Accounts
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_accounts_read" ON public.billing_accounts;
DROP POLICY IF EXISTS "billing_accounts_insert" ON public.billing_accounts;
DROP POLICY IF EXISTS "billing_accounts_update" ON public.billing_accounts;
DROP POLICY IF EXISTS "billing_accounts_delete" ON public.billing_accounts;
CREATE POLICY "billing_accounts_read" ON public.billing_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "billing_accounts_insert" ON public.billing_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "billing_accounts_update" ON public.billing_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "billing_accounts_delete" ON public.billing_accounts FOR DELETE TO authenticated USING (true);

-- Billing Ledger Transactions
ALTER TABLE public.billing_ledger_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_ledger_transactions_read" ON public.billing_ledger_transactions;
DROP POLICY IF EXISTS "billing_ledger_transactions_insert" ON public.billing_ledger_transactions;
DROP POLICY IF EXISTS "billing_ledger_transactions_update" ON public.billing_ledger_transactions;
DROP POLICY IF EXISTS "billing_ledger_transactions_delete" ON public.billing_ledger_transactions;
CREATE POLICY "billing_ledger_transactions_read" ON public.billing_ledger_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "billing_ledger_transactions_insert" ON public.billing_ledger_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "billing_ledger_transactions_update" ON public.billing_ledger_transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "billing_ledger_transactions_delete" ON public.billing_ledger_transactions FOR DELETE TO authenticated USING (true);

-- External Department Charges
ALTER TABLE public.external_department_charges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "external_department_charges_read" ON public.external_department_charges;
DROP POLICY IF EXISTS "external_department_charges_insert" ON public.external_department_charges;
DROP POLICY IF EXISTS "external_department_charges_update" ON public.external_department_charges;
DROP POLICY IF EXISTS "external_department_charges_delete" ON public.external_department_charges;
CREATE POLICY "external_department_charges_read" ON public.external_department_charges FOR SELECT TO authenticated USING (true);
CREATE POLICY "external_department_charges_insert" ON public.external_department_charges FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "external_department_charges_update" ON public.external_department_charges FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "external_department_charges_delete" ON public.external_department_charges FOR DELETE TO authenticated USING (true);
