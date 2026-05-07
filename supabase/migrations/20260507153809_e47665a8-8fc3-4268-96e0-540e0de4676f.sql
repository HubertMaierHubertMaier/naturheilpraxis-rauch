
CREATE SEQUENCE IF NOT EXISTS public.mannayan_order_seq START 1;

CREATE TABLE IF NOT EXISTS public.mannayan_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  patient_label text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_eur numeric NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mannayan_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage mannayan_orders"
  ON public.mannayan_orders FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.next_mannayan_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr text := to_char(now(), 'YYYY');
  n int;
BEGIN
  n := nextval('public.mannayan_order_seq');
  RETURN 'P-' || yr || '-' || lpad(n::text, 4, '0');
END;
$$;
