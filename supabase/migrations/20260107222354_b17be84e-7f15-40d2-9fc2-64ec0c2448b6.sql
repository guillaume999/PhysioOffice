-- Add comment field to seance_types for session-level comments
ALTER TABLE public.seance_types ADD COLUMN comment TEXT DEFAULT NULL;