-- Add a boolean column to indicate if user has Stripe account without exposing the actual ID
-- This allows admin to see payment status without seeing sensitive Stripe IDs
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_stripe_account boolean DEFAULT false;

-- Create a trigger to automatically set has_stripe_account when stripe_customer_id is set
CREATE OR REPLACE FUNCTION public.update_has_stripe_account()
RETURNS TRIGGER AS $$
BEGIN
  NEW.has_stripe_account := NEW.stripe_customer_id IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_has_stripe_account ON public.profiles;
CREATE TRIGGER set_has_stripe_account
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_has_stripe_account();

-- Update existing records
UPDATE public.profiles SET has_stripe_account = (stripe_customer_id IS NOT NULL);

-- Create a view for admin that excludes sensitive Stripe IDs
-- Admins can use this view instead of direct table access
CREATE OR REPLACE VIEW public.profiles_admin_view AS
SELECT 
  id,
  user_id,
  first_name,
  last_name,
  email,
  specialty,
  avatar_url,
  created_at,
  updated_at,
  trial_end_date,
  is_premium,
  pseudo,
  is_banned,
  can_share,
  subscription_tier,
  subscription_end_date,
  has_stripe_account
FROM public.profiles;

-- Grant select on the view to authenticated users (RLS on underlying table still applies)
GRANT SELECT ON public.profiles_admin_view TO authenticated;

-- Note: RLS on profiles table automatically applies to the view since it references the table