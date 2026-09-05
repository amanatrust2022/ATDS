-- ============================================================================
-- Patient ID allocation and slip-number uniqueness
--
-- Fixes two defects logged as D-04 and D-06 in STATUS.md:
--
--   D-04  Patient and profile IDs were drawn at random from 90 million values,
--         for both `patients` and `patient_profiles`. By the ordinary birthday
--         maths a collision becomes more likely than not at about 11,000
--         records, and every record registered brings it closer. A collision
--         surfaces as a primary-key error in front of a waiting patient.
--
--   D-06  Slip numbers were worked out by counting today's registrations and
--         adding one. Two front desks registering in the same moment both
--         counted the same total and both issued the same number — which is
--         also what a wallet charge is filed under.
--
-- The on-premise hub already allocated IDs sequentially (lib/idGenerator.ts).
-- This brings the cloud into line and adds the constraint that makes a
-- duplicate slip number impossible rather than merely unlikely.
--
-- ─── SAFETY ─────────────────────────────────────────────────────────────────
-- Every statement here is written to be re-runnable, and the application falls
-- back to its previous behaviour if this file has not been applied yet — an
-- app release cannot outrun this migration. Read the VERIFY section at the
-- bottom and run it before trusting this on a live database. The ROLLBACK
-- section undoes everything.
-- ============================================================================


-- ─── 1. D-04: a counter to allocate numeric IDs from ────────────────────────

CREATE TABLE IF NOT EXISTS public.id_counters (
  organization_id uuid    NOT NULL,
  entity          text    NOT NULL,   -- 'patients' | 'patient_profiles'
  next_id         bigint  NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, entity)
);

COMMENT ON TABLE public.id_counters IS
  'Next numeric id to hand out per organisation and table. Replaces random 8-digit ids (D-04).';

ALTER TABLE public.id_counters ENABLE ROW LEVEL SECURITY;

-- The counter is only ever touched through allocate_numeric_id below, which is
-- SECURITY DEFINER. No direct client access is granted, so no policy is needed
-- beyond denying everything by default.

/**
 * Reserves a block of `p_count` ids and returns the first one.
 *
 * The UPDATE ... RETURNING is a single statement, so two desks calling this at
 * the same moment are serialised by Postgres and cannot be handed the same
 * value. Ids stay inside 8 digits (10,000,001 .. 99,999,999), which is what
 * the application and the printed paperwork expect.
 *
 * The counter is seeded from whatever ids already exist, so nothing already
 * registered can be handed out a second time.
 */
CREATE OR REPLACE FUNCTION public.allocate_numeric_id(
  p_organization_id uuid,
  p_entity          text,
  p_count           int DEFAULT 1
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seed  bigint;
  v_first bigint;
BEGIN
  IF p_entity NOT IN ('patients', 'patient_profiles') THEN
    RAISE EXCEPTION 'UNKNOWN_ID_ENTITY: %', p_entity;
  END IF;
  IF p_count < 1 OR p_count > 1000 THEN
    RAISE EXCEPTION 'BAD_ID_COUNT: %', p_count;
  END IF;

  -- Seed on first use from the ids already in the table, so an existing clinic
  -- carries on from where it is rather than colliding with its own history.
  IF NOT EXISTS (SELECT 1 FROM id_counters WHERE organization_id = p_organization_id AND entity = p_entity) THEN
    IF p_entity = 'patients' THEN
      SELECT COALESCE(MAX(id), 10000000) + 1 INTO v_seed
        FROM patients WHERE organization_id = p_organization_id;
    ELSE
      SELECT COALESCE(MAX(id), 10000000) + 1 INTO v_seed
        FROM patient_profiles WHERE organization_id = p_organization_id;
    END IF;

    INSERT INTO id_counters (organization_id, entity, next_id)
    VALUES (p_organization_id, p_entity, GREATEST(v_seed, 10000001))
    ON CONFLICT (organization_id, entity) DO NOTHING;
  END IF;

  UPDATE id_counters
     SET next_id = next_id + p_count,
         updated_at = now()
   WHERE organization_id = p_organization_id
     AND entity = p_entity
  RETURNING next_id - p_count INTO v_first;

  IF v_first + p_count > 99999999 THEN
    RAISE EXCEPTION 'ID_SPACE_EXHAUSTED for % on organisation %', p_entity, p_organization_id;
  END IF;

  RETURN v_first;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_numeric_id(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_numeric_id(uuid, text, int) TO authenticated, service_role;


-- ─── 2. D-06: make a duplicate slip number impossible ───────────────────────

-- Applied CONCURRENTLY is not possible inside a transaction block; this table
-- is small enough that a plain index build is a moment's lock.
--
-- If this fails, there are already duplicate slip numbers in the table. Run the
-- DUPLICATE CHECK query in the VERIFY section, settle those rows by hand, then
-- re-run this statement. Do not force it.
CREATE UNIQUE INDEX IF NOT EXISTS patients_org_slip_number_key
  ON public.patients (organization_id, slip_number)
  WHERE slip_number IS NOT NULL;

COMMENT ON INDEX public.patients_org_slip_number_key IS
  'Two desks can no longer issue the same slip number (D-06). Registration retries with the next one.';


-- ============================================================================
-- VERIFY — run these before trusting the migration
-- ============================================================================

-- 1. DUPLICATE CHECK. Must return zero rows before the unique index will build.
--
--    SELECT organization_id, slip_number, count(*)
--      FROM patients
--     WHERE slip_number IS NOT NULL
--     GROUP BY 1, 2 HAVING count(*) > 1;

-- 2. The index exists.
--
--    SELECT indexname FROM pg_indexes
--     WHERE tablename = 'patients' AND indexname = 'patients_org_slip_number_key';

-- 3. Allocation is sequential and never repeats. Replace the uuid with a real
--    organisation id. Expect three consecutive numbers, all 8 digits, all
--    higher than any id already in use.
--
--    SELECT allocate_numeric_id('00000000-0000-0000-0000-000000000000', 'patients');
--    SELECT allocate_numeric_id('00000000-0000-0000-0000-000000000000', 'patients');
--    SELECT allocate_numeric_id('00000000-0000-0000-0000-000000000000', 'patients');

-- 4. The counter did not start below the ids already in use.
--
--    SELECT c.next_id, (SELECT MAX(id) FROM patients p WHERE p.organization_id = c.organization_id) AS max_existing
--      FROM id_counters c WHERE c.entity = 'patients';
--    -- next_id must be greater than max_existing.

-- 5. A duplicate slip is now refused. Expect error 23505.
--
--    INSERT INTO patients (id, organization_id, slip_number)
--    SELECT 99999999, organization_id, slip_number FROM patients LIMIT 1;


-- ============================================================================
-- ROLLBACK — restores the previous behaviour exactly
--
-- The application treats a missing allocate_numeric_id as "not deployed yet"
-- and falls back to the old random ids on its own, so dropping these is safe
-- and needs no matching app release.
--
--   DROP INDEX IF EXISTS public.patients_org_slip_number_key;
--   DROP FUNCTION IF EXISTS public.allocate_numeric_id(uuid, text, int);
--   DROP TABLE IF EXISTS public.id_counters;
-- ============================================================================
