-- ENTWURF – NICHT ANWENDEN ohne Freigabe (Peter) und Prüfung (Codex). Rein additiv.
INSERT INTO public.kb_entity_types(code,label,description,is_active,metadata) VALUES
 ('person','Person','Autor/Referent/Therapeut',true,'{}'),
 ('organization','Organisation','Firma, Plattform, Produktlinie',true,'{}')
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.kb_relation_types(code,label,description,is_symmetric,is_active) VALUES
 ('offered_by','geführt von','Apotheke/Händler führt Produkt (laut Quelle)',false,true),
 ('authored_by','verfasst von','Quelle/Inhalt verfasst von Person',false,true),
 ('published_by','herausgegeben von','Quelle herausgegeben von Organisation',false,true)
ON CONFLICT (code) DO NOTHING;
-- Domänen (review_status 'draft', aktiv erst nach Review)
INSERT INTO public.kb_relation_type_domains(relation_type_code,subject_entity_type_code,object_entity_type_code,review_status) VALUES
 ('manufactured_by','product','organization','draft'),('manufactured_by','product_variant','organization','draft'),
 ('offered_by','product','pharmacy','draft'),('offered_by','product_variant','pharmacy','draft'),
 ('offered_by','product','organization','draft')
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.kb_source_actors(
  source_revision_id uuid NOT NULL REFERENCES public.kb_source_revisions(id),
  entity_id uuid NOT NULL REFERENCES public.kb_entities(id),
  role text NOT NULL CHECK (role IN ('author','publisher','manufacturer','pharmacy')),
  origin_type text NOT NULL DEFAULT 'import',
  review_status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid,
  PRIMARY KEY (source_revision_id, entity_id, role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kb_source_actors TO authenticated;
GRANT ALL ON public.kb_source_actors TO service_role;
ALTER TABLE public.kb_source_actors ENABLE ROW LEVEL SECURITY;
CREATE POLICY kb_source_actors_admin_all ON public.kb_source_actors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
ALTER TABLE public.kb_assertions ADD COLUMN IF NOT EXISTS polarity text NOT NULL DEFAULT 'affirms';
ALTER TABLE public.kb_assertions ADD COLUMN IF NOT EXISTS contradicts_assertion_id uuid REFERENCES public.kb_assertions(id);
-- Offen für Codex-Prüfung: Constraint-Namen/ON CONFLICT-Ziele gegen Hosted-Schema verifizieren; Trigger kb_validate_* auf Verträglichkeit mit polarity prüfen.
