BEGIN;

-- Nur-Owner-Transport fuer den geprueften 565er-Import.

CREATE TABLE IF NOT EXISTS public._kb_owner_import_3f7a22a0_chunks (
  import_key text NOT NULL,
  seq integer NOT NULL,
  total_chunks integer NOT NULL,
  data text NOT NULL,
  data_length integer NOT NULL,
  data_md5 text NOT NULL,
  payload_length integer NOT NULL,
  payload_md5 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT _kb_owner_import_3f7a22a0_chunks_pk PRIMARY KEY (import_key, seq),
  CONSTRAINT _kb_owner_import_3f7a22a0_chunks_key CHECK (import_key = 'kb-565-3f7a22a088953523'),
  CONSTRAINT _kb_owner_import_3f7a22a0_chunks_seq CHECK (seq BETWEEN 1 AND 41),
  CONSTRAINT _kb_owner_import_3f7a22a0_chunks_total CHECK (total_chunks = 41),
  CONSTRAINT _kb_owner_import_3f7a22a0_chunks_chunk_length CHECK (char_length(data) = data_length),
  CONSTRAINT _kb_owner_import_3f7a22a0_chunks_chunk_md5 CHECK (md5(data) = data_md5),
  CONSTRAINT _kb_owner_import_3f7a22a0_chunks_payload_length CHECK (payload_length = 804812),
  CONSTRAINT _kb_owner_import_3f7a22a0_chunks_payload_md5 CHECK (payload_md5 = '9a89aeffec1bfa0fc84e90049f23319c')
);

ALTER TABLE public._kb_owner_import_3f7a22a0_chunks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public._kb_owner_import_3f7a22a0_chunks FROM PUBLIC;

DO $revoke_transport$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE public._kb_owner_import_3f7a22a0_chunks FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE public._kb_owner_import_3f7a22a0_chunks FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'REVOKE ALL ON TABLE public._kb_owner_import_3f7a22a0_chunks FROM service_role';
  END IF;
END;
$revoke_transport$;

COMMENT ON TABLE public._kb_owner_import_3f7a22a0_chunks IS 'Temporary owner-only transport for kb-565-3f7a22a088953523; drop after verified atomic import';

COMMIT;