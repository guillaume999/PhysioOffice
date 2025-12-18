-- Rename videos table to exercices
ALTER TABLE public.videos RENAME TO exercices;

-- Update foreign key references in seance_exercices
ALTER TABLE public.seance_exercices DROP CONSTRAINT IF EXISTS seance_exercices_video_id_fkey;
ALTER TABLE public.seance_exercices 
  ADD CONSTRAINT seance_exercices_video_id_fkey 
  FOREIGN KEY (video_id) REFERENCES public.exercices(id) ON DELETE SET NULL;

-- Update foreign key references in traitement_tests
ALTER TABLE public.traitement_tests DROP CONSTRAINT IF EXISTS traitement_tests_video_id_fkey;
ALTER TABLE public.traitement_tests 
  ADD CONSTRAINT traitement_tests_video_id_fkey 
  FOREIGN KEY (video_id) REFERENCES public.exercices(id) ON DELETE SET NULL;

-- Update self-referencing foreign key for original_id
ALTER TABLE public.exercices DROP CONSTRAINT IF EXISTS videos_original_id_fkey;
ALTER TABLE public.exercices 
  ADD CONSTRAINT exercices_original_id_fkey 
  FOREIGN KEY (original_id) REFERENCES public.exercices(id) ON DELETE SET NULL;