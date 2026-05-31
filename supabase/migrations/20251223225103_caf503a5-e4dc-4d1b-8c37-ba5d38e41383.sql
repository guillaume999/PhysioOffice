-- Add column to control visibility in traitement list
ALTER TABLE public.traitement_types 
ADD COLUMN is_hidden_from_list boolean DEFAULT false;