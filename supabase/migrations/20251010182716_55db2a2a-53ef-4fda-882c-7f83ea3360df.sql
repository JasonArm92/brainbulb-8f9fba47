-- Create design_submissions table for client approval workflow
CREATE TABLE public.design_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.design_submissions ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all submissions"
ON public.design_submissions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Clients can view and update their own submissions
CREATE POLICY "Clients can view their submissions"
ON public.design_submissions
FOR SELECT
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE email = (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Clients can update their submissions"
ON public.design_submissions
FOR UPDATE
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE email = (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- Create messages table for real-time chat
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
ON public.messages
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can send messages
CREATE POLICY "Admins can send messages"
ON public.messages
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Clients can view their own messages
CREATE POLICY "Clients can view their messages"
ON public.messages
FOR SELECT
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE email = (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- Clients can send messages
CREATE POLICY "Clients can send messages"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  client_id IN (
    SELECT id FROM public.clients WHERE email = (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- Create storage bucket for design submissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('design-submissions', 'design-submissions', true);

-- Create storage bucket for client files
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-files', 'client-files', false);

-- Storage policies for design submissions
CREATE POLICY "Admins can upload designs"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'design-submissions' AND
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update designs"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'design-submissions' AND
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Anyone can view designs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'design-submissions');

-- Storage policies for client files
CREATE POLICY "Clients can upload their files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'client-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all client files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'client-files' AND
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Clients can view their own files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'client-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add trigger for design_submissions updated_at
CREATE TRIGGER update_design_submissions_updated_at
BEFORE UPDATE ON public.design_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();