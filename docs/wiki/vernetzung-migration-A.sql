-- ============================================================================
-- ENTWURF v3 (07.10.2026, nach Astra d45b236c) – NICHT ANWENDEN.
-- Rein additiv, eine Transaktion, wiederholbar. Abschluss-Strukturprüfung
-- vergleicht tatsächliche Definitionen (Spalten inkl. Typ/NULL/Default,
-- Constraints inkl. FK/CHECK, Indizes, Policies, Trigger, Grants) gegen einen
-- Soll-Fingerabdruck; Abweichung -> RAISE -> kompletter Rollback.
-- Offline-Test: docs/wiki/migration-A-offline-test.ts, Protokoll: migration-A-testprotokoll.md
--
-- Reale Regeln (20260728090000_create_kb_phase1_core.sql): aktiver Relationstyp
-- braucht approved Domäne (deferred Constraint-Trigger) -> neue Typen INAKTIV;
-- Domänen nur als draft; Werte name_kind/role/origin_type/source_role wie Kernschema.
--
-- Polarität (Astra P1-2): Inhaltspolarität gehört zur AUSSAGE, Quellenhaltung zur
-- Quellverknüpfung. "Quelle belegt: X hilft nicht" = negative Assertion
-- (kb_assertions.metadata.claim_polarity='negative') + source_role='supports'.
-- source_role='refutes' heißt: Quelle widerspricht der jeweiligen Aussage.
-- Altbestand ohne claim_polarity = nicht klassifiziert (kein Pauschalwert,
-- keine Änderung an kb_assertions).
-- ============================================================================
BEGIN;

