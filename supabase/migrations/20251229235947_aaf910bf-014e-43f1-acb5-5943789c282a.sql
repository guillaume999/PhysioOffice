-- Create enum for announcement types
CREATE TYPE public.annonce_type AS ENUM ('remplacement_recherche', 'remplacement_offre', 'emploi_offre', 'emploi_recherche', 'association', 'vente_cabinet', 'autre');

-- Create table for announcements
CREATE TABLE public.annonces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type annonce_type NOT NULL,
  region TEXT NOT NULL,
  departement TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  contact_email TEXT,
  contact_phone TEXT
);

-- Create table for announcement settings (admin configurable)
CREATE TABLE public.annonce_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  free_duration_days INTEGER NOT NULL DEFAULT 30,
  featured_price_cents INTEGER NOT NULL DEFAULT 500,
  extension_price_cents INTEGER NOT NULL DEFAULT 300,
  extension_duration_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default settings
INSERT INTO public.annonce_settings (free_duration_days, featured_price_cents, extension_price_cents, extension_duration_days)
VALUES (30, 500, 300, 30);

-- Enable RLS
ALTER TABLE public.annonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annonce_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for annonces
-- Anyone can view active announcements
CREATE POLICY "Anyone can view active announcements"
ON public.annonces
FOR SELECT
USING (is_active = true AND expires_at > now());

-- Authenticated users can view their own announcements (even inactive/expired)
CREATE POLICY "Users can view own announcements"
ON public.annonces
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Authenticated users can insert their own announcements
CREATE POLICY "Users can insert own announcements"
ON public.annonces
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own announcements
CREATE POLICY "Users can update own announcements"
ON public.annonces
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own announcements
CREATE POLICY "Users can delete own announcements"
ON public.annonces
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can do everything on announcements
CREATE POLICY "Admins can manage all announcements"
ON public.annonces
FOR ALL
USING (is_admin(auth.uid()));

-- RLS Policies for annonce_settings
-- Anyone can view settings
CREATE POLICY "Anyone can view annonce settings"
ON public.annonce_settings
FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update annonce settings"
ON public.annonce_settings
FOR UPDATE
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_annonces_updated_at
BEFORE UPDATE ON public.annonces
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_annonce_settings_updated_at
BEFORE UPDATE ON public.annonce_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();