-- Create featured_traitements table for platform traitements
CREATE TABLE public.featured_traitements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  traitement_type_id UUID NOT NULL REFERENCES public.traitement_types(id) ON DELETE CASCADE,
  added_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(traitement_type_id)
);

-- Enable RLS
ALTER TABLE public.featured_traitements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Everyone can view featured traitements"
ON public.featured_traitements
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert featured traitements"
ON public.featured_traitements
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete featured traitements"
ON public.featured_traitements
FOR DELETE
USING (is_admin(auth.uid()));