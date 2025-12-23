-- Add is_hidden_from_list column to seance_types
ALTER TABLE public.seance_types ADD COLUMN IF NOT EXISTS is_hidden_from_list boolean DEFAULT false;