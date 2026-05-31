-- Remove the SECURITY DEFINER view as it creates security issues
-- Instead, we'll modify the client-side code to select only non-sensitive fields
DROP VIEW IF EXISTS public.profiles_admin_view;