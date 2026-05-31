-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Allow admins to update all profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Allow admins to view all patients (for stats)
CREATE POLICY "Admins can view all patients"
ON public.patients
FOR SELECT
USING (public.is_admin(auth.uid()));

-- Allow admins to manage all seance_types
CREATE POLICY "Admins can delete any seance"
ON public.seance_types
FOR DELETE
USING (public.is_admin(auth.uid()));