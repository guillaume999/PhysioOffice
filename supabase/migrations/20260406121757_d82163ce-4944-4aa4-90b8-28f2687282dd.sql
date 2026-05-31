
CREATE TABLE public.practitioner_directory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  is_visible boolean NOT NULL DEFAULT false,
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
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.practitioner_directory ENABLE ROW LEVEL SECURITY;

-- Anyone can view visible profiles
CREATE POLICY "Anyone can view visible directory profiles"
  ON public.practitioner_directory FOR SELECT
  USING (is_visible = true);

-- Authenticated users can view their own profile (even if not visible)
CREATE POLICY "Users can view own directory profile"
  ON public.practitioner_directory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create their own directory profile
CREATE POLICY "Users can insert own directory profile"
  ON public.practitioner_directory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own directory profile
CREATE POLICY "Users can update own directory profile"
  ON public.practitioner_directory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own directory profile
CREATE POLICY "Users can delete own directory profile"
  ON public.practitioner_directory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_practitioner_directory_updated_at
  BEFORE UPDATE ON public.practitioner_directory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
