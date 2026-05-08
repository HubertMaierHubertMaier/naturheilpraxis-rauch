
-- Update generator function: prefix B- statt P-
CREATE OR REPLACE FUNCTION public.next_mannayan_order_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  yr text := to_char(now(), 'YYYY');
  n int;
BEGIN
  n := nextval('public.mannayan_order_seq');
  RETURN 'B-' || yr || '-' || lpad(n::text, 4, '0');
END;
$function$;

-- Bestehende Bestellnummern umbenennen P-YYYY-NNNN -> B-YYYY-NNNN
UPDATE public.mannayan_orders
SET order_number = 'B-' || substring(order_number from 3)
WHERE order_number LIKE 'P-%';
