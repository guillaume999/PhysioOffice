-- Add new array columns to seance_types
ALTER TABLE public.seance_types 
ADD COLUMN pathologies text[] DEFAULT '{}',
ADD COLUMN objectifs_principaux text[] DEFAULT '{}',
ADD COLUMN objectifs_secondaires text[] DEFAULT '{}';

-- Migrate existing data to new columns
UPDATE public.seance_types 
SET pathologies = ARRAY[pathologie],
    objectifs_principaux = ARRAY[objectif_principal],
    objectifs_secondaires = CASE WHEN objectif_secondaire IS NOT NULL THEN ARRAY[objectif_secondaire] ELSE '{}' END;

-- Add exercice_id reference and series to seance_exercices
ALTER TABLE public.seance_exercices
ADD COLUMN exercice_id uuid REFERENCES public.exercices(id) ON DELETE SET NULL,
ADD COLUMN series integer DEFAULT 1;

-- Create index for better performance
CREATE INDEX idx_seance_exercices_exercice_id ON public.seance_exercices(exercice_id);