-- Add date columns to patient_care_plans for bilan initial and traitement dates
ALTER TABLE public.patient_care_plans 
ADD COLUMN IF NOT EXISTS bilan_initial_date date,
ADD COLUMN IF NOT EXISTS traitement_start_date date;

-- Add date column to patient_bilans for bilan intermédiaire dates
ALTER TABLE public.patient_bilans 
ADD COLUMN IF NOT EXISTS bilan_date date;

-- Add date column to patient_seances for séance dates (if patient_seances is used)
-- We need a new table to track seance dates for each patient's traitement
CREATE TABLE IF NOT EXISTS public.patient_traitement_seance_dates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  traitement_id uuid NOT NULL REFERENCES public.traitement_types(id) ON DELETE CASCADE,
  seance_ordre integer NOT NULL,
  seance_date date,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(patient_id, traitement_id, seance_ordre)
);

-- Enable RLS on the new table
ALTER TABLE public.patient_traitement_seance_dates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own seance dates" 
ON public.patient_traitement_seance_dates 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own seance dates" 
ON public.patient_traitement_seance_dates 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own seance dates" 
ON public.patient_traitement_seance_dates 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own seance dates" 
ON public.patient_traitement_seance_dates 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_patient_traitement_seance_dates_updated_at
BEFORE UPDATE ON public.patient_traitement_seance_dates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();