-- Drop existing foreign key and add seance_type_id instead of traitement_id
ALTER TABLE public.patient_session_access DROP CONSTRAINT IF EXISTS patient_session_access_traitement_id_fkey;
ALTER TABLE public.patient_session_access DROP COLUMN IF EXISTS traitement_id;
ALTER TABLE public.patient_session_access ADD COLUMN seance_type_id uuid NOT NULL REFERENCES public.seance_types(id) ON DELETE CASCADE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patient_session_access_seance_type_id ON public.patient_session_access(seance_type_id);