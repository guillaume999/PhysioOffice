-- Add code column to exercices table
ALTER TABLE public.exercices 
ADD COLUMN code TEXT UNIQUE;

-- Add code column to seance_types table
ALTER TABLE public.seance_types 
ADD COLUMN code TEXT UNIQUE;

-- Add code column to traitement_types table
ALTER TABLE public.traitement_types 
ADD COLUMN code TEXT UNIQUE;

-- Create function to generate unique 4-character alphanumeric code
CREATE OR REPLACE FUNCTION public.generate_unique_code(table_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  i INTEGER;
BEGIN
  LOOP
    new_code := '';
    FOR i IN 1..4 LOOP
      new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE code = $1)', table_name)
    INTO code_exists
    USING new_code;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Generate codes for existing exercices
UPDATE public.exercices 
SET code = public.generate_unique_code('exercices')
WHERE code IS NULL;

-- Generate codes for existing seance_types
UPDATE public.seance_types 
SET code = public.generate_unique_code('seance_types')
WHERE code IS NULL;

-- Generate codes for existing traitement_types
UPDATE public.traitement_types 
SET code = public.generate_unique_code('traitement_types')
WHERE code IS NULL;

-- Make code NOT NULL after populating
ALTER TABLE public.exercices 
ALTER COLUMN code SET NOT NULL,
ALTER COLUMN code SET DEFAULT public.generate_unique_code('exercices');

ALTER TABLE public.seance_types 
ALTER COLUMN code SET NOT NULL,
ALTER COLUMN code SET DEFAULT public.generate_unique_code('seance_types');

ALTER TABLE public.traitement_types 
ALTER COLUMN code SET NOT NULL,
ALTER COLUMN code SET DEFAULT public.generate_unique_code('traitement_types');

-- Create trigger functions to auto-generate codes on insert
CREATE OR REPLACE FUNCTION public.set_exercice_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := public.generate_unique_code('exercices');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_seance_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := public.generate_unique_code('seance_types');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_traitement_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := public.generate_unique_code('traitement_types');
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER set_exercice_code_trigger
BEFORE INSERT ON public.exercices
FOR EACH ROW
EXECUTE FUNCTION public.set_exercice_code();

CREATE TRIGGER set_seance_code_trigger
BEFORE INSERT ON public.seance_types
FOR EACH ROW
EXECUTE FUNCTION public.set_seance_code();

CREATE TRIGGER set_traitement_code_trigger
BEFORE INSERT ON public.traitement_types
FOR EACH ROW
EXECUTE FUNCTION public.set_traitement_code();