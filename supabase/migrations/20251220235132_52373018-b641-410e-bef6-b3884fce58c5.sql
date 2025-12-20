-- Add new boolean column has_mutual with default false
ALTER TABLE public.patients ADD COLUMN has_mutual boolean NOT NULL DEFAULT false;

-- Migrate existing data: if mutual_number had a value, set has_mutual to true
UPDATE public.patients SET has_mutual = true WHERE mutual_number IS NOT NULL AND mutual_number <> '';

-- Drop the old mutual_number column
ALTER TABLE public.patients DROP COLUMN mutual_number;