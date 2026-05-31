-- Create table for admin-managed popups
CREATE TABLE public.admin_popups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to track dismissed popups by users
CREATE TABLE public.user_dismissed_popups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  popup_id UUID NOT NULL REFERENCES public.admin_popups(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, popup_id)
);

-- Enable RLS
ALTER TABLE public.admin_popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dismissed_popups ENABLE ROW LEVEL SECURITY;

-- Popups are readable by everyone (authenticated)
CREATE POLICY "Anyone can read active popups"
ON public.admin_popups
FOR SELECT
USING (is_active = true);

-- Only admins can manage popups
CREATE POLICY "Admins can manage popups"
ON public.admin_popups
FOR ALL
USING (public.is_admin(auth.uid()));

-- Users can read their own dismissed popups
CREATE POLICY "Users can read their dismissed popups"
ON public.user_dismissed_popups
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their dismissed popups
CREATE POLICY "Users can dismiss popups"
ON public.user_dismissed_popups
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE TRIGGER update_admin_popups_updated_at
BEFORE UPDATE ON public.admin_popups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to reset dismissed state when popup is updated
CREATE OR REPLACE FUNCTION public.reset_popup_dismissals()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    DELETE FROM public.user_dismissed_popups WHERE popup_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to reset dismissals on popup update
CREATE TRIGGER reset_popup_dismissals_trigger
AFTER UPDATE ON public.admin_popups
FOR EACH ROW
EXECUTE FUNCTION public.reset_popup_dismissals();

-- Insert default popups for each page
INSERT INTO public.admin_popups (page_key, title, content, is_active) VALUES
('home', 'Bienvenue', 'Bienvenue sur KinéHelper !', false),
('patients', 'Gestion des patients', 'Gérez vos patients ici.', false),
('planning', 'Planning', 'Consultez votre planning.', false),
('exercices', 'Exercices', 'Découvrez les exercices disponibles.', false),
('seances', 'Séances', 'Créez et gérez vos séances.', false),
('traitements', 'Traitements', 'Organisez vos traitements.', false),
('videos', 'Vidéos', 'Accédez à vos vidéos.', false),
('notes', 'Notes', 'Prenez des notes.', false),
('annonces', 'Annonces', 'Consultez les annonces.', false),
('news', 'Actualités', 'Les dernières actualités.', false),
('formation', 'Formation', 'Découvrez les formations.', false),
('ia-diagnostic', 'IA Diagnostic', 'Utilisez l''IA pour vos diagnostics.', false),
('pricing', 'Tarifs', 'Consultez nos tarifs.', false),
('profile', 'Profil', 'Gérez votre profil.', false);