-- Drop existing public select policy on annonces and create a new one that requires auth for contact info
DROP POLICY IF EXISTS "Annonces are viewable by everyone" ON public.annonces;
DROP POLICY IF EXISTS "Anyone can view active annonces" ON public.annonces;

-- Create new policy: Only authenticated users can view annonces (protects contact info)
CREATE POLICY "Authenticated users can view active annonces" ON public.annonces
FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- Allow users to view their own annonces regardless of active status
CREATE POLICY "Users can view their own annonces" ON public.annonces
FOR SELECT
USING (auth.uid() = user_id);

-- Allow admins to view all annonces
CREATE POLICY "Admins can view all annonces" ON public.annonces
FOR SELECT
USING (public.is_admin(auth.uid()));