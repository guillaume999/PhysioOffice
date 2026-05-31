-- Add exercice_id column to traitement_tests table
ALTER TABLE public.traitement_tests 
ADD COLUMN exercice_id uuid REFERENCES public.exercices(id) ON DELETE SET NULL;

-- Make description nullable since we'll use exercice_id instead
ALTER TABLE public.traitement_tests 
ALTER COLUMN description DROP NOT NULL;

-- Set a default empty string for description
ALTER TABLE public.traitement_tests 
ALTER COLUMN description SET DEFAULT '';