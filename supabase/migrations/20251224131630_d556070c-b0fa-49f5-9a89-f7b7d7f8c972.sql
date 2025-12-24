-- Create table for certificate templates
CREATE TABLE public.certificat_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_platform BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.certificat_models ENABLE ROW LEVEL SECURITY;

-- Users can view their own templates
CREATE POLICY "Users can view own certificate templates"
ON public.certificat_models
FOR SELECT
USING (auth.uid() = user_id);

-- Users can view platform templates
CREATE POLICY "Users can view platform certificate templates"
ON public.certificat_models
FOR SELECT
USING (is_platform = true);

-- Users can insert their own templates
CREATE POLICY "Users can insert own certificate templates"
ON public.certificat_models
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update own certificate templates"
ON public.certificat_models
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete own certificate templates"
ON public.certificat_models
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can manage all templates
CREATE POLICY "Admins can manage all certificate templates"
ON public.certificat_models
FOR ALL
USING (is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_certificat_models_updated_at
BEFORE UPDATE ON public.certificat_models
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();