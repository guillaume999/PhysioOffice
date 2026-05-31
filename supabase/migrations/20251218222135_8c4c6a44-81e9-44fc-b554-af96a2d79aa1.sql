-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view exercices based on access" ON public.exercices;

-- Create a security definer function to check if user has a copy
CREATE OR REPLACE FUNCTION public.user_has_exercice_copy(_exercice_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exercices
    WHERE original_id = _exercice_id
      AND user_id = _user_id
  )
$$;

-- Create a security definer function to check if exercice is featured
CREATE OR REPLACE FUNCTION public.is_exercice_featured(_exercice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.featured_exercices
    WHERE exercice_id = _exercice_id
  )
$$;

-- Recreate the policy using the security definer functions
CREATE POLICY "Users can view exercices based on access"
ON public.exercices
FOR SELECT
USING (
  -- Owner can see their own non-deleted exercices
  (auth.uid() = user_id AND deleted_at IS NULL)
  -- Anyone can see shared and validated exercices
  OR (is_shared = true AND is_validated = true)
  -- Anyone can see featured exercices
  OR public.is_exercice_featured(id)
  -- User can see exercices they copied
  OR public.user_has_exercice_copy(id, auth.uid())
);