-- Add soft delete columns to exercices
ALTER TABLE public.exercices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.exercices ADD COLUMN IF NOT EXISTS deleted_by_owner BOOLEAN DEFAULT false;

-- Update RLS policy to allow viewing deleted exercices if featured or if user has a copy
DROP POLICY IF EXISTS "Users can view own or shared videos" ON public.exercices;

CREATE POLICY "Users can view exercices based on access"
ON public.exercices
FOR SELECT
USING (
  -- Owner can see their own non-deleted exercices
  (auth.uid() = user_id AND deleted_at IS NULL)
  -- Anyone can see shared and validated exercices (even if soft-deleted by owner)
  OR (is_shared = true AND is_validated = true)
  -- Anyone can see featured exercices
  OR EXISTS (SELECT 1 FROM featured_exercices WHERE featured_exercices.exercice_id = exercices.id)
  -- User can see exercices they copied (even if original is soft-deleted)
  OR EXISTS (SELECT 1 FROM exercices copies WHERE copies.original_id = exercices.id AND copies.user_id = auth.uid())
);