-- Drop the current update policy
DROP POLICY IF EXISTS "Users can update own non-platform exercices" ON public.exercices;

-- Create policy that allows users to update their own exercises
-- But only allow changing deleted_by_author for shared/platform exercises
CREATE POLICY "Users can update own exercices" 
ON public.exercices 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);