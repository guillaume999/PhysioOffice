-- Allow authenticated users to update their own video objects (required for resumable/TUS uploads)
DROP POLICY IF EXISTS "Users can update own videos" ON storage.objects;

CREATE POLICY "Users can update own videos"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
