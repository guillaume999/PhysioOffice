-- Update can_create_item function to allow unlimited for admins
CREATE OR REPLACE FUNCTION public.can_create_item(_user_id uuid, _item_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier subscription_tier;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Admins have unlimited access
  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier FROM profiles WHERE user_id = _user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  -- Get the limit for this tier and item type
  SELECT 
    CASE _item_type
      WHEN 'patients' THEN max_patients
      WHEN 'exercices' THEN max_exercices
      WHEN 'seances' THEN max_seances
      WHEN 'traitements' THEN max_traitements
      ELSE 0
    END INTO max_allowed
  FROM subscription_limits WHERE tier = user_tier;

  -- Get current count
  CASE _item_type
    WHEN 'patients' THEN
      SELECT COUNT(*) INTO current_count FROM patients WHERE user_id = _user_id;
    WHEN 'exercices' THEN
      SELECT COUNT(*) INTO current_count FROM exercices WHERE user_id = _user_id AND is_copy = false;
    WHEN 'seances' THEN
      SELECT COUNT(*) INTO current_count FROM seance_types WHERE user_id = _user_id AND is_copy = false;
    WHEN 'traitements' THEN
      SELECT COUNT(*) INTO current_count FROM traitement_types WHERE user_id = _user_id AND is_copy = false;
    ELSE
      current_count := 0;
  END CASE;

  RETURN current_count < max_allowed;
END;
$$;