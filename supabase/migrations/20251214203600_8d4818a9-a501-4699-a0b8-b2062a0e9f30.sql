-- Add status column to patients table
ALTER TABLE public.patients 
ADD COLUMN status text NOT NULL DEFAULT 'active';

-- Add check constraint for valid status values
CREATE OR REPLACE FUNCTION public.validate_patient_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status NOT IN ('active', 'in_treatment', 'waiting', 'inactive') THEN
    RAISE EXCEPTION 'Invalid patient status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_patient_status_trigger
BEFORE INSERT OR UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.validate_patient_status();