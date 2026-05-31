
ALTER TABLE public.patient_traitement_seance_dates 
  ADD COLUMN IF NOT EXISTS seance_id uuid REFERENCES public.traitement_seances(id) ON DELETE CASCADE;

UPDATE public.patient_traitement_seance_dates d
SET seance_id = s.id
FROM (
  SELECT traitement_type_id, ordre, (array_agg(id))[1] AS id, COUNT(*) AS c
  FROM public.traitement_seances
  GROUP BY traitement_type_id, ordre
) s
WHERE d.seance_id IS NULL
  AND d.traitement_id = s.traitement_type_id
  AND d.seance_ordre = s.ordre
  AND s.c = 1;

CREATE INDEX IF NOT EXISTS idx_pt_seance_dates_seance_id ON public.patient_traitement_seance_dates(seance_id);
