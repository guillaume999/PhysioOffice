-- Create subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM ('free', 'basic', 'premium');

-- Add subscription_tier column to profiles (replacing is_premium logic)
ALTER TABLE public.profiles 
ADD COLUMN subscription_tier subscription_tier NOT NULL DEFAULT 'free',
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_subscription_id TEXT,
ADD COLUMN subscription_end_date TIMESTAMP WITH TIME ZONE;

-- Create subscription_limits table to store tier limits
CREATE TABLE public.subscription_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier subscription_tier NOT NULL UNIQUE,
  max_patients INTEGER NOT NULL,
  max_exercices INTEGER NOT NULL,
  max_seances INTEGER NOT NULL,
  max_traitements INTEGER NOT NULL,
  can_share_exercices BOOLEAN NOT NULL DEFAULT false,
  can_use_ai BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default limits
INSERT INTO public.subscription_limits (tier, max_patients, max_exercices, max_seances, max_traitements, can_share_exercices, can_use_ai) VALUES
('free', 10, 5, 5, 5, false, false),
('basic', 20, 15, 15, 15, true, true),
('premium', 700, 50, 50, 50, true, true);

-- Enable RLS on subscription_limits
ALTER TABLE public.subscription_limits ENABLE ROW LEVEL SECURITY;

-- Everyone can view subscription limits (it's public info)
CREATE POLICY "Anyone can view subscription limits" 
ON public.subscription_limits 
FOR SELECT 
USING (true);

-- Create subscription_prices table
CREATE TABLE public.subscription_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier subscription_tier NOT NULL,
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tier, billing_period)
);

-- Insert default prices (Basic: 3.99€/month, Premium: 19.99€/month, with 10% annual discount)
INSERT INTO public.subscription_prices (tier, billing_period, price_cents) VALUES
('basic', 'monthly', 399),
('basic', 'yearly', 4309), -- 3.99 * 12 * 0.9 = 43.09€
('premium', 'monthly', 1999),
('premium', 'yearly', 21589); -- 19.99 * 12 * 0.9 = 215.89€

-- Enable RLS on subscription_prices
ALTER TABLE public.subscription_prices ENABLE ROW LEVEL SECURITY;

-- Everyone can view subscription prices
CREATE POLICY "Anyone can view subscription prices" 
ON public.subscription_prices 
FOR SELECT 
USING (true);

-- Create function to get user subscription tier
CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(_user_id uuid)
RETURNS subscription_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT subscription_tier FROM public.profiles WHERE user_id = _user_id),
    'free'::subscription_tier
  )
$$;

-- Create function to check if user can create more items
CREATE OR REPLACE FUNCTION public.can_create_item(_user_id uuid, _item_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier subscription_tier;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier FROM profiles WHERE user_id = _user_id;
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;

  -- Get the limit for this tier and item type
  SELECT 
    CASE _item_type
      WHEN 'patients' THEN max_patients
      WHEN 'exercices' THEN max_exercices
      WHEN 'seances' THEN max_seances
      WHEN 'traitements' THEN max_traitements
      ELSE 0
    END INTO max_allowed
  FROM subscription_limits WHERE tier = user_tier;

  -- Get current count
  CASE _item_type
    WHEN 'patients' THEN
      SELECT COUNT(*) INTO current_count FROM patients WHERE user_id = _user_id;
    WHEN 'exercices' THEN
      SELECT COUNT(*) INTO current_count FROM exercices WHERE user_id = _user_id AND is_copy = false;
    WHEN 'seances' THEN
      SELECT COUNT(*) INTO current_count FROM seance_types WHERE user_id = _user_id AND is_copy = false;
    WHEN 'traitements' THEN
      SELECT COUNT(*) INTO current_count FROM traitement_types WHERE user_id = _user_id AND is_copy = false;
    ELSE
      current_count := 0;
  END CASE;

  RETURN current_count < max_allowed;
END;
$$;