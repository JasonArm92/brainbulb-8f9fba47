-- 1. Add RLS policy to allow public contact form submissions
CREATE POLICY "Allow public contact form submissions" 
  ON public.clients 
  FOR INSERT 
  WITH CHECK (true);

-- 2. Make design-submissions bucket private (security fix)
UPDATE storage.buckets 
SET public = false 
WHERE id = 'design-submissions';