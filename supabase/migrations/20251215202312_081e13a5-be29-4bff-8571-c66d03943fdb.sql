-- Create table for seance types
CREATE TABLE public.seance_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pathologie TEXT NOT NULL,
  objectif_principal TEXT NOT NULL,
  objectif_secondaire TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for exercises in a seance
CREATE TABLE public.seance_exercices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seance_type_id UUID NOT NULL REFERENCES public.seance_types(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for likes on seance types
CREATE TABLE public.seance_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seance_type_id UUID NOT NULL REFERENCES public.seance_types(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(seance_type_id, user_id)
);

-- Create table for comments on seance types
CREATE TABLE public.seance_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seance_type_id UUID NOT NULL REFERENCES public.seance_types(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for pathologies (reusable)
CREATE TABLE public.pathologies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for objectifs (reusable)
CREATE TABLE public.objectifs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'principal',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.seance_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seance_exercices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seance_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seance_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pathologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectifs ENABLE ROW LEVEL SECURITY;

-- RLS policies for seance_types
CREATE POLICY "Users can view own seance types" ON public.seance_types FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own seance types" ON public.seance_types FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own seance types" ON public.seance_types FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own seance types" ON public.seance_types FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for seance_exercices
CREATE POLICY "Users can view exercices of own seances" ON public.seance_exercices FOR SELECT USING (EXISTS (SELECT 1 FROM public.seance_types WHERE seance_types.id = seance_exercices.seance_type_id AND seance_types.user_id = auth.uid()));
CREATE POLICY "Users can insert exercices to own seances" ON public.seance_exercices FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.seance_types WHERE seance_types.id = seance_exercices.seance_type_id AND seance_types.user_id = auth.uid()));
CREATE POLICY "Users can update exercices of own seances" ON public.seance_exercices FOR UPDATE USING (EXISTS (SELECT 1 FROM public.seance_types WHERE seance_types.id = seance_exercices.seance_type_id AND seance_types.user_id = auth.uid()));
CREATE POLICY "Users can delete exercices of own seances" ON public.seance_exercices FOR DELETE USING (EXISTS (SELECT 1 FROM public.seance_types WHERE seance_types.id = seance_exercices.seance_type_id AND seance_types.user_id = auth.uid()));

-- RLS policies for seance_likes
CREATE POLICY "Users can view all likes" ON public.seance_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert own likes" ON public.seance_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.seance_likes FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for seance_comments
CREATE POLICY "Users can view all comments" ON public.seance_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert own comments" ON public.seance_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.seance_comments FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for pathologies
CREATE POLICY "Users can view own pathologies" ON public.pathologies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pathologies" ON public.pathologies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own pathologies" ON public.pathologies FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for objectifs
CREATE POLICY "Users can view own objectifs" ON public.objectifs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own objectifs" ON public.objectifs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own objectifs" ON public.objectifs FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_seance_types_updated_at BEFORE UPDATE ON public.seance_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();