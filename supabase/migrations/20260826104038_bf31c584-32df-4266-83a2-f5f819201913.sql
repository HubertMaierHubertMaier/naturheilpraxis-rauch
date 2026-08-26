BEGIN;

-- Additive internal import. Peter's practice statements remain separate from
-- evidence, safety, device compatibility, and patient/public release.
DO $seed$
<<seed>>
DECLARE
  target_batch_id uuid := md5('candida-diet-can-chip-2026-08-26:batch')::uuid;
  practice_source_id uuid := md5('candida-diet-can-chip-2026-08-26:source:practice')::uuid;
  safety_source_id uuid := md5('candida-diet-can-chip-2026-08-26:source:safety')::uuid;
  inventory_hash text := 'd37b439c0d1809c0132eca85f1f0b7d1e599ff16df5cc0f3b5d17e0c90ea66d9';
  practice_excerpt text := $source$Candida-Diät

Die Candida-Diät zur Entfernung des Candida-Pilzes

Verzichten Sie für die Dauer der Diät komplett auf jede Form von Zucker: Fruchtzucker - also jegliches Obst frisch oder getrocknet, Konfitüre, Ahornsirup, Honig, Schokolade, Kokosblütenzucker, Agavendicksaft, zuckerhaltige Mehlspeisen und Gebäck, sowie auf zuckerfreie Süßungsmittel wie Saccharin, Aspartam, Xylit, Erythrol, Sorbit und Cyclamat. Nehmen Sie keine Obst- und Traubensäfte, Limonaden, Cola- oder alkoholische Getränke zu sich.

Der Verzehr von hellen Teigwaren und Weißmehlprodukten ist ebenfalls nicht erlaubt (Weizen und auch Dinkel). Knäckebrot und Vollkornbrot, Vollkornmehl, ungezuckertes Müsli und Reis sollten Sie nur mäßig zu sich nehmen.

Achten Sie beim Einkauf auf versteckte Zucker – die Inhaltsangaben zeigen den oft überraschenden Gehalt an einfachen Kohlehydraten der Nahrungsmittel (z. B. Cashews, Ketchup).

Verzichten Sie beim Verzehr von Fleisch- und Wurstwaren auf Schweinefleisch und auf Paniertes.

Erlaubt sind Fisch und Eier ebenso wie Milch, Käse, ungesüßte Sauermilchprodukte, Butter und Öle. Essen Sie Kartoffeln, Teigwaren aus Hülsenfrüchten (im „Glutenfrei-Sortiment“ der Supermärkte), rohes und gekochtes Wurzelgemüse, Rettich, Radieschen, Hülsenfrüchte, Kohlrabi, Gurken, Tomaten, Spinat, rohes und gekochtes Sauerkraut, Zwiebeln, Knoblauch, Gartenkräuter, Gewürze, Nüsse, Salz. Beschränken Sie sich bei Ihrer Getränkewahl auf ungesüßten Tee oder Kaffee und Wasser oder Mineralwasser.

Wenn eine Candida-Belastung festgestellt wurde, soll dies als Unterpunkt bei den Pathogenen in den Therapievorschlag. Wenn der Patient einen Zapper hat, CAN (Candida-Chip) empfehlen.

