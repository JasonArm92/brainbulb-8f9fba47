-- Add RLS policy for clients to delete their own uploaded files
CREATE POLICY "Clients can delete their own uploaded files"
ON public.project_files
FOR DELETE
USING (
  uploaded_by = 'client' AND
  client_id IN (
    SELECT id FROM public.clients
    WHERE email = (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
);