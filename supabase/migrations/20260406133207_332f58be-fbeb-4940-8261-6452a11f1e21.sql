
ALTER TABLE public.practitioner_directory
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS doctolib_url text;

DROP FUNCTION IF EXISTS public.get_public_directory();

CREATE FUNCTION public.get_public_directory()
RETURNS TABLE(
  id uuid,
  user_id uuid,
  city text,
  region text,
  departement text,
  google_maps_link text,
  facebook_url text,
  instagram_url text,
  linkedin_url text,
  website_url text,
  photo_url text,
  photo_url_2 text,
  phone text,
  email text,
  doctolib_url text,
  first_name text,
  last_name text,
  pseudo text,
  specialty text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pd.id,
    pd.user_id,
    pd.city,
    pd.region,
    pd.departement,
    pd.google_maps_link,
    pd.facebook_url,
    pd.instagram_url,
    pd.linkedin_url,
    pd.website_url,
    pd.photo_url,
    pd.photo_url_2,
    pd.phone,
    pd.email,
    pd.doctolib_url,
    p.first_name,
    p.last_name,
    p.pseudo,
    p.specialty,
    p.avatar_url
  FROM practitioner_directory pd
  JOIN profiles p ON p.user_id = pd.user_id
  WHERE pd.is_visible = true;
$$;
