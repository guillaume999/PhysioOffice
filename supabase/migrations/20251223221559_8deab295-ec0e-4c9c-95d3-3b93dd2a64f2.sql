-- Add description column to traitement_types table
ALTER TABLE public.traitement_types 
ADD COLUMN description text DEFAULT NULL;