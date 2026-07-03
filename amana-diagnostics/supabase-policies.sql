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
