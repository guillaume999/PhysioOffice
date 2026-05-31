
-- 1. Fix patient_session_access: drop the broad policy and create a secure RPC
DROP POLICY IF EXISTS "Anyone can view by valid access code" ON public.patient_session_access;

-- Create a SECURITY DEFINER function to look up session by code
CREATE OR REPLACE FUNCTION public.get_session_by_access_code(_code text)
RETURNS TABLE(
  id uuid,
  seance_type_id uuid,
  patient_id uuid,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT psa.id, psa.seance_type_id, psa.patient_id, psa.expires_at
  FROM public.patient_session_access psa
  WHERE psa.access_code = _code
    AND psa.expires_at > now()
  LIMIT 1;
$$;

-- Also fix the exercices RLS policy that allows viewing via access code
-- (the existing one joins through seance_exercices + patient_session_access which is fine,
--  but the patient_session_access broad SELECT was the root issue)

-- Also fix seance_exercices "Anyone can view exercices via valid access code" - same issue
-- These policies check patient_session_access.expires_at > now() which requires SELECT on patient_session_access
-- Since we removed the broad SELECT, we need to make these use SECURITY DEFINER too
-- Actually these policies use EXISTS subqueries which run in SECURITY DEFINER context of the RLS check itself
-- Let's keep them but note they won't work without the broad SELECT on patient_session_access
-- Solution: create a helper function

CREATE OR REPLACE FUNCTION public.has_valid_access_code_for_seance(_seance_type_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patient_session_access
    WHERE seance_type_id = _seance_type_id
      AND expires_at > now()
  );
$$;

-- Update exercices RLS policy for access code viewing
DROP POLICY IF EXISTS "Anyone can view exercices details via valid access code" ON public.exercices;
CREATE POLICY "Anyone can view exercices details via valid access code"
ON public.exercices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.seance_exercices se
    WHERE se.exercice_id = exercices.id
      AND public.has_valid_access_code_for_seance(se.seance_type_id)
  )
);

-- Update seance_exercices RLS policy for access code viewing
DROP POLICY IF EXISTS "Anyone can view exercices via valid access code" ON public.seance_exercices;
CREATE POLICY "Anyone can view exercices via valid access code"
ON public.seance_exercices
FOR SELECT
USING (public.has_valid_access_code_for_seance(seance_type_id));

-- Update seance_types RLS policy for access code viewing
DROP POLICY IF EXISTS "Anyone can view seance via valid access code" ON public.seance_types;
CREATE POLICY "Anyone can view seance via valid access code"
ON public.seance_types
FOR SELECT
USING (public.has_valid_access_code_for_seance(id));

-- 2. Enforce sharing restriction server-side on exercices
-- Drop the existing update policy and replace with one that checks can_share
DROP POLICY IF EXISTS "Users can update own exercices" ON public.exercices;
CREATE POLICY "Users can update own exercices"
ON public.exercices
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    status != 'pending'
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.can_share = true)
    OR public.is_admin(auth.uid())
  )
);

-- 3. Enforce subscription creation limits server-side via INSERT policies
-- Replace existing INSERT policies with ones that check can_create_item

DROP POLICY IF EXISTS "Users can insert own patients" ON public.patients;
CREATE POLICY "Users can insert own patients"
ON public.patients
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.can_create_item(auth.uid(), 'patients')
);

DROP POLICY IF EXISTS "Users can insert own exercices" ON public.exercices;
CREATE POLICY "Users can insert own exercices"
ON public.exercices
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.can_create_item(auth.uid(), 'exercices')
);

DROP POLICY IF EXISTS "Users can insert own seance types" ON public.seance_types;
CREATE POLICY "Users can insert own seance types"
ON public.seance_types
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.can_create_item(auth.uid(), 'seances')
);

DROP POLICY IF EXISTS "Users can insert own traitement types" ON public.traitement_types;
CREATE POLICY "Users can insert own traitement types"
ON public.traitement_types
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.can_create_item(auth.uid(), 'traitements')
);
