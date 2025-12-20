-- Add a column to track if author deleted their exercise
ALTER TABLE public.exercices ADD COLUMN IF NOT EXISTS deleted_by_author boolean DEFAULT false;

-- Drop existing SELECT policies for users
DROP POLICY IF EXISTS "Users can view own exercices" ON public.exercices;
DROP POLICY IF EXISTS "Users can view platform exercices" ON public.exercices;
DROP POLICY IF EXISTS "Users can view shared exercices" ON public.exercices;

-- Users can view their own exercises (only if not soft deleted)
CREATE POLICY "Users can view own exercices" 
ON public.exercices 
FOR SELECT 
USING (auth.uid() = user_id AND deleted_by_author = false);

-- Users can view platform exercises (even if soft deleted by author)
CREATE POLICY "Users can view platform exercices" 
ON public.exercices 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM featured_exercices 
  WHERE featured_exercices.exercice_id = exercices.id
));

-- Users can view shared validated exercises (even if soft deleted by author)
CREATE POLICY "Users can view shared exercices" 
ON public.exercices 
FOR SELECT 
USING (status = 'shared' AND user_id != auth.uid());

-- Drop and recreate DELETE policy to prevent deletion of shared/platform exercises
DROP POLICY IF EXISTS "Users can delete own exercices" ON public.exercices;

CREATE POLICY "Users can delete own non-shared exercices" 
ON public.exercices 
FOR DELETE 
USING (
  auth.uid() = user_id 
  AND status NOT IN ('shared', 'pending')
  AND NOT EXISTS (
    SELECT 1 FROM featured_exercices 
    WHERE featured_exercices.exercice_id = exercices.id
  )
);