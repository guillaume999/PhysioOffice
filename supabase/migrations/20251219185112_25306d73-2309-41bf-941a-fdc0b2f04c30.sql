-- Remove video_id column from seance_exercices
ALTER TABLE public.seance_exercices DROP COLUMN IF EXISTS video_id;

-- Remove video_id column from traitement_tests
ALTER TABLE public.traitement_tests DROP COLUMN IF EXISTS video_id;