Ergänzende Anweisung: Bei vorhandenem Zapper entsprechend Metatron-Auswertung, Symptomen oder Erkrankungen passende ChipCards prüfen. Ohne Zapper die auf der genannten Seite aufgeführten Mittel prüfen. Genannte URL: https://diamondshieldzapper.com/diamond-shield-zapper-chipcards/$source$;
  stored_hash text;
  stored_count integer;
  actual_count integer;
  materialized_count integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.kb_import_batches WHERE id = target_batch_id) THEN
    SELECT source_hash, candidate_count
      INTO STRICT stored_hash, stored_count
      FROM public.kb_import_batches
     WHERE id = target_batch_id;

    SELECT
      (SELECT count(*) FROM public.kb_source_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_entity_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_relation_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_dosage_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_safety_candidates WHERE batch_id = target_batch_id)
      INTO actual_count;

    IF stored_hash <> inventory_hash OR stored_count <> actual_count THEN
      RAISE EXCEPTION 'Existing Candida diet/CAN import does not match its immutable source inventory';
    END IF;
  ELSE
    INSERT INTO public.kb_import_batches (
      id, source_kind, source_label, source_hash, parser_name, parser_version,
      batch_status, metadata
    ) VALUES (
      target_batch_id,
      'json',
      'Candida-Diät und CAN-Chip – interne Praxisquelle 2026-08-26',
      inventory_hash,
      'manual-candida-practice-import',
      '1.0.0',
      'created',
      jsonb_build_object(
        'admin_only', true,
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'source_inventory', 'docs/source-inventory/2026-08-26-candida-diet-can-chip-internal.json',
        'source_claim_and_evaluation_separated', true,
        'medical_review_required', true,
        'nutrition_review_required', true,
        'device_identity_review_required', true,
        'external_page_not_refetched', true
      )
    );

    UPDATE public.kb_import_batches
       SET batch_status = 'processing'
     WHERE id = target_batch_id;

    INSERT INTO public.kb_source_candidates (
      id, batch_id, candidate_key, candidate_status, proposed_source_type,
      title, publisher, source_url, rights_status, source_locator,
      original_excerpt, confidence, ambiguity_notes, proposed_data
    ) VALUES
      (
        practice_source_id,
        target_batch_id,
        'source:peter:candida-diet-can-chip-2026-08-26',
        'imported_unreviewed',
        'practice_document',
        'Peters Candida-Diät- und CAN-Chip-Praxisangabe',
        'Naturheilpraxis Peter Rauch',
        'https://diamondshieldzapper.com/diamond-shield-zapper-chipcards/',
        'own_content',
        'Peters OpenCode-Anweisungen vom 26.08.2026; lokale Infothek candida-diaet.html',
        practice_excerpt,
        100,
        'Die externe ChipCard-Seite wurde in diesem Schritt nicht neu abgerufen. Vollständigkeit der dortigen ChipCards und Mittel bleibt offen.',
        jsonb_build_object(
          'visibility', 'admin_only',
          'patient_facing_allowed', false,
          'review_status', 'unreviewed',
          'source_claims_only', true,
          'inventory_hash', inventory_hash
        )
      ),
      (
        safety_source_id,
        target_batch_id,
        'source:internal-safety:candida-diet-can-chip-2026-08-26',
        'imported_unreviewed',
        'practice_document',
        'Getrennte interne Sicherheitsbewertung zu Candida-Diät und CAN-Chip',
        'Interne Admin-Prüfung',
        '',
        'own_content',
        'Getrennte Sicherheitsbewertung 26.08.2026',
        'Diese Bewertung ist keine Aussage aus Peters Praxisquelle. Sie trennt Diagnose, Evidenz, Ernährungssicherheit, Gerätekompatibilität und Patientenfreigabe.',
        100,
        'Fachliche Einzelprüfung und Herstellerabgleich bleiben offen.',
        jsonb_build_object(
          'visibility', 'admin_only',
          'patient_facing_allowed', false,
          'review_status', 'unreviewed',
          'not_a_source_claim', true,
          'safety_clearance', false
        )
      );

    INSERT INTO public.kb_entity_candidates (
      id, batch_id, candidate_key, candidate_status, proposed_entity_type_code,
      proposed_canonical_key, display_name, aliases, description_markdown,
      source_candidate_id, source_locator, original_excerpt, confidence,
      ambiguity_notes, proposed_data
    ) VALUES
      (
        md5('candida-diet-can-chip-2026-08-26:entity:candida')::uuid,
        target_batch_id,
        'entity:candida',
        'imported_unreviewed',
        'pathogen',
        'pathogen.candida',
        'Candida',
        ARRAY['Candida albicans', 'Candida-Belastung']::text[],
        'Candida-Bezug aus Labor, Stuhl, Klinik, Anamnese oder Metatron/NLS. Die jeweilige Befundart muss sichtbar getrennt bleiben.',
        practice_source_id,
        'Peters Praxisangabe 26.08.2026',
        'Wenn eine Candida-Belastung festgestellt wurde, soll sie in den Therapievorschlag integriert werden.',
        95,
        'Metatron/NLS allein ist kein Infektionsnachweis; Spezies und klinische Relevanz können offen sein.',
        jsonb_build_object('visibility', 'admin_only', 'patient_facing_allowed', false, 'review_status', 'unreviewed')
      ),
      (
        md5('candida-diet-can-chip-2026-08-26:entity:diet')::uuid,
        target_batch_id,
        'entity:candida-diet',
        'imported_unreviewed',
        'protocol',
        'protocol.candida-diet.peter-2026-08-26',
        'Candida-Diät – Praxisangabe Peter',
        ARRAY['Candida-Diät', 'Candida-Ernährung']::text[],
        'Vollständige Praxis-Ernährungsangabe mit den Bereichen komplett meiden, nur mäßig, erlaubt, Getränke und versteckte Zucker. Kein gesichertes Eradikationsversprechen.',
        practice_source_id,
        'Peters Originaltext und lokale Infothek candida-diaet.html',
        practice_excerpt,
        100,
        'Dauer, Evidenz und individuelle Ernährungssicherheit sind getrennt zu prüfen.',
        jsonb_build_object(
          'visibility', 'admin_only',
          'patient_facing_allowed', false,
          'review_status', 'unreviewed',
          'infothek_reference', 'candida-diaet.html',
          'source_claim_only', true
        )
      ),
      (
        md5('candida-diet-can-chip-2026-08-26:entity:can-chip')::uuid,
        target_batch_id,
        'entity:can-candida-chip',
        'imported_unreviewed',
        'program',
        'program.zapper.can-candida-chip',
        'CAN (Candida-Chip)',
        ARRAY['CAN ChipCard', 'Candida-Chip', 'Candida ChipCard']::text[],
        'Von Peter genannte Zapper-ChipCard für Candida. Nur bei ausdrücklich vorhandenem kompatiblem Zapper als internen erfahrungsheilkundlichen Kandidaten prüfen.',
        practice_source_id,
        'Peters Praxisangabe und genannte Diamond-Shield-ChipCard-Seite 26.08.2026',
        'Wenn der Patient einen Zapper hat, CAN (Candida-Chip) empfehlen.',
        85,
        'Exakte Programmbezeichnung, Gerätekompatibilität, Anleitung, Herstellerangabe und Sicherheit sind noch zu verifizieren.',
        jsonb_build_object(
          'visibility', 'admin_only',
          'patient_facing_allowed', false,
          'review_status', 'unreviewed',
          'experience_medicine', true,
          'requires_documented_zapper', true,
          'device_identity_status', 'unverified'
        )
      );

    INSERT INTO public.kb_relation_candidates (
      id, batch_id, candidate_key, candidate_status, subject_candidate_id,
      object_candidate_id, proposed_relation_type_code, assignment_strength,
      source_candidate_id, source_locator, original_excerpt, confidence,
      ambiguity_notes, proposed_data
    ) VALUES
      (
        md5('candida-diet-can-chip-2026-08-26:relation:diet-candida')::uuid,
        target_batch_id,
        'relation:candida-diet-indicated-for-candida',
        'imported_unreviewed',
        md5('candida-diet-can-chip-2026-08-26:entity:diet')::uuid,
        md5('candida-diet-can-chip-2026-08-26:entity:candida')::uuid,
        'indicated_for',
        'contextual',
        practice_source_id,
        'Peters Praxisangabe 26.08.2026',
        'Bei dokumentierter Candida-Belastung die Candida-Diät als Unterpunkt bei den Pathogenen ausgeben.',
        95,
        'Erfahrungsheilkundliche Praxiszuordnung; Evidenz und Befundart getrennt prüfen.',
        jsonb_build_object('source_claim_only', true, 'evidence_status', 'unreviewed')
      ),
      (
        md5('candida-diet-can-chip-2026-08-26:relation:can-candida')::uuid,
        target_batch_id,
        'relation:can-chip-targets-candida',
        'imported_unreviewed',
        md5('candida-diet-can-chip-2026-08-26:entity:can-chip')::uuid,
        md5('candida-diet-can-chip-2026-08-26:entity:candida')::uuid,
        'targets_pathogen',
        'possible',
        practice_source_id,
        'Peters Praxisangabe 26.08.2026',
        'CAN (Candida-Chip) wurde Candida zugeordnet, sofern ein kompatibler Zapper vorhanden ist.',
        80,
        'Keine Diagnostik- oder Wirksamkeitsfreigabe; Gerätekompatibilität offen.',
        jsonb_build_object('source_claim_only', true, 'requires_documented_zapper', true, 'evidence_status', 'unreviewed')
      );

    INSERT INTO public.kb_safety_candidates (
      id, batch_id, candidate_key, candidate_status, subject_candidate_id,
      rule_type, severity, action_text, source_candidate_id, source_locator,
      original_excerpt, confidence, ambiguity_notes, proposed_data
    ) VALUES
      (
        md5('candida-diet-can-chip-2026-08-26:safety:diagnosis')::uuid,
        target_batch_id,
        'safety:candida-diagnostic-boundary',
        'imported_unreviewed',
        md5('candida-diet-can-chip-2026-08-26:entity:candida')::uuid,
        'precaution',
        'require_review',
        'Befundart sichtbar trennen. Metatron/NLS bleibt Resonanzhinweis und ist kein Candida- oder Infektionsnachweis; notwendige klinische und laborchemische Abklärung nicht verzögern.',
        safety_source_id,
        'Getrennte interne Sicherheitsbewertung 26.08.2026',
        'Candida kann aus unterschiedlichen Befundarten stammen.',
        100,
        '',
        jsonb_build_object('not_a_source_claim', true, 'safety_clearance', false)
      ),
      (
        md5('candida-diet-can-chip-2026-08-26:safety:diet')::uuid,
        target_batch_id,
        'safety:candida-diet-nutrition-review',
        'imported_unreviewed',
        md5('candida-diet-can-chip-2026-08-26:entity:diet')::uuid,
        'precaution',
        'require_review',
        'Vor einer restriktiven Candida-Diät Dauer, Energie- und Nährstoffversorgung sowie Risiken bei Kindern, Schwangerschaft/Stillzeit, Diabetesmedikation, Essstörungen, Untergewicht und relevanten Erkrankungen individuell prüfen. Kein gesichertes Eradikationsversprechen.',
        safety_source_id,
        'Getrennte interne Sicherheitsbewertung 26.08.2026',
        'Peters Praxisdiät enthält umfangreiche Ausschlüsse.',
        100,
        '',
        jsonb_build_object('not_a_source_claim', true, 'safety_clearance', false)
      ),
      (
        md5('candida-diet-can-chip-2026-08-26:safety:can-chip')::uuid,
        target_batch_id,
        'safety:can-chip-device-review',
        'imported_unreviewed',
        md5('candida-diet-can-chip-2026-08-26:entity:can-chip')::uuid,
        'precaution',
        'require_review',
        'CAN-Chip nur bei dokumentiert vorhandenem kompatiblem Zapper und verifizierter Programmidentität als internen Kandidaten nennen. Anleitung und Kontraindikationen prüfen; Diagnostik oder antimykotische Behandlung nicht ersetzen oder verzögern.',
        safety_source_id,
        'Getrennte interne Sicherheitsbewertung 26.08.2026',
        'Zapper- und ChipCard-Anwendung ist erfahrungsheilkundlich und nicht als gesicherte Candida-Therapie freigegeben.',
        100,
        '',
        jsonb_build_object('not_a_source_claim', true, 'safety_clearance', false, 'requires_documented_zapper', true)
      );

    SELECT
      (SELECT count(*) FROM public.kb_source_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_entity_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_relation_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_dosage_candidates WHERE batch_id = target_batch_id)
      + (SELECT count(*) FROM public.kb_safety_candidates WHERE batch_id = target_batch_id)
      INTO actual_count;

    UPDATE public.kb_import_batches
       SET batch_status = 'ready_for_review',
           candidate_count = actual_count,
           error_count = 0,
           completed_at = now()
     WHERE id = target_batch_id;
  END IF;

  PERFORM public._kb_materialize_import_candidates_as_internal_drafts(target_batch_id, NULL);

  SELECT count(*) INTO materialized_count
    FROM public.kb_import_core_links
   WHERE batch_id = target_batch_id;

  SELECT
    (SELECT count(*) FROM public.kb_source_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_entity_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_relation_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_dosage_candidates WHERE batch_id = target_batch_id)
    + (SELECT count(*) FROM public.kb_safety_candidates WHERE batch_id = target_batch_id)
    INTO actual_count;

  IF materialized_count <> actual_count THEN
    RAISE EXCEPTION 'Candida diet/CAN internal materialization count mismatch: expected %, found %', actual_count, materialized_count;
  END IF;
END seed;
$seed$;

COMMIT;