-- 1. Typen inaktiv, Domänen draft
INSERT INTO public.kb_entity_types (code, label, description, is_active)
VALUES ('person', 'Person', 'Autor, Referent, Therapeut', false),
       ('organization', 'Organisation', 'Firma, Plattform, Produktlinie, Versandhändler', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.kb_relation_types (code, label, description, is_symmetric, is_active)
VALUES ('offered_by', 'geführt von', 'Apotheke/Händler führt Produkt (laut Quelle)', false, false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.kb_relation_type_domains
  (relation_type_code, subject_entity_type_code, object_entity_type_code, review_status)
VALUES
  ('offered_by', 'product', 'pharmacy', 'draft'),
  ('offered_by', 'product_variant', 'pharmacy', 'draft'),
  ('offered_by', 'product', 'organization', 'draft'),
  ('offered_by', 'product_variant', 'organization', 'draft'),
  ('manufactured_by', 'product', 'organization', 'draft'),
  ('manufactured_by', 'product_variant', 'organization', 'draft')
ON CONFLICT (relation_type_code, subject_entity_type_code, object_entity_type_code) DO NOTHING;

-- 2. Quelle <-> Akteur. review_status nur draft|approved; Genehmigung danach
--    vollständig unveränderlich. Rücknahme = eigenes append-only Ereignis.
CREATE TABLE IF NOT EXISTS public.kb_source_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_revision_id uuid NOT NULL REFERENCES public.kb_source_revisions(id) ON DELETE RESTRICT,
  entity_id uuid NOT NULL REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('author', 'publisher', 'manufacturer', 'pharmacy')),
  locator text NOT NULL CHECK (btrim(locator) <> ''),
  original_quote text NOT NULL DEFAULT '',
  origin_type text NOT NULL DEFAULT 'import' CHECK (origin_type IN ('human', 'import', 'parser', 'ai')),
  import_batch_id uuid,
  review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'approved')),
  review_notes text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  reviewed_by uuid,
  supersedes_id uuid REFERENCES public.kb_source_actors(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CONSTRAINT kb_source_actors_review_evidence CHECK (
    (review_status = 'draft' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (review_status = 'approved' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND btrim(review_notes) <> ''))
);
CREATE INDEX IF NOT EXISTS kb_source_actors_lookup_idx
  ON public.kb_source_actors (source_revision_id, entity_id, role);

CREATE TABLE IF NOT EXISTS public.kb_source_actor_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_actor_id uuid NOT NULL UNIQUE REFERENCES public.kb_source_actors(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  withdrawn_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_by uuid NOT NULL
);

-- Restore-Modus: nur innerhalb kb_restore_source_network() (SECURITY DEFINER,
-- nur service_role). Für authenticated wirkungslos, da Spaltengrants fehlen und
-- current_user dort 'authenticated' ist.
CREATE OR REPLACE FUNCTION public.kb_in_restore_mode()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(current_setting('kb.source_network_restore', true), '') = 'on'
     AND current_user NOT IN ('authenticated', 'anon')
$$;

CREATE OR REPLACE FUNCTION public.kb_protect_source_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.review_status <> 'draft' AND NOT public.kb_in_restore_mode() THEN
      RAISE EXCEPTION 'Quellen-Akteure muessen als draft angelegt werden';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.review_status <> 'draft' THEN
      RAISE EXCEPTION 'Gepruefte Quellen-Akteure sind nicht loeschbar';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.review_status = 'approved' THEN
    RAISE EXCEPTION 'Gepruefte Quellen-Akteure sind unveraenderlich (Ruecknahme ueber kb_withdraw_source_actor)';
  END IF;
  IF NEW.review_status IS DISTINCT FROM OLD.review_status
     AND coalesce(current_setting('kb.source_actor_review', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Statuswechsel nur ueber kb_review_source_actor()';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.kb_protect_append_only()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION '% ist append-only', TG_TABLE_NAME;
END $$;

DROP TRIGGER IF EXISTS kb_source_actors_protect ON public.kb_source_actors;
CREATE TRIGGER kb_source_actors_protect
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_source_actors
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_source_actor();
DROP TRIGGER IF EXISTS kb_source_actor_withdrawals_protect ON public.kb_source_actor_withdrawals;
CREATE TRIGGER kb_source_actor_withdrawals_protect
  BEFORE UPDATE OR DELETE ON public.kb_source_actor_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_append_only();

CREATE OR REPLACE FUNCTION public.kb_review_source_actor(_id uuid, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur Admin'; END IF;
  IF btrim(coalesce(_notes, '')) = '' THEN RAISE EXCEPTION 'Pruefnotiz ist Pflicht'; END IF;
  PERFORM set_config('kb.source_actor_review', 'on', true);
  UPDATE public.kb_source_actors
     SET review_status = 'approved', review_notes = _notes, reviewed_at = now(), reviewed_by = auth.uid()
   WHERE id = _id AND review_status = 'draft';
  PERFORM set_config('kb.source_actor_review', 'off', true);
  IF NOT FOUND THEN RAISE EXCEPTION 'Kein Entwurf mit dieser ID'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.kb_withdraw_source_actor(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur Admin'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kb_source_actors WHERE id = _id AND review_status = 'approved') THEN
    RAISE EXCEPTION 'Nur gepruefte Zuordnungen koennen zurueckgenommen werden';
  END IF;
  INSERT INTO public.kb_source_actor_withdrawals (source_actor_id, reason, withdrawn_by)
  VALUES (_id, _reason, auth.uid());
END $$;

-- 3. Widersprüche zwischen Aussagen, append-only
CREATE TABLE IF NOT EXISTS public.kb_assertion_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assertion_a_id uuid NOT NULL REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  assertion_b_id uuid NOT NULL REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  conflict_kind text NOT NULL CHECK (conflict_kind IN ('contradicts', 'qualifies')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CHECK (assertion_a_id <> assertion_b_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS kb_assertion_conflicts_pair_uq
  ON public.kb_assertion_conflicts (least(assertion_a_id, assertion_b_id), greatest(assertion_a_id, assertion_b_id), conflict_kind);
DROP TRIGGER IF EXISTS kb_assertion_conflicts_protect ON public.kb_assertion_conflicts;
CREATE TRIGGER kb_assertion_conflicts_protect
  BEFORE UPDATE OR DELETE ON public.kb_assertion_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_append_only();

-- 4. Isolierter Export / kontrollierter Restore (nur service_role)
CREATE OR REPLACE FUNCTION public.kb_export_source_network()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'format', 'kb_source_network_v1',
    'kb_source_actors', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at, a.id) FROM public.kb_source_actors a), '[]'),
    'kb_source_actor_withdrawals', coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY w.withdrawn_at, w.id) FROM public.kb_source_actor_withdrawals w), '[]'),
    'kb_assertion_conflicts', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.created_at, c.id) FROM public.kb_assertion_conflicts c), '[]'))
