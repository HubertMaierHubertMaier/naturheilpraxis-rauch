
-- Erlaubte Order-Number-Formate erweitern (alt B-YYYY-NNNN und neu B-YYYY-NNNN-K)
ALTER TABLE public.mannayan_orders
  DROP CONSTRAINT IF EXISTS mannayan_orders_order_number_format;
ALTER TABLE public.mannayan_orders
  ADD CONSTRAINT mannayan_orders_order_number_format
  CHECK (order_number ~ '^B-\d{4}-\d{4}(-\d+)?$' OR order_number ~ '^P-\d{4}-\d{4}$');

CREATE OR REPLACE FUNCTION public.next_mannayan_order_number_for_pseudonym(_pseudonym text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid text;
  yr text;
  num text;
  k int;
  candidate text;
BEGIN
  IF _pseudonym IS NULL OR _pseudonym !~ '^P-\d{4}-\d{4}$' THEN
    RAISE EXCEPTION 'Ungültiges Pseudonym: % (erwartet P-YYYY-NNNN)', _pseudonym;
  END IF;

  pid := _pseudonym;
  yr := substring(pid from 3 for 4);
  num := substring(pid from 8 for 4);

  SELECT COALESCE(MAX(
    CASE
      WHEN order_number ~ ('^B-' || yr || '-' || num || '-\d+$')
        THEN (regexp_match(order_number, '-(\d+)$'))[1]::int
      ELSE 0
    END
  ), 0) + 1
    INTO k
  FROM public.mannayan_orders
  WHERE pseudonym_id = pid;

  candidate := 'B-' || yr || '-' || num || '-' || k::text;
  RETURN candidate;
END;
$$;
