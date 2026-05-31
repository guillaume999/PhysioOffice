UPDATE public.seance_types
SET is_copy = true
WHERE is_hidden_from_list = true
  AND is_copy = false;