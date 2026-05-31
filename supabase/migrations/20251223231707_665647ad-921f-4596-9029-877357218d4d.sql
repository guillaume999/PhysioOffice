-- Allow anonymous access to seance_types via valid patient_session_access code
CREATE POLICY "Anyone can view seance via valid access code"
ON public.seance_types
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM patient_session_access psa
    WHERE psa.seance_type_id = seance_types.id
    AND psa.expires_at > now()
  )
);

-- Allow anonymous access to seance_exercices via valid patient_session_access code  
CREATE POLICY "Anyone can view exercices via valid access code"
ON public.seance_exercices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM patient_session_access psa
    WHERE psa.seance_type_id = seance_exercices.seance_type_id
    AND psa.expires_at > now()
  )
);

-- Allow anonymous access to exercices linked via seance_exercices with valid access code
CREATE POLICY "Anyone can view exercices details via valid access code"
ON public.exercices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM seance_exercices se
    JOIN patient_session_access psa ON psa.seance_type_id = se.seance_type_id
    WHERE se.exercice_id = exercices.id
    AND psa.expires_at > now()
  )
);