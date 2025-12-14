-- Add new columns for patient management
ALTER TABLE public.patients 
ADD COLUMN mutual_number text,
ADD COLUMN remaining_sessions integer DEFAULT 0,
ADD COLUMN prescription text DEFAULT 'none' CHECK (prescription IN ('oui', 'none', 'renouv_kine'));