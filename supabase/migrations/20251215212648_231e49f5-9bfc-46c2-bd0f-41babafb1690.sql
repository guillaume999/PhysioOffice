-- Create traitement_types table
CREATE TABLE public.traitement_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pathologie TEXT NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  is_copy BOOLEAN DEFAULT false,
  original_id UUID,
  author_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create traitement_tests table
CREATE TABLE public.traitement_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  traitement_type_id UUID NOT NULL REFERENCES public.traitement_types(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create traitement_seances table
CREATE TABLE public.traitement_seances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  traitement_type_id UUID NOT NULL REFERENCES public.traitement_types(id) ON DELETE CASCADE,
  seance_type_id UUID NOT NULL REFERENCES public.seance_types(id) ON DELETE CASCADE,
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.traitement_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traitement_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traitement_seances ENABLE ROW LEVEL SECURITY;

-- RLS policies for traitement_types
CREATE POLICY "Users can view own or shared traitements" ON public.traitement_types
  FOR SELECT USING (auth.uid() = user_id OR is_shared = true);

CREATE POLICY "Users can insert own traitements" ON public.traitement_types
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own traitements" ON public.traitement_types
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own traitements" ON public.traitement_types
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any traitement" ON public.traitement_types
  FOR DELETE USING (is_admin(auth.uid()));

-- RLS policies for traitement_tests
CREATE POLICY "Users can view tests of own or shared traitements" ON public.traitement_tests
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM traitement_types WHERE traitement_types.id = traitement_tests.traitement_type_id 
    AND (traitement_types.user_id = auth.uid() OR traitement_types.is_shared = true)
  ));

CREATE POLICY "Users can insert tests to own traitements" ON public.traitement_tests
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM traitement_types WHERE traitement_types.id = traitement_tests.traitement_type_id 
    AND traitement_types.user_id = auth.uid()
  ));

CREATE POLICY "Users can update tests of own traitements" ON public.traitement_tests
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM traitement_types WHERE traitement_types.id = traitement_tests.traitement_type_id 
    AND traitement_types.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete tests of own traitements" ON public.traitement_tests
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM traitement_types WHERE traitement_types.id = traitement_tests.traitement_type_id 
    AND traitement_types.user_id = auth.uid()
  ));

-- RLS policies for traitement_seances
CREATE POLICY "Users can view seances of own or shared traitements" ON public.traitement_seances
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM traitement_types WHERE traitement_types.id = traitement_seances.traitement_type_id 
    AND (traitement_types.user_id = auth.uid() OR traitement_types.is_shared = true)
  ));

CREATE POLICY "Users can insert seances to own traitements" ON public.traitement_seances
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM traitement_types WHERE traitement_types.id = traitement_seances.traitement_type_id 
    AND traitement_types.user_id = auth.uid()
  ));

CREATE POLICY "Users can update seances of own traitements" ON public.traitement_seances
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM traitement_types WHERE traitement_types.id = traitement_seances.traitement_type_id 
    AND traitement_types.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete seances of own traitements" ON public.traitement_seances
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM traitement_types WHERE traitement_types.id = traitement_seances.traitement_type_id 
    AND traitement_types.user_id = auth.uid()
  ));

-- Triggers for updated_at
CREATE TRIGGER update_traitement_types_updated_at
  BEFORE UPDATE ON public.traitement_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();