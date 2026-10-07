-- ============================================================================
-- ENTWURF v2 (07.10.2026, nach Astra-Review 711b3449) – NICHT ANWENDEN.
-- Erst nach Freigabe Peter + unabhängiger Codex-Prüfung. Rein additiv,
-- transaktional (ein BEGIN/COMMIT), wiederholbar (idempotent), mit Struktur-
-- prüfung. Offline-Test: docs/wiki/migration-A-testprotokoll.md
--
-- Bezug auf reale Regeln (20260728090000_create_kb_phase1_core.sql):
--  * aktiver Relationstyp braucht >=1 approved Domäne (Constraint-Trigger,
--    DEFERRED, Z. 1029-1042/1455) -> neue Typen hier INAKTIV.
--  * Domänen nur als 'draft' einfügbar (kb_enforce_relation_domain_workflow).
--  * Typ-/Domänen-Schreibrechte nur service_role/Migration (REVOKE Z. 1557ff).
--  * Werte: name_kind {preferred,abbreviation,scientific,trade,historical,
--    spelling_variant}; article role {about,mentions,recommends,warns_about,
--    source_for}; origin_type {human,import,parser,ai}; source_role
--    {supports,refutes,qualifies,mentions}.
--  * kb_entity_relations hat KEIN metadata -> Herkunft an Assertion/
--    kb_assertions.metadata bzw. kb_import_core_links.
-- Nicht enthalten: Änderungen an kb_assertions (keine polarity-Spalte, kein
-- Pauschalwert für Altbestand) – Verneinung über vorhandene source_role
-- refutes/qualifies + neue Konflikttabelle.
-- ============================================================================
BEGIN;

-- 0. Strukturprüfung: existiert ein Objekt bereits, muss es exakt passen.
DO $chk$
DECLARE cols text;
BEGIN
  IF to_regclass('public.kb_source_actors') IS NOT NULL THEN
    SELECT string_agg(column_name, ',' ORDER BY column_name) INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'kb_source_actors';
    IF cols IS DISTINCT FROM 'created_at,created_by,entity_id,id,import_batch_id,locator,origin_type,original_quote,review_notes,review_status,reviewed_at,reviewed_by,role,source_revision_id,supersedes_id' THEN
      RAISE EXCEPTION 'kb_source_actors existiert mit abweichender Struktur: %', cols;
    END IF;
  END IF;
  IF to_regclass('public.kb_assertion_conflicts') IS NOT NULL THEN
    SELECT string_agg(column_name, ',' ORDER BY column_name) INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'kb_assertion_conflicts';
    IF cols IS DISTINCT FROM 'assertion_a_id,assertion_b_id,conflict_kind,created_at,created_by,id,note' THEN
      RAISE EXCEPTION 'kb_assertion_conflicts existiert mit abweichender Struktur: %', cols;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.kb_relation_types WHERE code = 'offered_by' AND is_symmetric) THEN
    RAISE EXCEPTION 'offered_by existiert mit abweichender Symmetrie';
  END IF;
END
$chk$;

