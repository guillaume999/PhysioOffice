-- Fix exercice sharing workflow permissions
-- 1) Allow owner to move draft -> pending (submit for validation)
DROP POLICY IF EXISTS "Users can update own draft exercices" ON public.exercices;
CREATE POLICY "Users can update own draft exercices"
ON public.exercices
FOR UPDATE
USING (
  auth.uid() = user_id
  AND status = 'draft'
)
WITH CHECK (
  auth.uid() = user_id
  AND status IN ('draft','pending')
);

-- 2) Allow owner to cancel sharing: pending -> draft
DROP POLICY IF EXISTS "Users can cancel own pending exercices" ON public.exercices;
CREATE POLICY "Users can cancel own pending exercices"
ON public.exercices
FOR UPDATE
USING (
  auth.uid() = user_id
  AND status = 'pending'
)
WITH CHECK (
  auth.uid() = user_id
  AND status = 'draft'
);
