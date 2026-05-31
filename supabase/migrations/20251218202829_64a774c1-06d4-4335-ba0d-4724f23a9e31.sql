-- Create a function to auto-generate patient numero
CREATE OR REPLACE FUNCTION public.generate_patient_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_numero INTEGER;
BEGIN
  -- Get the next numero for this user
  SELECT COALESCE(MAX(CAST(numero AS INTEGER)), 0) + 1
  INTO next_numero
  FROM patients
  WHERE user_id = NEW.user_id
  AND numero ~ '^\d+$';
  
  NEW.numero := next_numero::TEXT;
  RETURN NEW;
END;
$function$;

-- Create trigger to auto-generate numero before insert
CREATE TRIGGER generate_patient_numero_trigger
BEFORE INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.generate_patient_numero();

-- Add unique constraint for numero per user
CREATE UNIQUE INDEX idx_patients_numero_user ON public.patients(user_id, numero);