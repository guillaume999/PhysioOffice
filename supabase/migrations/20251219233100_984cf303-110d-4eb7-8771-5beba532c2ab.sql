-- Add rejection_reason column to exercices table
ALTER TABLE public.exercices
ADD COLUMN rejection_reason text;

-- Add comment for clarity
COMMENT ON COLUMN public.exercices.rejection_reason IS 'Reason for rejection when admin refuses an exercise';