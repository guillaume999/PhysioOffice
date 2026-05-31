-- Drop the current policy
DROP POLICY IF EXISTS "Users can update own exercices" ON public.exercices;

-- Create policy that prevents editing shared or platform exercises
CREATE POLICY "Users can update own non-platform exercices" 
ON public.exercices 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  AND status != 'shared'
  AND NOT EXISTS (
    SELECT 1 FROM featured_exercices 
    WHERE featured_exercices.exercice_id = exercices.id
  )
)
WITH CHECK (
  auth.uid() = user_id
);