-- Add antecedents column to patients table
ALTER TABLE public.patients 
ADD COLUMN antecedents text DEFAULT NULL;