$$;

CREATE OR REPLACE FUNCTION public.kb_restore_source_network(_dump jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n_a int; n_w int; n_c int;
BEGIN
  IF _dump->>'format' IS DISTINCT FROM 'kb_source_network_v1' THEN RAISE EXCEPTION 'Unbekanntes Format'; END IF;
  IF EXISTS (SELECT 1 FROM public.kb_source_actors) OR EXISTS (SELECT 1 FROM public.kb_source_actor_withdrawals)
     OR EXISTS (SELECT 1 FROM public.kb_assertion_conflicts) THEN
    RAISE EXCEPTION 'Restore nur in leere Zieltabellen';
  END IF;
  PERFORM set_config('kb.source_network_restore', 'on', true);
  -- supersedes-Reihenfolge: Eltern vor Kindern (Tiefe aufsteigend)
  WITH RECURSIVE rows AS (SELECT * FROM jsonb_populate_recordset(NULL::public.kb_source_actors, _dump->'kb_source_actors')),
  depth AS (
    SELECT r.id, 0 AS d FROM rows r WHERE r.supersedes_id IS NULL
    UNION ALL SELECT r.id, depth.d + 1 FROM rows r JOIN depth ON r.supersedes_id = depth.id)
  INSERT INTO public.kb_source_actors SELECT r.* FROM rows r JOIN depth USING (id) ORDER BY depth.d, r.created_at, r.id;
  GET DIAGNOSTICS n_a = ROW_COUNT;
  IF n_a <> jsonb_array_length(_dump->'kb_source_actors') THEN RAISE EXCEPTION 'supersedes-Kette unvollstaendig'; END IF;
  INSERT INTO public.kb_source_actor_withdrawals
    SELECT * FROM jsonb_populate_recordset(NULL::public.kb_source_actor_withdrawals, _dump->'kb_source_actor_withdrawals');
  GET DIAGNOSTICS n_w = ROW_COUNT;
  INSERT INTO public.kb_assertion_conflicts
    SELECT * FROM jsonb_populate_recordset(NULL::public.kb_assertion_conflicts, _dump->'kb_assertion_conflicts');
  GET DIAGNOSTICS n_c = ROW_COUNT;
  PERFORM set_config('kb.source_network_restore', 'off', true);
  RETURN jsonb_build_object('kb_source_actors', n_a, 'kb_source_actor_withdrawals', n_w, 'kb_assertion_conflicts', n_c);
END $$;

-- 5. Rechte
REVOKE ALL ON FUNCTION public.kb_protect_source_actor(), public.kb_protect_append_only(), public.kb_in_restore_mode() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_review_source_actor(uuid, text), public.kb_withdraw_source_actor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_review_source_actor(uuid, text), public.kb_withdraw_source_actor(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.kb_export_source_network(), public.kb_restore_source_network(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kb_export_source_network(), public.kb_restore_source_network(jsonb) TO service_role;

REVOKE ALL ON public.kb_source_actors, public.kb_source_actor_withdrawals, public.kb_assertion_conflicts FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.kb_source_actors TO authenticated;
GRANT INSERT (source_revision_id, entity_id, role, locator, original_quote, origin_type, import_batch_id, supersedes_id)
  ON public.kb_source_actors TO authenticated;
GRANT UPDATE (locator, original_quote) ON public.kb_source_actors TO authenticated;
GRANT SELECT ON public.kb_source_actor_withdrawals TO authenticated;
GRANT SELECT, INSERT ON public.kb_assertion_conflicts TO authenticated;
GRANT ALL ON public.kb_source_actors, public.kb_source_actor_withdrawals, public.kb_assertion_conflicts TO service_role;

ALTER TABLE public.kb_source_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_source_actor_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_assertion_conflicts ENABLE ROW LEVEL SECURITY;
DO $p$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kb_source_actors', 'kb_source_actor_withdrawals', 'kb_assertion_conflicts'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_admin_all') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated
        USING (public.has_role(auth.uid(), ''admin''::public.app_role))
        WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))', t || '_admin_all', t);
    END IF;
  END LOOP;
