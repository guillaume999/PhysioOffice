-- Add is_copy field to videos to track copied content
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS is_copy BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_id uuid REFERENCES public.videos(id) ON DELETE SET NULL;

-- Add is_copy field to seance_types to track copied content
ALTER TABLE public.seance_types 
ADD COLUMN IF NOT EXISTS is_copy BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_id uuid REFERENCES public.seance_types(id) ON DELETE SET NULL;