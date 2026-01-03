-- Add storage policy for clients to delete their own files
CREATE POLICY "Clients can delete their own files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'project-files' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.clients
    WHERE email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);