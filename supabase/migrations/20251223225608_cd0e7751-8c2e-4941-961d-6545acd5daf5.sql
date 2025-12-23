-- Create table for temporary patient session access
CREATE TABLE public.patient_session_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  traitement_id uuid REFERENCES public.traitement_types(id) ON DELETE CASCADE NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
  access_code text UNIQUE NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.patient_session_access ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to manage their own access codes
CREATE POLICY "Users can insert own access codes"
ON public.patient_session_access
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own access codes"
ON public.patient_session_access
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own access codes"
ON public.patient_session_access
FOR DELETE
USING (auth.uid() = user_id);

-- Policy for public access via access code (for the patient view)
CREATE POLICY "Anyone can view by valid access code"
ON public.patient_session_access
FOR SELECT
USING (expires_at > now());

-- Create index for faster lookup by access code
CREATE INDEX idx_patient_session_access_code ON public.patient_session_access(access_code);