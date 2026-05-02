
-- Fix annonces: replace public unauthenticated SELECT with authenticated-only
DROP POLICY IF EXISTS "Anyone can view active announcements" ON public.annonces;
CREATE POLICY "Authenticated users can view active announcements"
ON public.annonces
FOR SELECT
TO authenticated
USING (is_active = true AND expires_at > now());

-- Fix contact_messages: add admin-only SELECT
CREATE POLICY "Admins can view contact messages"
ON public.contact_messages
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Fix videos storage bucket: replace public SELECT with owner-scoped
DROP POLICY IF EXISTS "Users can view all videos" ON storage.objects;
CREATE POLICY "Users can view own videos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'exercice-videos' AND (auth.uid())::text = (storage.foldername(name))[1]);
