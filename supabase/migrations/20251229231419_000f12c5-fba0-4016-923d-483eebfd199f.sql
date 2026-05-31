-- Create news table
CREATE TABLE public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'Fonctionnalité',
  is_new boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Everyone can view news
CREATE POLICY "Anyone can view news"
ON public.news
FOR SELECT
USING (true);

-- Only admins can insert news
CREATE POLICY "Admins can insert news"
ON public.news
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Only admins can update news
CREATE POLICY "Admins can update news"
ON public.news
FOR UPDATE
USING (is_admin(auth.uid()));

-- Only admins can delete news
CREATE POLICY "Admins can delete news"
ON public.news
FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_news_updated_at
BEFORE UPDATE ON public.news
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();