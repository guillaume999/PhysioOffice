-- Add is_shared column to videos
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;

-- Update videos RLS policy to allow viewing shared videos
DROP POLICY IF EXISTS "Users can view own videos" ON public.videos;

CREATE POLICY "Users can view own or shared videos"
ON public.videos
FOR SELECT
USING (auth.uid() = user_id OR is_shared = true);