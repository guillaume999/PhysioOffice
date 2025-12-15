-- Add ban and share restriction to profiles
ALTER TABLE public.profiles ADD COLUMN is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN can_share BOOLEAN DEFAULT true;

-- Add validation status to seance_types and traitement_types
ALTER TABLE public.seance_types ADD COLUMN is_validated BOOLEAN DEFAULT false;
ALTER TABLE public.traitement_types ADD COLUMN is_validated BOOLEAN DEFAULT false;

-- Update RLS policy for seance_types to only show validated shared content
DROP POLICY IF EXISTS "Users can view seances based on access" ON public.seance_types;
CREATE POLICY "Users can view seances based on access" ON public.seance_types
  FOR SELECT USING (
    (auth.uid() = user_id) 
    OR (is_shared = true AND is_validated = true) 
    OR (EXISTS (SELECT 1 FROM featured_seances WHERE featured_seances.seance_type_id = seance_types.id))
    OR is_admin(auth.uid())
  );

-- Update RLS policy for traitement_types
DROP POLICY IF EXISTS "Users can view own or shared traitements" ON public.traitement_types;
CREATE POLICY "Users can view own or shared traitements" ON public.traitement_types
  FOR SELECT USING (
    (auth.uid() = user_id) 
    OR (is_shared = true AND is_validated = true)
    OR is_admin(auth.uid())
  );

-- Admin can update seance_types for validation
CREATE POLICY "Admins can update any seance" ON public.seance_types
  FOR UPDATE USING (is_admin(auth.uid()));

-- Admin can update traitement_types for validation
CREATE POLICY "Admins can update any traitement" ON public.traitement_types
  FOR UPDATE USING (is_admin(auth.uid()));