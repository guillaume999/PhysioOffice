-- Create videos table for independent video library
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for videos
CREATE POLICY "Users can view own videos"
ON public.videos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own videos"
ON public.videos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos"
ON public.videos FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos"
ON public.videos FOR DELETE
USING (auth.uid() = user_id);

-- Add video_id column to exercices table
ALTER TABLE public.exercices
ADD COLUMN video_id UUID REFERENCES public.videos(id) ON DELETE SET NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing videos from exercices to videos table
-- This creates video entries for each unique video_url per user
INSERT INTO public.videos (user_id, title, video_url, thumbnail_url)
SELECT DISTINCT ON (e.video_url, e.user_id)
  e.user_id,
  e.title,
  e.video_url,
  e.thumbnail_url
FROM public.exercices e
WHERE e.video_url IS NOT NULL;

-- Update exercices to reference the new videos
UPDATE public.exercices e
SET video_id = v.id
FROM public.videos v
WHERE e.video_url = v.video_url 
  AND e.user_id = v.user_id
  AND e.video_url IS NOT NULL;