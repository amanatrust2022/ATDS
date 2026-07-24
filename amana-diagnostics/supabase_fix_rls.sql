CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS profile_admin_update_org ON profiles;

CREATE POLICY profile_admin_update_org ON profiles
FOR UPDATE
USING (
  organization_id = get_my_org_id() AND is_admin()
)
WITH CHECK (
  organization_id = get_my_org_id() AND is_admin()
);
