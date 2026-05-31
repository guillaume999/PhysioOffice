CREATE OR REPLACE FUNCTION public.can_create_item(_user_id uuid, _item_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_tier subscription_tier;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  IF public.is_admin(_user_id) THEN
    RETURN true;
  END IF;

  -- Séances limit disabled for now
  IF _item_type = 'seances' THEN
    RETURN true;
  END IF;

  -- Exercices limit disabled for now
  IF _item_type = 'exercices' THEN
    RETURN true;
  END IF;

  SELECT subscription_tier INTO user_tier FROM profiles WHERE user_id = _user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  SELECT 
    CASE _item_type
      WHEN 'patients' THEN max_patients
      WHEN 'traitements' THEN max_traitements
      ELSE 0
    END INTO max_allowed
  FROM subscription_limits WHERE tier = user_tier;

  CASE _item_type
    WHEN 'patients' THEN
      SELECT COUNT(*) INTO current_count FROM patients WHERE user_id = _user_id;
    WHEN 'traitements' THEN
      SELECT COUNT(*) INTO current_count FROM traitement_types WHERE user_id = _user_id AND is_copy = false;
    ELSE
      current_count := 0;
  END CASE;

  RETURN current_count < max_allowed;
END;
$function$;