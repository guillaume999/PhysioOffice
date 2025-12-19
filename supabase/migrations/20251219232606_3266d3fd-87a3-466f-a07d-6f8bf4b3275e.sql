-- Persist per-user "consulté" status for exercices

CREATE TABLE IF NOT EXISTS public.exercice_consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercice_id uuid NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  is_consulted boolean NOT NULL DEFAULT true,
  consulted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercice_consultations_user_exercice_unique UNIQUE (user_id, exercice_id)
);

ALTER TABLE public.exercice_consultations ENABLE ROW LEVEL SECURITY;

-- Owner policies
CREATE POLICY "Users can view own exercice consultations"
ON public.exercice_consultations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exercice consultations"
ON public.exercice_consultations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exercice consultations"
ON public.exercice_consultations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own exercice consultations"
ON public.exercice_consultations
FOR DELETE
USING (auth.uid() = user_id);

-- Admin policies (for admin panel visibility)
CREATE POLICY "Admins can view all exercice consultations"
ON public.exercice_consultations
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert any exercice consultations"
ON public.exercice_consultations
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update any exercice consultations"
ON public.exercice_consultations
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete any exercice consultations"
ON public.exercice_consultations
FOR DELETE
USING (is_admin(auth.uid()));

-- Keep updated_at in sync
DROP TRIGGER IF EXISTS update_exercice_consultations_updated_at ON public.exercice_consultations;
CREATE TRIGGER update_exercice_consultations_updated_at
BEFORE UPDATE ON public.exercice_consultations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
