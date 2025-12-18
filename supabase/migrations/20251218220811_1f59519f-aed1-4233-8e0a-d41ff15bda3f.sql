-- Add rejection reason column to exercices table
ALTER TABLE public.exercices ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add rejected_at column to track when it was rejected
ALTER TABLE public.exercices ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;