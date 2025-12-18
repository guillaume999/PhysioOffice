-- Add repetitions and duration fields to seance_exercices
ALTER TABLE public.seance_exercices
ADD COLUMN repetitions INTEGER,
ADD COLUMN duration_seconds INTEGER,
ADD COLUMN name TEXT;