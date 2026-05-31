-- Add new columns
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS numero text;

-- Migrate existing data: combine first_name and last_name into name
UPDATE public.patients SET name = CONCAT(first_name, ' ', last_name) WHERE name IS NULL;

-- Make name required (after data migration)
ALTER TABLE public.patients ALTER COLUMN name SET NOT NULL;

-- Drop columns that are no longer needed
ALTER TABLE public.patients DROP COLUMN IF EXISTS first_name;
ALTER TABLE public.patients DROP COLUMN IF EXISTS last_name;
ALTER TABLE public.patients DROP COLUMN IF EXISTS email;
ALTER TABLE public.patients DROP COLUMN IF EXISTS phone;
ALTER TABLE public.patients DROP COLUMN IF EXISTS city;
ALTER TABLE public.patients DROP COLUMN IF EXISTS date_of_birth;