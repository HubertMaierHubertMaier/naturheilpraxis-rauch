CREATE TABLE public.mannayan_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price_eur numeric(10,2) NOT NULL DEFAULT 0,
  unit text DEFAULT '',
  sku text DEFAULT '',
  category text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mannayan_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage mannayan products"
ON public.mannayan_products
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_mannayan_products_name ON public.mannayan_products(name);

CREATE TRIGGER update_mannayan_products_updated_at
BEFORE UPDATE ON public.mannayan_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();