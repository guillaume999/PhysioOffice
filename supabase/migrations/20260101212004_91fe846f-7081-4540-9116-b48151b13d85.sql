-- Add a new column for storing the full bilan initial JSON data
ALTER TABLE public.patient_care_plans 
ADD COLUMN bilan_initial_data TEXT NULL;