CREATE TABLE public.infothek_gating (
  href text PRIMARY KEY,
  gated boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.infothek_gating TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.infothek_gating TO authenticated;
GRANT ALL ON public.infothek_gating TO service_role;

ALTER TABLE public.infothek_gating ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read gating"
  ON public.infothek_gating FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert gating"
  ON public.infothek_gating FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update gating"
  ON public.infothek_gating FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete gating"
  ON public.infothek_gating FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_infothek_gating_updated_at
  BEFORE UPDATE ON public.infothek_gating
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();