END $p$;

-- 6. Abschluss-Strukturprüfung gegen Soll-Fingerabdruck (tatsächliche Definitionen).
--    Gleichnamige, aber abweichende Objekte -> RAISE -> Rollback der ganzen Migration.
DO $chk$
DECLARE fp text; expected constant text := '768c0de7f04c2dafd01f17a3c04b4c49';
BEGIN
  SELECT md5(string_agg(x, E'\n' ORDER BY x)) INTO fp FROM (
    SELECT format('col|%s|%s|%s|%s|%s', c.table_name, c.column_name, c.data_type, c.is_nullable, coalesce(c.column_default, ''))
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name IN ('kb_source_actors', 'kb_source_actor_withdrawals', 'kb_assertion_conflicts')
    UNION ALL
    SELECT format('con|%s|%s|%s', conrelid::regclass, contype, pg_get_constraintdef(oid))
      FROM pg_constraint WHERE conrelid IN ('public.kb_source_actors'::regclass, 'public.kb_source_actor_withdrawals'::regclass, 'public.kb_assertion_conflicts'::regclass)
    UNION ALL
    SELECT format('idx|%s', pg_get_indexdef(indexrelid))
      FROM pg_index WHERE indrelid IN ('public.kb_source_actors'::regclass, 'public.kb_source_actor_withdrawals'::regclass, 'public.kb_assertion_conflicts'::regclass)
    UNION ALL
    SELECT format('pol|%s|%s|%s|%s|%s|%s', tablename, policyname, cmd, roles::text, coalesce(qual, ''), coalesce(with_check, ''))
      FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('kb_source_actors', 'kb_source_actor_withdrawals', 'kb_assertion_conflicts')
    UNION ALL
    SELECT format('trg|%s|%s', tgrelid::regclass, pg_get_triggerdef(oid))
      FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('public.kb_source_actors'::regclass, 'public.kb_source_actor_withdrawals'::regclass, 'public.kb_assertion_conflicts'::regclass)
    UNION ALL
    SELECT format('acl|%s|%s', relname, relacl::text) FROM pg_class
     WHERE oid IN ('public.kb_source_actors'::regclass, 'public.kb_source_actor_withdrawals'::regclass, 'public.kb_assertion_conflicts'::regclass)
    UNION ALL
    SELECT format('rls|%s|%s', relname, relrowsecurity) FROM pg_class
     WHERE oid IN ('public.kb_source_actors'::regclass, 'public.kb_source_actor_withdrawals'::regclass, 'public.kb_assertion_conflicts'::regclass)
    UNION ALL
    SELECT format('typ|%s|%s', code, is_active) FROM public.kb_entity_types WHERE code IN ('person', 'organization')
    UNION ALL
    SELECT format('rel|%s|%s|%s', code, is_symmetric, is_active) FROM public.kb_relation_types WHERE code = 'offered_by'
  ) s(x);
  IF fp IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Strukturabweichung: Fingerabdruck % statt %', fp, expected;
  END IF;
END
$chk$;

COMMIT;

-- SPÄTERE Aktivierung (eigene Migration nach Domänen-Review):
--   BEGIN; UPDATE kb_relation_type_domains SET review_status='approved' WHERE ...;
--   UPDATE kb_relation_types SET is_active=true WHERE code='offered_by'; COMMIT;
