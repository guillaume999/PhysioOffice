-- 1. First delete all storage objects in the videos bucket
DELETE FROM storage.objects WHERE bucket_id = 'videos';

-- 2. Then delete the bucket
DELETE FROM storage.buckets WHERE id = 'videos';

-- 3. Finally drop the videos table (CASCADE handles RLS policies and FK references)
DROP TABLE IF EXISTS public.videos CASCADE;