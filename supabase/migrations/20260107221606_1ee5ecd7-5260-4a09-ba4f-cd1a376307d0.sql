-- Add new metric fields to seance_exercices table
ALTER TABLE public.seance_exercices
ADD COLUMN force_1 integer DEFAULT NULL,
ADD COLUMN duration_seconds_2 integer DEFAULT NULL,
ADD COLUMN force_2 integer DEFAULT NULL;