-- 1. Typen: neu und INAKTIV (Aktivierung später gemeinsam mit Domänenfreigabe).
INSERT INTO public.kb_entity_types (code, label, description, is_active)
VALUES ('person', 'Person', 'Autor, Referent, Therapeut', false),
       ('organization', 'Organisation', 'Firma, Plattform, Produktlinie, Versandhändler', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.kb_relation_types (code, label, description, is_symmetric, is_active)
VALUES ('offered_by', 'geführt von', 'Apotheke/Händler führt Produkt (laut Quelle)', false, false)
ON CONFLICT (code) DO NOTHING;
-- authored_by/published_by bewusst NICHT als Entitätsrelation: Autor/Herausgeber
-- hängen an der Quellenrevision (kb_source_actors), nicht Entität->Entität.

-- 2. Vollständiger Domänenplan (nur draft; Freigabe später per Migration).
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

-- 3. Quelle <-> Akteur, revisionsfest, Review nur über Funktion.
CREATE TABLE IF NOT EXISTS public.kb_source_actors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_revision_id uuid NOT NULL REFERENCES public.kb_source_revisions(id) ON DELETE RESTRICT,
  entity_id uuid NOT NULL REFERENCES public.kb_entities(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('author', 'publisher', 'manufacturer', 'pharmacy')),
  locator text NOT NULL CHECK (btrim(locator) <> ''),
  original_quote text NOT NULL DEFAULT '',
  origin_type text NOT NULL DEFAULT 'import' CHECK (origin_type IN ('human', 'import', 'parser', 'ai')),
  import_batch_id uuid,
  review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'approved', 'withdrawn')),
  review_notes text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  reviewed_by uuid,
  supersedes_id uuid REFERENCES public.kb_source_actors(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CHECK ((review_status = 'draft') = (reviewed_at IS NULL AND reviewed_by IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS kb_source_actors_active_uq
  ON public.kb_source_actors (source_revision_id, entity_id, role)
  WHERE review_status <> 'withdrawn';

CREATE OR REPLACE FUNCTION public.kb_protect_source_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.review_status <> 'draft' THEN
      RAISE EXCEPTION 'Quellen-Akteure muessen als draft angelegt werden';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.review_status <> 'draft' THEN
      RAISE EXCEPTION 'Gepruefte/zurueckgezogene Quellen-Akteure sind nicht loeschbar';
    END IF;
    RETURN OLD;
  END IF;
  -- UPDATE: Inhalt nie aenderbar ausser im Entwurf; Statuswechsel nur ueber Review-Funktion.
  IF NEW.review_status IS DISTINCT FROM OLD.review_status
     AND coalesce(current_setting('kb.source_actor_review', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Statuswechsel nur ueber kb_review_source_actor()';
  END IF;
  IF OLD.review_status = 'withdrawn' THEN
    RAISE EXCEPTION 'Zurueckgezogene Quellen-Akteure sind unveraenderlich';
  END IF;
  IF OLD.review_status = 'approved' AND (
       NEW.review_status <> 'withdrawn'
       OR (to_jsonb(NEW) - ARRAY['review_status','review_notes','reviewed_at','reviewed_by'])
          IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['review_status','review_notes','reviewed_at','reviewed_by'])) THEN
    RAISE EXCEPTION 'Gepruefte Quellen-Akteure sind unveraenderlich (nur Rueckzug)';
  END IF;
  IF OLD.review_status = 'draft' AND NEW.review_status NOT IN ('draft', 'approved') THEN
    RAISE EXCEPTION 'Ungueltiger Uebergang %->%', OLD.review_status, NEW.review_status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS kb_source_actors_protect ON public.kb_source_actors;
CREATE TRIGGER kb_source_actors_protect
  BEFORE INSERT OR UPDATE OR DELETE ON public.kb_source_actors
  FOR EACH ROW EXECUTE FUNCTION public.kb_protect_source_actor();

-- Review-Funktion: Admin-Pruefung, Nachweis Pflicht, kein direkter Tabellenwrite.
-- SECURITY DEFINER noetig, weil set_config im Trigger-Kontext lokal gesetzt wird;
-- Schutz: has_role + Pflichtnotiz + erlaubte Uebergaenge im Trigger.
CREATE OR REPLACE FUNCTION public.kb_review_source_actor(_id uuid, _decision text, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Nur Admin'; END IF;
  IF _decision NOT IN ('approved', 'withdrawn') THEN RAISE EXCEPTION 'Ungueltige Entscheidung'; END IF;
  IF btrim(coalesce(_notes, '')) = '' THEN RAISE EXCEPTION 'Pruefnotiz ist Pflicht'; END IF;
  PERFORM set_config('kb.source_actor_review', 'on', true);
  UPDATE public.kb_source_actors
     SET review_status = _decision, review_notes = _notes,
         reviewed_at = now(), reviewed_by = auth.uid()
   WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nicht gefunden'; END IF;
  PERFORM set_config('kb.source_actor_review', 'off', true);
END $$;
-- Hinweis Codex: set_config ist fuer jeden Client aufrufbar; ein Admin koennte
-- den Schalter in einer eigenen Transaktion setzen. Gegenmassnahme siehe
-- Abschnitt "Offene Pruefpunkte" im Testprotokoll (Variante: Statusspalten per
-- Spalten-GRANT fuer authenticated sperren). Hier umgesetzt:
REVOKE ALL ON FUNCTION public.kb_protect_source_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kb_review_source_actor(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kb_review_source_actor(uuid, text, text) TO authenticated;

REVOKE ALL ON public.kb_source_actors FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.kb_source_actors TO authenticated;
GRANT INSERT (source_revision_id, entity_id, role, locator, original_quote, origin_type, import_batch_id, supersedes_id)
  ON public.kb_source_actors TO authenticated;
GRANT UPDATE (locator, original_quote) ON public.kb_source_actors TO authenticated;
GRANT ALL ON public.kb_source_actors TO service_role;
ALTER TABLE public.kb_source_actors ENABLE ROW LEVEL SECURITY;
DO $p$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kb_source_actors' AND policyname = 'kb_source_actors_admin_all') THEN
    CREATE POLICY kb_source_actors_admin_all ON public.kb_source_actors FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $p$;

-- 4. Widersprueche bewahren: append-only Verknuepfung zweier Aussagen.
CREATE TABLE IF NOT EXISTS public.kb_assertion_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assertion_a_id uuid NOT NULL REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  assertion_b_id uuid NOT NULL REFERENCES public.kb_assertions(id) ON DELETE RESTRICT,
  conflict_kind text NOT NULL CHECK (conflict_kind IN ('contradicts', 'qualifies', 'negates')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  CHECK (assertion_a_id <> assertion_b_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS kb_assertion_conflicts_pair_uq
  ON public.kb_assertion_conflicts (least(assertion_a_id, assertion_b_id), greatest(assertion_a_id, assertion_b_id), conflict_kind);
REVOKE ALL ON public.kb_assertion_conflicts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.kb_assertion_conflicts TO authenticated;  -- kein UPDATE/DELETE
GRANT ALL ON public.kb_assertion_conflicts TO service_role;
ALTER TABLE public.kb_assertion_conflicts ENABLE ROW LEVEL SECURITY;
DO $p$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'kb_assertion_conflicts' AND policyname = 'kb_assertion_conflicts_admin_all') THEN
    CREATE POLICY kb_assertion_conflicts_admin_all ON public.kb_assertion_conflicts FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $p$;

COMMIT;

-- ----------------------------------------------------------------------------
-- SPAETERE Aktivierung (eigene Migration, erst nach Domaenen-Review):
--   BEGIN;
--   UPDATE kb_relation_type_domains SET review_status='approved'
--    WHERE relation_type_code='offered_by' AND subject_entity_type_code='product' AND object_entity_type_code='pharmacy';
--   UPDATE kb_relation_types SET is_active=true WHERE code='offered_by';
--   UPDATE kb_entity_types SET is_active=true WHERE code IN ('person','organization');
--   COMMIT;   -- Constraint-Trigger prueft beim COMMIT
-- ----------------------------------------------------------------------------
