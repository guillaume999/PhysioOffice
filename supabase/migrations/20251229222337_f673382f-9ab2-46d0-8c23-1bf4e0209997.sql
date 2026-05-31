-- Allow admins to update subscription_limits
CREATE POLICY "Admins can update subscription limits"
ON public.subscription_limits
FOR UPDATE
USING (is_admin(auth.uid()));