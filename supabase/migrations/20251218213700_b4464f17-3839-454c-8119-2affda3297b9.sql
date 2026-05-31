-- Add category_pathology_tags column as text array
ALTER TABLE public.videos
ADD COLUMN category_pathology_tags TEXT[] DEFAULT '{}';