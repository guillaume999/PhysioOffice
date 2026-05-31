-- Create a table to track the last used patient numero per user
CREATE TABLE public.patient_numero_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  last_numero integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_numero_sequences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own sequence"
  ON public.patient_numero_sequences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sequence"
  ON public.patient_numero_sequences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sequence"
  ON public.patient_numero_sequences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Update the generate_patient_numero function to use the sequence table
CREATE OR REPLACE FUNCTION public.generate_patient_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_numero INTEGER;
  current_max INTEGER;
BEGIN
  -- Get or create the sequence for this user
  -- First, try to get the current sequence value
  SELECT last_numero INTO next_numero
  FROM patient_numero_sequences
  WHERE user_id = NEW.user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    -- No sequence exists, check current max from patients table
    SELECT COALESCE(MAX(CAST(numero AS INTEGER)), 0)
    INTO current_max
    FROM patients
    WHERE user_id = NEW.user_id
    AND numero ~ '^\d+$';
    
    -- Create the sequence entry with the current max
    INSERT INTO patient_numero_sequences (user_id, last_numero)
    VALUES (NEW.user_id, current_max + 1)
    RETURNING last_numero INTO next_numero;
  ELSE
    -- Increment the sequence
    next_numero := next_numero + 1;
    
    UPDATE patient_numero_sequences
    SET last_numero = next_numero, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  
  NEW.numero := next_numero::TEXT;
  RETURN NEW;
END;
$$;

-- Initialize sequences for existing users based on their current max patient numero
INSERT INTO patient_numero_sequences (user_id, last_numero)
SELECT 
  user_id,
  COALESCE(MAX(CAST(numero AS INTEGER)), 0)
FROM patients
WHERE numero ~ '^\d+$'
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE SET 
  last_numero = GREATEST(patient_numero_sequences.last_numero, EXCLUDED.last_numero);