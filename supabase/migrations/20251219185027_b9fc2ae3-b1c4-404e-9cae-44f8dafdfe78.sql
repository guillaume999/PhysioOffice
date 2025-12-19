-- Remove foreign key constraints first
ALTER TABLE public.seance_exercices DROP CONSTRAINT IF EXISTS seance_exercices_video_id_fkey;
ALTER TABLE public.traitement_tests DROP CONSTRAINT IF EXISTS traitement_tests_video_id_fkey;
ALTER TABLE public.featured_exercices DROP CONSTRAINT IF EXISTS featured_exercices_exercice_id_fkey;

-- Set video_id to null in seance_exercices and traitement_tests
UPDATE public.seance_exercices SET video_id = NULL WHERE video_id IS NOT NULL;
UPDATE public.traitement_tests SET video_id = NULL WHERE video_id IS NOT NULL;

-- Drop featured_exercices table first (depends on exercices)
DROP TABLE IF EXISTS public.featured_exercices;

-- Drop exercices table
DROP TABLE IF EXISTS public.exercices;

-- Drop the related functions
DROP FUNCTION IF EXISTS public.is_exercice_featured(uuid);
DROP FUNCTION IF EXISTS public.user_has_exercice_copy(uuid, uuid);