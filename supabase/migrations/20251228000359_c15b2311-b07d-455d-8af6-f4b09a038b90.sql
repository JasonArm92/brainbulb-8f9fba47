-- Create milestones table for project tracking
CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can manage milestones"
ON public.milestones
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Clients can view their own milestones
CREATE POLICY "Clients can view their milestones"
ON public.milestones
FOR SELECT
USING (client_id IN (
  SELECT id FROM clients WHERE email = (
    SELECT email FROM profiles WHERE id = auth.uid()
  )
));

-- Trigger for updated_at
CREATE TRIGGER update_milestones_updated_at
BEFORE UPDATE ON public.milestones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.milestones;