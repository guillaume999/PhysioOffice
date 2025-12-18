-- Create featured_exercices table
CREATE TABLE public.featured_exercices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exercice_id UUID NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  added_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(exercice_id)
);

-- Enable RLS
ALTER TABLE public.featured_exercices ENABLE ROW LEVEL SECURITY;

-- Everyone can view featured exercices
CREATE POLICY "Everyone can view featured exercices"
ON public.featured_exercices
FOR SELECT
USING (true);

-- Only admins can insert featured exercices
CREATE POLICY "Admins can insert featured exercices"
ON public.featured_exercices
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Only admins can delete featured exercices
CREATE POLICY "Admins can delete featured exercices"
ON public.featured_exercices
FOR DELETE
USING (is_admin(auth.uid()));