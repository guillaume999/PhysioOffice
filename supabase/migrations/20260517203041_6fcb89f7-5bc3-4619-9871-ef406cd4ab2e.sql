
ALTER TABLE public.patient_traitement_seance_dates
  DROP CONSTRAINT IF EXISTS patient_traitement_seance_dat_patient_id_traitement_id_sean_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_pt_seance_dates_seance_id
  ON public.patient_traitement_seance_dates(seance_id)
  WHERE seance_id IS NOT NULL;
