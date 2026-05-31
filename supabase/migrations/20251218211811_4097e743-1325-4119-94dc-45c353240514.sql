-- Create patient care plans table
CREATE TABLE public.patient_care_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comments TEXT,
  motif_consultation TEXT,
  bilan_kine TEXT,
  objectifs_prise_en_charge TEXT,
  active_traitement_id UUID REFERENCES public.traitement_types(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(patient_id)
);

-- Enable RLS
ALTER TABLE public.patient_care_plans ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own patient care plans"
ON public.patient_care_plans
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patient care plans"
ON public.patient_care_plans
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patient care plans"
ON public.patient_care_plans
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patient care plans"
ON public.patient_care_plans
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_patient_care_plans_updated_at
BEFORE UPDATE ON public.patient_care_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create patient_seances table to link seances to patients
CREATE TABLE public.patient_seances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  seance_type_id UUID NOT NULL REFERENCES public.seance_types(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patient_seances ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own patient seances"
ON public.patient_seances
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patient seances"
ON public.patient_seances
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patient seances"
ON public.patient_seances
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patient seances"
ON public.patient_seances
FOR DELETE
USING (auth.uid() = user_id);