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
  WHERE pseudonym_id = pid
     OR patient_label ~ pid;

  RETURN 'B-' || yr || '-' || num || '-' || k::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_mannayan_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Mannayan-Bestellnummern müssen aus dem Patienten-Pseudonym erzeugt werden (B-YYYY-NNNN-K).';
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_mannayan_order_pseudonym_and_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  extracted_pid text;
  yr text;
  num text;
BEGIN
  extracted_pid := COALESCE(
    NULLIF(NEW.pseudonym_id, ''),
    (regexp_match(COALESCE(NEW.patient_label, ''), 'P-\d{4}-\d{4}'))[1]
  );

  IF extracted_pid IS NULL THEN
    RAISE EXCEPTION 'Mannayan-Bestellung braucht ein Patienten-Pseudonym im Format P-YYYY-NNNN.';
  END IF;

  IF extracted_pid !~ '^P-\d{4}-\d{4}$' THEN
    RAISE EXCEPTION 'Ungültiges Pseudonym: % (erwartet P-YYYY-NNNN)', extracted_pid;
  END IF;

  NEW.pseudonym_id := extracted_pid;

  IF TG_OP = 'INSERT' THEN
    yr := substring(extracted_pid from 3 for 4);
    num := substring(extracted_pid from 8 for 4);

    IF NEW.order_number IS NULL
       OR NEW.order_number !~ ('^B-' || yr || '-' || num || '-\d+$') THEN
      NEW.order_number := public.next_mannayan_order_number_for_pseudonym(extracted_pid);
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_mannayan_order_pseudonym_and_number_trigger ON public.mannayan_orders;
CREATE TRIGGER normalize_mannayan_order_pseudonym_and_number_trigger
BEFORE INSERT OR UPDATE ON public.mannayan_orders
FOR EACH ROW
EXECUTE FUNCTION public.normalize_mannayan_order_pseudonym_and_number();