-- Drop the restrictive update policy
DROP POLICY IF EXISTS "Users can update own draft exercices" ON public.exercices;

-- Create a new policy that allows users to update their own exercices regardless of status
CREATE POLICY "Users can update own exercices" 
ON public.exercices 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);