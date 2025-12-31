-- Create project_files table to track shared files
CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  description TEXT,
  uploaded_by TEXT NOT NULL DEFAULT 'admin', -- 'admin' or 'client'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- Admins can manage all files
CREATE POLICY "Admins can manage all project files"
  ON public.project_files
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Clients can view their files
CREATE POLICY "Clients can view their project files"
  ON public.project_files
  FOR SELECT
  USING (
    client_id IN (
      SELECT clients.id FROM clients
      WHERE clients.email = (
        SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
      )
    )
  );

-- Clients can upload files
CREATE POLICY "Clients can upload project files"
  ON public.project_files
  FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT clients.id FROM clients
      WHERE clients.email = (
        SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
      )
    )
  );

-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for project files bucket
CREATE POLICY "Admins can manage project files storage"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'project-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can view their project files storage"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] IN (
      SELECT clients.id::text FROM clients
      WHERE clients.email = (
        SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
      )
    )
  );

CREATE POLICY "Clients can upload to their folder"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files' AND
    (storage.foldername(name))[1] IN (
      SELECT clients.id::text FROM clients
      WHERE clients.email = (
        SELECT profiles.email FROM profiles WHERE profiles.id = auth.uid()
      )
    )
  );