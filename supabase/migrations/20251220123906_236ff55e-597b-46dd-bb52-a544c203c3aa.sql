-- Update RLS policies for the new sharing mechanism
-- Users should see:
-- 1. Their own exercises (not shared copies with original_id and pending/shared status)
-- 2. Platform exercises
-- 3. Shared exercises from others

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view own exercices" ON public.exercices;
DROP POLICY IF EXISTS "Users can view platform exercices" ON public.exercices;
DROP POLICY IF EXISTS "Users can view shared exercices" ON public.exercices;

-- Users can view their own exercises
CREATE POLICY "Users can view own exercices" 
ON public.exercices 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can view platform exercises
CREATE POLICY "Users can view platform exercices" 
ON public.exercices 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM featured_exercices 
  WHERE featured_exercices.exercice_id = exercices.id
));

-- Users can view shared validated exercises from others
CREATE POLICY "Users can view shared exercices" 
ON public.exercices 
FOR SELECT 
USING (status = 'shared' AND user_id != auth.uid());

-- Update DELETE policy to allow deleting shared copies
DROP POLICY IF EXISTS "Users can delete own non-shared exercices" ON public.exercices;

CREATE POLICY "Users can delete own exercices" 
ON public.exercices 
FOR DELETE 
USING (auth.uid() = user_id);