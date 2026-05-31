-- Add unique constraint on pseudo (case-insensitive)
CREATE UNIQUE INDEX idx_profiles_pseudo_unique ON public.profiles (LOWER(pseudo)) WHERE pseudo IS NOT NULL;

-- Add unique constraint on email (case-insensitive)
CREATE UNIQUE INDEX idx_profiles_email_unique ON public.profiles (LOWER(email)) WHERE email IS NOT NULL;

-- Create a function to validate pseudo
CREATE OR REPLACE FUNCTION public.validate_pseudo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Check if pseudo is 'admin' (case-insensitive)
  IF NEW.pseudo IS NOT NULL AND LOWER(NEW.pseudo) = 'admin' THEN
    RAISE EXCEPTION 'Le pseudo "admin" est réservé et ne peut pas être utilisé.';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to validate pseudo on insert and update
CREATE TRIGGER validate_pseudo_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_pseudo();