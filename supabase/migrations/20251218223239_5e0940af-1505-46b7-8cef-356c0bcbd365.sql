-- Remove the policy that allows admins to view all patients
DROP POLICY IF EXISTS "Admins can view all patients" ON public.patients;