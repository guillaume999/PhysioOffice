-- Add author_name and is_shared columns to seance_types
ALTER TABLE public.seance_types 
ADD COLUMN author_name text,
ADD COLUMN is_shared boolean NOT NULL DEFAULT false;

-- Update RLS policy to allow viewing shared seances from other users
DROP POLICY IF EXISTS "Users can view own seance types" ON public.seance_types;

CREATE POLICY "Users can view own or shared seance types" 
ON public.seance_types 
FOR SELECT 
USING (auth.uid() = user_id OR is_shared = true);

-- Update seance_exercices policy to allow viewing exercices of shared seances
DROP POLICY IF EXISTS "Users can view exercices of own seances" ON public.seance_exercices;

CREATE POLICY "Users can view exercices of own or shared seances" 
ON public.seance_exercices 
FOR SELECT 
USING (EXISTS ( 
  SELECT 1 FROM seance_types 
  WHERE seance_types.id = seance_exercices.seance_type_id 
  AND (seance_types.user_id = auth.uid() OR seance_types.is_shared = true)
));