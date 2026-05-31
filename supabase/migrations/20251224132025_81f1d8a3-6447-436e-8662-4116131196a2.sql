-- Create table for intermediate bilans between sessions
CREATE TABLE public.patient_bilans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  traitement_id UUID REFERENCES public.traitement_types(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  position_after_seance INTEGER NOT NULL DEFAULT 0,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_bilans ENABLE ROW LEVEL SECURITY;

-- Users can view their own bilans
CREATE POLICY "Users can view own patient bilans"
ON public.patient_bilans
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own bilans
CREATE POLICY "Users can insert own patient bilans"
ON public.patient_bilans
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own bilans
CREATE POLICY "Users can update own patient bilans"
ON public.patient_bilans
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own bilans
CREATE POLICY "Users can delete own patient bilans"
ON public.patient_bilans
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_patient_bilans_updated_at
BEFORE UPDATE ON public.patient_bilans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();