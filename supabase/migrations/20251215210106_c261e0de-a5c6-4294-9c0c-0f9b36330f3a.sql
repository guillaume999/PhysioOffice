-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Add trial_end_date and is_trial_active to profiles
ALTER TABLE public.profiles 
ADD COLUMN trial_end_date TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '14 days'),
ADD COLUMN is_premium BOOLEAN DEFAULT false;

-- Create featured_seances table for admin-selected seances available during trial
CREATE TABLE public.featured_seances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seance_type_id uuid REFERENCES public.seance_types(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  added_by uuid NOT NULL,
  UNIQUE (seance_type_id)
);

ALTER TABLE public.featured_seances ENABLE ROW LEVEL SECURITY;

-- Everyone can view featured seances
CREATE POLICY "Everyone can view featured seances"
ON public.featured_seances
FOR SELECT
USING (true);

-- Only admins can manage featured seances
CREATE POLICY "Admins can insert featured seances"
ON public.featured_seances
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete featured seances"
ON public.featured_seances
FOR DELETE
USING (public.is_admin(auth.uid()));

-- Create trigger to auto-assign user role on new user
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Update seance_types RLS to handle trial restrictions
DROP POLICY IF EXISTS "Users can view own or shared seance types" ON public.seance_types;

CREATE POLICY "Users can view seances based on access"
ON public.seance_types
FOR SELECT
USING (
  auth.uid() = user_id 
  OR is_shared = true
  OR EXISTS (
    SELECT 1 FROM public.featured_seances 
    WHERE featured_seances.seance_type_id = seance_types.id
  )
);