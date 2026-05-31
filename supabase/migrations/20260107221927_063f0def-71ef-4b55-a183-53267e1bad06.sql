-- Add comment field to seance_exercices for exercise-level comments
ALTER TABLE public.seance_exercices ADD COLUMN comment TEXT DEFAULT NULL;