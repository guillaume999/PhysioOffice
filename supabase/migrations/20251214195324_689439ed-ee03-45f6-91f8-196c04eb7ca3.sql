-- Add new columns to videos table
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS category_pathology text,
ADD COLUMN IF NOT EXISTS type_renfo text,
ADD COLUMN IF NOT EXISTS most_used_patho text;