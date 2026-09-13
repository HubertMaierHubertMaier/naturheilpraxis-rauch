-- Purpose-limited server backup access. The owner-only table itself stays protected.
CREATE OR REPLACE FUNCTION public.backup_owner_transport_page(_offset integer DEFAULT 0, _limit integer DEFAULT 1000)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _offset IS NULL OR _offset < 0 OR _limit IS NULL OR _limit < 0 OR _limit > 1000 THEN
    RAISE EXCEPTION 'Invalid backup pagination';
  END IF;
  RETURN jsonb_build_object(
    'total', (SELECT count(*) FROM public._kb_owner_import_3f7a22a0_chunks),
    'rows', (SELECT coalesce(jsonb_agg(to_jsonb(page_row)), '[]'::jsonb)
      FROM (SELECT * FROM public._kb_owner_import_3f7a22a0_chunks
        ORDER BY import_key, seq OFFSET _offset LIMIT _limit) AS page_row)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.backup_owner_transport_page(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_owner_transport_page(integer, integer) TO service_role;
