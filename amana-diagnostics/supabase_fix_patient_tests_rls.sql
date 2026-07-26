-- Fix for Patient Tests RLS Policies

-- 1. Enable RLS on patient_tests (if not already enabled)
ALTER TABLE public.patient_tests ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "patient_tests_read_org" ON public.patient_tests;
DROP POLICY IF EXISTS "patient_tests_insert_org" ON public.patient_tests;
DROP POLICY IF EXISTS "patient_tests_update_org" ON public.patient_tests;
DROP POLICY IF EXISTS "patient_tests_delete_org" ON public.patient_tests;

-- 3. Create permissive policies for organization members
-- Users should be able to read, insert, and update tests within their organization.

-- Read policy: Anyone in the organization can read tests
CREATE POLICY "patient_tests_read_org"
ON public.patient_tests
FOR SELECT
TO authenticated
USING (organization_id = get_my_org_id());

-- Insert policy: Anyone in the organization can insert tests
CREATE POLICY "patient_tests_insert_org"
ON public.patient_tests
FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_my_org_id());

-- Update policy: Anyone in the organization can update tests (crucial for lab tech result entry)
CREATE POLICY "patient_tests_update_org"
ON public.patient_tests
FOR UPDATE
TO authenticated
USING (organization_id = get_my_org_id())
WITH CHECK (organization_id = get_my_org_id());

-- Delete policy: Only admins can delete tests
CREATE POLICY "patient_tests_delete_org"
ON public.patient_tests
FOR DELETE
TO authenticated
USING (organization_id = get_my_org_id() AND public.is_admin());
