-- Create exercices table
CREATE TABLE public.exercices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  pathologie_tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'shared', 'pending'
  video_url TEXT,
  thumbnail_url TEXT,
  is_platform BOOLEAN DEFAULT FALSE,
  is_copy BOOLEAN DEFAULT FALSE,
  original_id UUID REFERENCES public.exercices(id) ON DELETE SET NULL,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create featured_exercices table for platform exercises
CREATE TABLE public.featured_exercices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercice_id UUID NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE UNIQUE,
  added_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.featured_exercices ENABLE ROW LEVEL SECURITY;

-- RLS policies for exercices
CREATE POLICY "Users can view own exercices"
ON public.exercices FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared exercices"
ON public.exercices FOR SELECT
USING (status = 'shared' AND user_id != auth.uid());

CREATE POLICY "Users can view platform exercices"
ON public.exercices FOR SELECT
USING (EXISTS (SELECT 1 FROM public.featured_exercices WHERE exercice_id = exercices.id));

CREATE POLICY "Admins can view all exercices"
ON public.exercices FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Users can insert own exercices"
ON public.exercices FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft exercices"
ON public.exercices FOR UPDATE
USING (auth.uid() = user_id AND status = 'draft');

CREATE POLICY "Admins can update any exercice"
ON public.exercices FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Users can delete own exercices"
ON public.exercices FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any exercice"
ON public.exercices FOR DELETE
USING (is_admin(auth.uid()));

-- RLS policies for featured_exercices
CREATE POLICY "Everyone can view featured exercices"
ON public.featured_exercices FOR SELECT
USING (true);

CREATE POLICY "Admins can insert featured exercices"
ON public.featured_exercices FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete featured exercices"
ON public.featured_exercices FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_exercices_updated_at
BEFORE UPDATE ON public.exercices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();