
CREATE TABLE public.admin_knowledge_base (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Allgemein',
  tags TEXT[] NOT NULL DEFAULT '{}',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything with knowledge base"
  ON public.admin_knowledge_base
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_admin_knowledge_base_updated_at
  BEFORE UPDATE ON public.admin_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
