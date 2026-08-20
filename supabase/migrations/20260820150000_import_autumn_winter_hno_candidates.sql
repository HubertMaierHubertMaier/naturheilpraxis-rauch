BEGIN;

-- Additive internal staging import only. Nothing in this migration is reviewed,
-- released, patient-facing, or usable as an automatic therapy instruction.
DO $seed$
<<seed>>
DECLARE
  target_batch_id uuid := md5('herbst-winter-hno-2026:batch')::uuid;
  inventory_hash text := '2c76c54a5966b4a7cd44d354b34b03356d60647a332a6356f4427a6b0b86ef63';
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
      RAISE EXCEPTION 'Existing autumn/winter HNO import does not match its immutable source inventory';
    END IF;
  ELSE
    INSERT INTO public.kb_import_batches (
      id,
      source_kind,
      source_label,
      source_hash,
      parser_name,
      parser_version,
      batch_status,
      metadata
    ) VALUES (
      target_batch_id,
      'json',
      'Herbst und Winter: HNO-, Virus-, TCM- und Praxisquellen 2026-08-20',
      inventory_hash,
      'manual-structured-source-retention',
      '1.1.0',
      'created',
      jsonb_build_object(
        'admin_only', true,
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'source_inventory', 'docs/source-inventory/2026-08-20-herbst-winter-hno-tcm-internal.json',
        'source_wording', 'normalized_where_original_chat_file_is_unavailable',
        'medical_review_required', true,
        'pharmaceutical_review_required', true,
        'hwg_review_required', true
      )
    );

    UPDATE public.kb_import_batches
       SET batch_status = 'processing'
     WHERE id = target_batch_id;

    INSERT INTO public.kb_source_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      proposed_source_type,
      title,
      publisher,
      source_url,
      rights_status,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    ) VALUES
      (
        md5('herbst-winter-hno-2026:source:peter')::uuid,
        target_batch_id,
        'source:peter:herbst-winter-hno-2026-08-20',
        'imported_unreviewed',
        'practice_document',
        'Praxisangaben von Peter Rauch für Herbst, Winter und akute HNO-Beschwerden',
        'Naturheilpraxis Peter Rauch',
        '',
        'own_content',
        'Aktueller Auftrag vom 20.08.2026; strukturiert in docs/source-inventory/2026-08-20-herbst-winter-hno-tcm-internal.json',
        'Genannt wurden Nasendusche, hohe Vitamin-B2-Gaben ohne erhaltene Mengenangabe, Frequenzanwendungen, Herd-Therapie, ChipCard LY, Derma-Clean Ly, Mannayan Vit C+ und Echinacea. Nach Frequenzanwendung: 50 Minuten geerdet bleiben. Praxisdosierungen: ANTIOXI+ 1 mal täglich 1 Tablette; BETA+ 1 mal täglich 1 Kapsel; Barberry 2 mal täglich 15 bis 30 Tropfen, 30 Minuten vor dem Essen, in einem halben Glas Wasser; Banderol 2 mal täglich 1 bis 30 Tropfen, langsam steigern, in 120 ml Wasser; GLUCAN+ 1 mal täglich 1 Kapsel; Takuna 2 mal täglich 8 Tropfen; Samento 2 mal täglich 8 Tropfen; Houttuynia 2 mal täglich 15 Tropfen; Mannayan Weihrauch 1 mal täglich 1 Kapsel; Mannayan ZINK+ 2 mal täglich 1 Tablette, akut 1 mal 5 Tabletten. Bei tiefsitzender HNO-Symptomatik wurden Derma-Clean Ly, MineralVit Gold, Mineralsalz, DTX-Card, Derma-Clean N und L genannt. Gewünschte Zuordnungen: Rhinitis und Schnupfen, Schleimhaut und Augen, Kokken, Staphylokokken, Streptokokken, Viren, saisonale Coronaviren, SARS-CoV-2/COVID-19, Abszesse, Gelenk- und Knieinfektionen, Nierenentzündung, Lungenentzündung, Innenohr und Stirnhöhle. Für die HNO-ChipCard wurden außerdem die Quellenbegriffe Lymph-Entgiftung und Radikale ausleiten genannt.',
        90,
        'Inhaltlich normalisiert. Der exakte frühere Chatwortlaut ist nicht als lokale Quelldatei erhalten und wird nicht als wörtliches Zitat behauptet.',
        jsonb_build_object(
          'visibility', 'admin_only',
          'patient_facing_allowed', false,
          'source_claims_only', true,
          'dosage_clearance', false,
          'evidence_assessment_separate', true
        )
      ),
      (
        md5('herbst-winter-hno-2026:source:baklayan')::uuid,
        target_batch_id,
        'source:baklayan:akutbehandlung-trikombin',
        'imported_unreviewed',
        'website',
        'Akutbehandlung in unserer Praxis',
        'Heilpraktiker Bioresonanz München',
        'https://heilpraktiker-bioresonanz-muenchen.de/akutbehandlung-in-unserer-praxis/',
        'quoted',
        'Von Peter benannte und zuvor abgerufene Webseite',
        'Die Seite beschreibt typische Zeichen akuter Erkältungs- und HNO-Beschwerden und stellt das TRIKOMBIN im Rahmen eines bioenergetischen Praxisansatzes dar.',
        70,
        'Inhaltszusammenfassung aus dem vorherigen Abruf, kein vollständiges wörtliches Webseitenarchiv. Gerätewirkungen sind Quellenbehauptungen und nicht unabhängig bestätigt.',
        jsonb_build_object(
          'visibility', 'admin_only',
          'patient_facing_allowed', false,
          'claim_class', 'experience_medicine',
          'independent_evidence_review', 'pending'
        )
      ),
      (
        md5('herbst-winter-hno-2026:source:greten-1625')::uuid,
        target_batch_id,
        'source:greten:tcm-page-1625',
        'imported_unreviewed',
        'reference_work',
        'Kursbuch Traditionelle Chinesische Medizin – Erkältungsprophylaxe',
        'Thieme',
        '',
        'quoted',
        'Henry Johannes Greten, Kindle-Ausgabe, Seite 1625',
        'Kurze eigenständige Paraphrase: Im Abschnitt zur Erkältungsprophylaxe werden Ingwertee, Wintercandies, Moxa-Bad und Rosmarin genannt.',
        90,
        'Traditionelles TCM-Modell; keine klinische Wirksamkeitsfreigabe. Längere Originalpassage aus Urheberrechtsgründen nicht wiedergegeben.',
        jsonb_build_object('visibility', 'admin_only', 'patient_facing_allowed', false, 'model', 'traditional_tcm')
      ),
      (
        md5('herbst-winter-hno-2026:source:greten-333')::uuid,
        target_batch_id,
        'source:greten:tcm-page-333',
        'imported_unreviewed',
        'reference_work',
        'Kursbuch Traditionelle Chinesische Medizin – Nase und Pulmonalorbis',
        'Thieme',
        '',
        'quoted',
        'Henry Johannes Greten, Kindle-Ausgabe, Seite 333',
        'Kurze eigenständige Paraphrase: Die Nase wird im TCM-Modell als Körperöffnung des Pulmonalorbis eingeordnet.',
        90,
        'Traditionelles Funktionsmodell, keine moderne anatomische Aussage. Längere Originalpassage nicht wiedergegeben.',
        jsonb_build_object('visibility', 'admin_only', 'patient_facing_allowed', false, 'model', 'traditional_tcm')
      ),
      (
        md5('herbst-winter-hno-2026:source:greten-543-547')::uuid,
        target_batch_id,
        'source:greten:tcm-pages-543-547',
        'imported_unreviewed',
        'reference_work',
        'Kursbuch Traditionelle Chinesische Medizin – Algor-laedens-Theorie',
        'Thieme',
        '',
        'quoted',
        'Henry Johannes Greten, Kindle-Ausgabe, Seiten 543 bis 547',
        'Kurze eigenständige Paraphrase: Die Fundstelle beschreibt die Algor-laedens-Theorie und deren Stadien I bis III als traditionelles TCM-Erklärungsmodell.',
        90,
        'Traditionelles Modell, kein moderner pathophysiologischer Nachweis. Längere Originalpassage nicht wiedergegeben.',
        jsonb_build_object('visibility', 'admin_only', 'patient_facing_allowed', false, 'model', 'traditional_tcm')
      ),
      (
        md5('herbst-winter-hno-2026:source:mannayan')::uuid,
        target_batch_id,
        'source:mannayan:local-inventories-autumn-winter',
        'imported_unreviewed',
        'manufacturer',
        'Lokale Mannayan-Produktinventare für ANTIOXI+, BETA+, GLUCAN+ und ZINK+',
        'Mannayan GmbH & Co. KG',
        '',
        'quoted',
        'docs/source-inventory/2026-08-07-mannayan-{antioxi,beta-lutein,glucan,zink}-read-only.json',
        'ZINK+: 15 mg Zink und 1 mg Kupfer pro Tablette. GLUCAN+: 250 mg Beta-Glucan, 30 mg Vitamin C, 1,5 mg Zink und 30 Mikrogramm Selen pro Kapsel. ANTIOXI+: unter anderem 100 mg Vitamin C, 50 mg Ubiquinol, 40 mg Vitamin E, 15 mg Zink, 4,5 mg Beta-Carotin, 750 Mikrogramm Vitamin A, 4 mg Vitamin B2, 2 mg Mangan und 150 Mikrogramm Selen pro Kapsel. BETA+ mit Lutein: unter anderem Heidelbeerextrakt, Quercetin, Brokkoli, Traubenkernextrakt, Grünteeextrakt, Ingwerextrakt, Curcuminoide, Lycopin, Lutein, Beta-Carotin und Zeaxanthin.',
        95,
        'Herstellerdaten belegen Zusammensetzung, nicht produktbezogene Wirksamkeit. Sicherheits- und Kombinationsprüfung offen.',
        jsonb_build_object('visibility', 'admin_only', 'patient_facing_allowed', false, 'evidence_class', 'manufacturer_composition')
      ),
      (
        md5('herbst-winter-hno-2026:source:nutramedix')::uuid,
        target_batch_id,
        'source:nutramedix:existing-local-wiki',
        'imported_unreviewed',
        'practice_document',
        'NutraMedix – vorhandene interne Produktübersicht nach Kategorien',
        '',
        '',
        'unknown',
        'supabase/migrations/20260324183009_5d17abd7-5c9f-4f2b-a99d-94c3be43195d.sql',
        'Die vorhandene interne Quelle enthält Produkt-, Pathogen- und Dosierungsangaben zu Samento, Banderol, Barberry, Takuna und Houttuynia. Peters aktuelles Praxisschema wird davon getrennt erhalten.',
        85,
        'Bestehende interne Quelle; Evidenz, Sicherheit und genaue Produktidentität bleiben ungeprüft.',
        jsonb_build_object('visibility', 'admin_only', 'patient_facing_allowed', false, 'cross_reference_only', true)
      );

    INSERT INTO public.kb_source_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      proposed_source_type,
      title,
      publisher,
      source_url,
      rights_status,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    ) VALUES
      (
        md5('herbst-winter-hno-2026:source:strunz')::uuid,
        target_batch_id,
        'source:strunz:neue-wege-pages-161-162',
        'imported_unreviewed',
        'reference_work',
        'Neue Wege der Heilung: Gesundheit geschieht von innen',
        '',
        '',
        'quoted',
        'Ulrich Strunz, Seiten 161 bis 162; von Peter im aktuellen Auftrag übermittelte Inhaltsangaben',
        'Unter der Überschrift „Unschlagbar mit C + E + Zn“ wurden Vitamin C 1 bis 3 g, Zink 30 bis 60 mg täglich und Vitamin E 400 IE genannt. Weitere Angaben: weniger als 50 g Kohlenhydrate pro Tag, Protein 1 bis 2 g pro kg Körpergewicht und Omega-3-Fettsäuren 2 bis 6 g pro Tag.',
        90,
        'Normalisierte Inhaltsfassung aus Peters aktuellem Auftrag; vor einer späteren Freigabe am Original abgleichen. Kein behauptetes wörtliches Vollzitat.',
        jsonb_build_object(
          'visibility', 'admin_only',
          'patient_facing_allowed', false,
          'source_claims_only', true,
          'dosage_clearance', false,
          'evidence_assessment_separate', true
        )
      ),
      (
        md5('herbst-winter-hno-2026:source:strunz-safety')::uuid,
        target_batch_id,
        'source:internal-assessment:strunz-pages-161-162',
        'imported_unreviewed',
        'practice_document',
        'Interne Sicherheitsbewertung zum Strunz-Quellenprotokoll',
        'Naturheilpraxis Peter Rauch',
        '',
        'own_content',
        'Getrennte interne Sicherheitsbewertung vom 20.08.2026',
        'Die Quellenangaben werden ohne Patientenfreigabe erhalten. Vor einer Verwendung sind unter anderem Indikation, Dauer, Gesamtzufuhr, Laborwerte, Nieren- und Leberfunktion, Kupferhaushalt, Blutungsrisiko, Arzneimittel, Darreichungsformen und individuelle Ernährungssituation zu prüfen.',
        95,
        'Diese Sicherheitsbewertung ist von den Aussagen der Buchquelle getrennt und stellt noch keine fachliche Freigabe dar.',
        jsonb_build_object(
          'visibility', 'admin_only',
          'patient_facing_allowed', false,
          'assessment_separate_from_source', true,
          'medical_review_required', true,
          'pharmaceutical_review_required', true
        )
      );

    INSERT INTO public.kb_entity_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      proposed_entity_type_code,
      proposed_canonical_key,
      display_name,
      aliases,
      description_markdown,
      source_candidate_id,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    )
    SELECT
      md5('herbst-winter-hno-2026:entity:' || candidate_key)::uuid,
      target_batch_id,
      'entity:' || candidate_key,
      'imported_unreviewed',
      entity_type,
      canonical_key,
      display_name,
      aliases,
      description_markdown,
      md5('herbst-winter-hno-2026:source:' || source_key)::uuid,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      jsonb_build_object(
        'visibility', 'admin_only',
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'source_claim', source_claim,
        'evidence_status', evidence_status
      )
    FROM (VALUES
      ('protocol-herbst-winter', 'protocol', 'hno.protocol.herbst-winter-2026', 'Praxisprotokoll Herbst und Winter', ARRAY['Fit und gesund durch Herbst und Winter']::text[], 'Interner Sammelrahmen für Peters Praxisangaben. Keine automatische Therapie- oder Patientenfreigabe.', 'peter', 'Praxisangaben 20.08.2026', 'Praxisprotokoll für Herbst, Winter und akute HNO-Beschwerden.', 90, 'Sammelprotokoll; individuelle Indikation offen.', true, 'unreviewed'),
      ('hno-symptomkomplex', 'symptom', 'hno.symptomkomplex', 'HNO-Symptomkomplex', ARRAY['obere Atemwegsbeschwerden']::text[], 'Sammelbegriff für Beschwerden von Nase, Nebenhöhlen, Rachen, Ohr und angrenzenden Schleimhäuten.', 'peter', 'Gewünschte Datenbankzuordnung', 'HNO-Symptome einschließlich Rhinitis, Schleimhaut, Augen, Innenohr und Stirnhöhle.', 85, 'Kein standardisierter Einzeldiagnosecode.', true, 'requires_differential_diagnosis'),
      ('rhinitis', 'symptom', 'hno.symptom.rhinitis', 'Rhinitis und Schnupfen', ARRAY['Schnupfen','Rhinitis']::text[], 'Nasale Beschwerden mit unterschiedlichen möglichen infektiösen, allergischen oder irritativen Ursachen.', 'peter', 'Gewünschte Datenbankzuordnung', 'Rhinitis und Schnupfen.', 90, '', false, 'requires_differential_diagnosis'),
      ('schleimhaut-augen', 'symptom', 'hno.symptom.schleimhaut-augen', 'Schleimhaut- und Augenbeteiligung', ARRAY['Augenreizung','Schleimhautreizung']::text[], 'Sammelbegriff für die von Peter gewünschte HNO-Zuordnung.', 'peter', 'Gewünschte Datenbankzuordnung', 'Schleimhaut- und Augenbeteiligung.', 85, 'Exakte Symptome und Ursache im Einzelfall offen.', true, 'requires_differential_diagnosis'),
      ('bakterielle-kokken', 'pathogen', 'pathogen.group.bakterielle-kokken', 'Bakterielle Kokken', ARRAY['Kokken']::text[], 'Morphologische Bakteriengruppe; kein einzelner Erreger.', 'peter', 'Gewünschte Datenbankzuordnung', 'Bakterielle Kokken.', 85, 'Gruppenbegriff, nicht als Erregernachweis verwenden.', true, 'taxonomy_review_required'),
      ('staphylokokken', 'pathogen', 'pathogen.group.staphylokokken', 'Staphylokokken', ARRAY['Staphylococcus']::text[], 'Bakteriengattung mit Besiedlern und möglichen Krankheitserregern.', 'peter', 'Gewünschte Datenbankzuordnung', 'Staphylokokken.', 90, 'Art, Nachweisort und klinische Bedeutung offen.', true, 'taxonomy_review_required'),
      ('streptokokken', 'pathogen', 'pathogen.group.streptokokken', 'Streptokokken', ARRAY['Streptococcus']::text[], 'Bakteriengattung mit unterschiedlichen Arten und Krankheitsbezügen.', 'peter', 'Gewünschte Datenbankzuordnung', 'Streptokokken.', 90, 'Art, Nachweisort und klinische Bedeutung offen.', true, 'taxonomy_review_required'),
      ('respiratorische-viren', 'pathogen', 'pathogen.group.respiratorische-viren', 'Respiratorische Viren', ARRAY['Atemwegsviren','Viren']::text[], 'Sammelbegriff für Viren, die Atemwegsbeschwerden verursachen können.', 'peter', 'Gewünschte Datenbankzuordnung', 'Viren im HNO-Kontext.', 85, 'Gruppenbegriff; Einzelerreger getrennt führen.', true, 'taxonomy_review_required'),
      ('saisonale-coronaviren', 'pathogen', 'pathogen.group.saisonale-coronaviren', 'Saisonale humane Coronaviren', ARRAY['HCoV-229E','HCoV-OC43','HCoV-NL63','HCoV-HKU1']::text[], 'Die vier üblichen saisonalen humanen Coronaviren, getrennt von SARS-CoV-2.', 'peter', 'Gewünschte Datenbankzuordnung', 'Saisonale Coronaviren.', 90, 'Einzelerreger bei späterer Kernstruktur getrennt erfassen.', false, 'medical_review_pending'),
      ('sars-cov-2', 'pathogen', 'pathogen.sars-cov-2', 'SARS-CoV-2', ARRAY['Coronavirus SARS-CoV-2']::text[], 'Erreger von COVID-19; getrennt von saisonalen Coronaviren.', 'peter', 'Gewünschte Datenbankzuordnung', 'SARS-CoV-2.', 95, '', false, 'medical_review_pending'),
      ('covid-19', 'disease', 'disease.covid-19', 'COVID-19', ARRAY['Coronavirus-Krankheit 2019']::text[], 'Akute Erkrankung durch SARS-CoV-2; Post- und Long-COVID separat strukturieren.', 'peter', 'Gewünschte Datenbankzuordnung', 'COVID-19 getrennt von saisonalen Coronaviren.', 95, '', false, 'medical_review_pending'),
      ('abszess', 'disease', 'disease.abszess', 'Abszess', ARRAY['Eiteransammlung']::text[], 'Potentiell dringliche bakterielle Erkrankung; keine Selbstbehandlung.', 'peter', 'Gewünschte Datenbankzuordnung', 'Abszesse.', 90, 'Lokalisation und Ursache offen.', true, 'medical_assessment_required'),
      ('gelenk-knieinfektion', 'disease', 'disease.gelenk-knieinfektion', 'Gelenk- und Knieinfektion', ARRAY['septische Arthritis','Knieinfektion']::text[], 'Potentiell dringliche Gelenkinfektion; sofortige medizinische Abklärung kann erforderlich sein.', 'peter', 'Gewünschte Datenbankzuordnung', 'Gelenk- und Knieinfektionen.', 90, 'Keine Diagnose oder Therapiezuordnung aus ChipCard-Angabe ableiten.', true, 'urgent_medical_assessment'),
      ('nierenentzuendung', 'disease', 'disease.nierenentzuendung', 'Nierenentzündung', ARRAY['Nephritis','Pyelonephritis']::text[], 'Sammelbegriff; verschiedene Krankheitsbilder mit medizinischem Abklärungsbedarf.', 'peter', 'Gewünschte Datenbankzuordnung', 'Nierenentzündung.', 85, 'Exakte Diagnose offen.', true, 'medical_assessment_required'),
      ('lungenentzuendung', 'disease', 'disease.lungenentzuendung', 'Lungenentzündung', ARRAY['Pneumonie']::text[], 'Potentiell schwere Infektion der Lunge; komplementäre Verfahren dürfen Diagnostik und Behandlung nicht verzögern.', 'peter', 'Gewünschte Datenbankzuordnung', 'Lungenentzündung.', 95, '', true, 'urgent_medical_assessment'),
      ('innenohrbeschwerden', 'symptom', 'hno.symptom.innenohr', 'Innenohrbeschwerden', ARRAY['Hörveränderung','Schwindel']::text[], 'Sammelbegriff; plötzlicher Hörverlust oder starker Schwindel sind dringlich.', 'peter', 'Gewünschte Datenbankzuordnung', 'Innenohrbeschwerden.', 85, 'Exakte Symptomatik offen.', true, 'medical_assessment_required'),
      ('stirnhoehlenbeschwerden', 'symptom', 'hno.symptom.stirnhoehle', 'Stirnhöhlenbeschwerden', ARRAY['Stirnhöhlenschmerz','Sinusitis frontalis']::text[], 'Beschwerden im Bereich der Stirnhöhle mit unterschiedlichen möglichen Ursachen.', 'peter', 'Gewünschte Datenbankzuordnung', 'Stirnhöhlenbeschwerden.', 85, 'Diagnose offen.', true, 'medical_assessment_required'),
      ('hno-chipcard', 'program', 'program.hno-chipcard', 'HNO-ChipCard', ARRAY['HNO-Card']::text[], 'Von Peter gewünschte interne Programmzuordnung. Wirkungen und Erregerbezüge bleiben ungeprüfte Praxisangaben.', 'peter', 'Praxisangaben 20.08.2026', 'HNO-ChipCard mit HNO-, Erreger- und Erkrankungszuordnungen.', 80, 'Programmcode und Herstellerbezeichnung offen.', true, 'experience_medicine_unreviewed'),
      ('chipcard-ly', 'program', 'program.chipcard-ly', 'ChipCard LY', ARRAY['LY-Card']::text[], 'Von Peter im Herbst-/Winterprotokoll genanntes Programm.', 'peter', 'Praxisangaben 20.08.2026', 'ChipCard LY.', 80, 'Exakte Produkt- und Programmidentität offen.', true, 'experience_medicine_unreviewed'),
      ('derma-clean-ly', 'program', 'program.derma-clean-ly', 'Derma-Clean Ly', ARRAY[]::text[], 'Von Peter im HNO-Kontext genanntes Programm.', 'peter', 'Praxisangaben 20.08.2026', 'Derma-Clean Ly.', 80, 'Exakte Produkt- und Programmidentität offen.', true, 'experience_medicine_unreviewed'),
      ('derma-clean-n', 'program', 'program.derma-clean-n', 'Derma-Clean N', ARRAY[]::text[], 'Von Peter bei tiefsitzender HNO-Symptomatik genannt.', 'peter', 'Praxisangaben 20.08.2026', 'Derma-Clean N.', 80, 'Exakte Produkt- und Programmidentität offen.', true, 'experience_medicine_unreviewed'),
      ('derma-clean-l', 'program', 'program.derma-clean-l', 'Derma-Clean L', ARRAY[]::text[], 'Von Peter bei tiefsitzender HNO-Symptomatik genannt.', 'peter', 'Praxisangaben 20.08.2026', 'Derma-Clean L.', 80, 'Exakte Produkt- und Programmidentität offen.', true, 'experience_medicine_unreviewed'),
      ('dtx-card', 'program', 'program.dtx-card', 'DTX-Card', ARRAY[]::text[], 'Von Peter bei tiefsitzender HNO-Symptomatik genannt.', 'peter', 'Praxisangaben 20.08.2026', 'DTX-Card.', 80, 'Exakte Produkt- und Programmidentität offen.', true, 'experience_medicine_unreviewed'),
      ('mineralvit-gold', 'product', 'product.mineralvit-gold', 'MineralVit Gold', ARRAY[]::text[], 'Von Peter bei tiefsitzender HNO-Symptomatik genanntes Produkt.', 'peter', 'Praxisangaben 20.08.2026', 'MineralVit Gold.', 75, 'Hersteller, Zusammensetzung und Produktidentität offen.', true, 'product_identity_review_required'),
      ('mineralsalz', 'product', 'product.mineralsalz', 'Mineralsalz', ARRAY[]::text[], 'Von Peter bei tiefsitzender HNO-Symptomatik genanntes Produkt.', 'peter', 'Praxisangaben 20.08.2026', 'Mineralsalz.', 70, 'Nicht eindeutig identifiziert.', true, 'product_identity_review_required'),
      ('mannayan-vit-c', 'product', 'product.mannayan-vitamin-c', 'Mannayan Vit C+', ARRAY['Mannayan Vitamin C+']::text[], 'Im Praxisprotokoll genanntes Mannayan-Produkt.', 'peter', 'Praxisangaben 20.08.2026', 'Mannayan Vit C+.', 85, 'Packungsvariante vor Dosierungsverknüpfung klären.', true, 'product_identity_review_required'),
      ('echinacea', 'plant', 'plant.echinacea', 'Echinacea', ARRAY['Sonnenhut']::text[], 'Im Praxisprotokoll genannte Pflanze beziehungsweise Pflanzenzubereitung.', 'peter', 'Praxisangaben 20.08.2026', 'Echinacea.', 85, 'Art, Präparat und Dosis offen.', true, 'safety_review_pending'),
      ('mannayan-antioxi', 'product', 'product.mannayan-antioxi', 'Mannayan ANTIOXI+', ARRAY[]::text[], 'Mannayan-Kombinationsprodukt; lokale Herstellerzusammensetzung separat erhalten.', 'mannayan', 'Lokales Herstellerinventar und Peters Praxisangabe', 'ANTIOXI+; Peter nannte 1 mal täglich 1 Tablette, Herstellerinventar führt Kapseln.', 95, 'Darreichungsform widersprüchlich und vor Verwendung zu klären.', true, 'dose_and_safety_review_required'),
      ('mannayan-beta', 'product', 'product.mannayan-beta-lutein', 'Mannayan BETA+ mit Lutein', ARRAY['Mannayan BETA+']::text[], 'Mannayan-Kombinationsprodukt mit Pflanzenextrakten und Carotinoiden.', 'mannayan', 'Lokales Herstellerinventar und Peters Praxisangabe', 'BETA+ mit Lutein; 1 Kapsel täglich als Praxis- und Herstellerangabe.', 95, 'Kombinations- und Interaktionsbewertung offen.', true, 'dose_and_safety_review_required'),
      ('mannayan-glucan', 'product', 'product.mannayan-glucan', 'Mannayan GLUCAN+', ARRAY[]::text[], 'Mannayan-Produkt mit Beta-Glucan, Vitamin C, Zink und Selen.', 'mannayan', 'Lokales Herstellerinventar und Peters Praxisangabe', 'GLUCAN+; Peter nannte 1 Kapsel täglich, Hersteller 1 bis 3 Kapseln.', 95, 'Praxis- und Herstellerangabe getrennt bewahren.', true, 'dose_and_safety_review_required'),
      ('mannayan-weihrauch', 'product', 'product.mannayan-weihrauch', 'Mannayan Weihrauch', ARRAY['Weihrauch']::text[], 'Von Peter genanntes Mannayan-Produkt.', 'peter', 'Praxisangaben 20.08.2026', 'Mannayan Weihrauch 1 mal täglich 1 Kapsel.', 85, 'Exakte Produktvariante und Zusammensetzung offen.', true, 'dose_and_safety_review_required'),
      ('mannayan-zink', 'product', 'product.mannayan-zink', 'Mannayan ZINK+', ARRAY[]::text[], 'Mannayan-Produkt mit 15 mg Zink und 1 mg Kupfer pro Tablette laut lokalem Herstellerinventar.', 'mannayan', 'Lokales Herstellerinventar und Peters Praxisangabe', 'ZINK+; Peter nannte 2 mal täglich 1 Tablette und akut 1 mal 5 Tabletten.', 98, 'Akutschema entspricht rechnerisch 75 mg Zink und bleibt gesperrt.', true, 'dose_and_safety_review_required'),
      ('barberry', 'product', 'product.nutramedix.barberry', 'Barberry', ARRAY['Mahonia aquifolium']::text[], 'Pflanzliche Tinktur aus der bestehenden internen NutraMedix-Quelle.', 'nutramedix', 'Bestehende lokale Quelle und Peters Praxisangabe', 'Barberry 2 mal täglich 15 bis 30 Tropfen.', 85, 'Exakte Produktidentität und Sicherheit offen.', true, 'dose_and_safety_review_required'),
      ('banderol', 'product', 'product.nutramedix.banderol', 'Banderol', ARRAY['Otoba parvifolia']::text[], 'Pflanzliche Tinktur aus der bestehenden internen NutraMedix-Quelle.', 'nutramedix', 'Bestehende lokale Quelle und Peters Praxisangabe', 'Banderol 2 mal täglich 1 bis 30 Tropfen, langsam steigern.', 85, 'Exakte Produktidentität und Sicherheit offen.', true, 'dose_and_safety_review_required'),
      ('takuna', 'product', 'product.nutramedix.takuna', 'Takuna', ARRAY[]::text[], 'Pflanzliche Tinktur aus der bestehenden internen NutraMedix-Quelle.', 'nutramedix', 'Bestehende lokale Quelle und Peters Praxisangabe', 'Takuna 2 mal täglich 8 Tropfen.', 85, 'Exakte botanische und Produktidentität prüfen.', true, 'dose_and_safety_review_required'),
      ('samento', 'product', 'product.nutramedix.samento', 'Samento', ARRAY['Uncaria tomentosa']::text[], 'Pflanzliche Tinktur aus der bestehenden internen NutraMedix-Quelle.', 'nutramedix', 'Bestehende lokale Quelle und Peters Praxisangabe', 'Samento 2 mal täglich 8 Tropfen.', 85, 'Exakte Produktidentität und Sicherheit offen.', true, 'dose_and_safety_review_required'),
      ('houttuynia', 'product', 'product.nutramedix.houttuynia', 'Houttuynia', ARRAY['Houttuynia cordata']::text[], 'Pflanzliche Tinktur aus der bestehenden internen NutraMedix-Quelle.', 'nutramedix', 'Bestehende lokale Quelle und Peters Praxisangabe', 'Houttuynia 2 mal täglich 15 Tropfen.', 85, 'Exakte Produktidentität und Sicherheit offen.', true, 'dose_and_safety_review_required'),
      ('nasendusche', 'therapy_method', 'therapy.nasendusche', 'Nasendusche', ARRAY['Nasenspülung']::text[], 'Lokale Spülung der Nase; Wasser- und Gerätehygiene beachten.', 'peter', 'Praxisangaben 20.08.2026', 'Nasendusche als lokale Maßnahme.', 90, 'Konkrete Salzlösung und Anwendung offen.', true, 'safety_review_pending'),
      ('vitamin-b2', 'nutrient', 'nutrient.vitamin-b2', 'Vitamin B2', ARRAY['Riboflavin']::text[], 'Nährstoff; Peter nannte hohe Gaben ohne erhaltene Dosis.', 'peter', 'Praxisangaben 20.08.2026', 'Hohe Vitamin-B2-Gaben.', 80, 'Dosis, Dauer und Indikation nicht erhalten.', true, 'dose_and_safety_review_required'),
      ('frequenzanwendung', 'therapy_method', 'therapy.frequenzanwendung', 'Frequenzanwendung', ARRAY['Frequenztherapie']::text[], 'Erfahrungsheilkundliches Praxisverfahren ohne evidenzbasierte Wirkungsfreigabe.', 'peter', 'Praxisangaben 20.08.2026', 'Frequenzanwendungen; danach 50 Minuten geerdet bleiben.', 80, 'Gerät und Programm offen.', true, 'experience_medicine_unreviewed'),
      ('herd-therapie', 'therapy_method', 'therapy.herd-therapie', 'Herd-Therapie', ARRAY[]::text[], 'Von Peter genanntes erfahrungsheilkundliches Verfahren.', 'peter', 'Praxisangaben 20.08.2026', 'Herd-Therapie.', 70, 'Begriff und konkretes Verfahren nicht eindeutig bestimmt.', true, 'experience_medicine_unreviewed'),
      ('trikombin', 'device', 'device.trikombin', 'TRIKOMBIN', ARRAY['Trikombingerät']::text[], 'Auf der Baklayan-Seite beschriebenes bioenergetisches Gerät; Wirkungsangaben sind Quellenbehauptungen.', 'baklayan', 'Baklayan-Webseite', 'TRIKOMBIN im Rahmen eines bioenergetischen Praxisansatzes.', 75, 'Hersteller, Modell und konkrete Aussage abschnittsgenau nachprüfen.', true, 'experience_medicine_unreviewed'),
      ('ingwertee', 'product', 'product.ingwertee', 'Ingwertee', ARRAY[]::text[], 'Im TCM-Lehrbuch im Kontext der Erkältungsprophylaxe genannt.', 'greten-1625', 'Greten, Seite 1625', 'Ingwertee.', 90, 'Traditioneller Quellenkontext; Verträglichkeit prüfen.', true, 'traditional_source_unreviewed'),
      ('wintercandies', 'product', 'product.wintercandies', 'Wintercandies', ARRAY['Winter-Candies']::text[], 'Im TCM-Lehrbuch im Kontext der Erkältungsprophylaxe genannter Begriff.', 'greten-1625', 'Greten, Seite 1625', 'Wintercandies.', 80, 'Zusammensetzung im gesicherten Fortsetzungsstand nicht erhalten.', true, 'traditional_source_unreviewed'),
      ('moxa-bad', 'therapy_method', 'therapy.moxa-bad', 'Moxa-Bad', ARRAY['Moxabad']::text[], 'Im TCM-Lehrbuch im Kontext der Erkältungsprophylaxe genanntes Wärmeverfahren.', 'greten-1625', 'Greten, Seite 1625', 'Moxa-Bad.', 85, 'Konkrete Anwendung und Gegenanzeigen offen.', true, 'traditional_source_unreviewed'),
      ('rosmarin', 'plant', 'plant.rosmarin', 'Rosmarin', ARRAY['Salvia rosmarinus']::text[], 'Im TCM-Lehrbuch im Kontext der Erkältungsprophylaxe genannt.', 'greten-1625', 'Greten, Seite 1625', 'Rosmarin.', 90, 'Zubereitung und Dosis offen.', true, 'traditional_source_unreviewed'),
      ('tcm-pulmonalorbis', 'protocol', 'tcm.model.pulmonalorbis', 'TCM-Modell Pulmonalorbis und Nase', ARRAY['Pulmonalorbis']::text[], 'Traditionelles funktionelles TCM-Modell, keine moderne anatomische Aussage.', 'greten-333', 'Greten, Seite 333', 'Nase als Körperöffnung des Pulmonalorbis.', 90, '', true, 'traditional_model'),
      ('tcm-algor-laedens', 'protocol', 'tcm.model.algor-laedens', 'TCM-Modell Algor laedens', ARRAY['Algor-laedens-Theorie','Stadien I bis III']::text[], 'Traditionelles TCM-Erklärungsmodell mit Stadien I bis III.', 'greten-543-547', 'Greten, Seiten 543 bis 547', 'Algor-laedens-Theorie und Stadien I bis III.', 90, '', true, 'traditional_model'),
      ('strunz-winter-protocol', 'protocol', 'nutrition.protocol.strunz-pages-161-162', 'Strunz-Quellenprotokoll Seiten 161 bis 162', ARRAY['Unschlagbar mit C + E + Zn']::text[], 'Interne, ungeprüfte Erfassung der von Peter übermittelten Buchaussagen. Keine Patienten- oder Dosierungsfreigabe.', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Vitamin C, Zink, Vitamin E, Kohlenhydratreduktion, Protein und Omega-3-Fettsäuren wurden gemeinsam genannt.', 90, 'Originalabgleich vor späterer Freigabe offen.', true, 'source_claim_unreviewed'),
      ('strunz-vitamin-c', 'nutrient', 'nutrient.vitamin-c', 'Vitamin C', ARRAY['Ascorbinsäure']::text[], 'Nährstoff im Strunz-Quellenprotokoll; Dosis und Sicherheit bleiben ungeprüft.', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Vitamin C 1 bis 3 g.', 90, 'Dauer und Darreichungsform nicht übermittelt.', true, 'dose_and_safety_review_required'),
      ('strunz-zink', 'nutrient', 'nutrient.zinc', 'Zink', ARRAY['Zn']::text[], 'Spurenelement im Strunz-Quellenprotokoll; getrennt von konkreten Mannayan-Produkten.', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Zink 30 bis 60 mg täglich.', 90, 'Dauer, Verbindung und Gesamtzufuhr nicht übermittelt.', true, 'dose_and_safety_review_required'),
      ('strunz-vitamin-e', 'nutrient', 'nutrient.vitamin-e', 'Vitamin E', ARRAY['Tocopherol']::text[], 'Nährstoff im Strunz-Quellenprotokoll; Form und Umrechnung der IE sind offen.', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Vitamin E 400 IE.', 90, 'Vitamin-E-Form, Dauer und Umrechnung nicht übermittelt.', true, 'dose_and_safety_review_required'),
      ('strunz-low-carb', 'protocol', 'nutrition.protocol.carbohydrates-under-50g', 'Kohlenhydratreduktion unter 50 g pro Tag', ARRAY['Low Carb unter 50 g']::text[], 'Ernährungsangabe aus dem Strunz-Quellenprotokoll; keine allgemeine Ernährungsempfehlung.', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Weniger als 50 g Kohlenhydrate pro Tag.', 90, 'Die Obergrenze ist als strikte Kleiner-als-Angabe übermittelt.', true, 'nutrition_review_required'),
      ('strunz-protein', 'nutrient', 'nutrient.protein', 'Protein', ARRAY['Eiweiß']::text[], 'Makronährstoffangabe im Strunz-Quellenprotokoll.', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Protein 1 bis 2 g pro kg Körpergewicht.', 90, 'Individuelle Bedarfseinordnung und Dauer offen.', true, 'dose_and_safety_review_required'),
      ('strunz-omega-3', 'nutrient', 'nutrient.omega-3-fatty-acids', 'Omega-3-Fettsäuren', ARRAY['Omega 3','EPA und DHA']::text[], 'Fettsäurenangabe im Strunz-Quellenprotokoll; Produktzusammensetzung nicht übermittelt.', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Omega-3-Fettsäuren 2 bis 6 g pro Tag.', 90, 'EPA-/DHA-Anteil, Produkt, Dauer und Gesamtzufuhr offen.', true, 'dose_and_safety_review_required')
    ) AS entity(
      candidate_key,
      entity_type,
      canonical_key,
      display_name,
      aliases,
      description_markdown,
      source_key,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      source_claim,
      evidence_status
    );

    INSERT INTO public.kb_relation_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      subject_candidate_id,
      object_candidate_id,
      proposed_relation_type_code,
      assignment_strength,
      source_candidate_id,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    )
    SELECT
      md5('herbst-winter-hno-2026:relation:' || relation_key)::uuid,
      target_batch_id,
      'relation:' || relation_key,
      'imported_unreviewed',
      md5('herbst-winter-hno-2026:entity:' || subject_key)::uuid,
      md5('herbst-winter-hno-2026:entity:' || object_key)::uuid,
      relation_type,
      strength,
      md5('herbst-winter-hno-2026:source:' || source_key)::uuid,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      jsonb_build_object(
        'visibility', 'admin_only',
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'source_claim_only', source_claim_only,
        'evidence_status', evidence_status
      )
    FROM (VALUES
      ('nasendusche-protokoll', 'nasendusche', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Nasendusche wurde im Praxisprotokoll genannt.', 90, '', true, 'unreviewed'),
      ('vitamin-b2-protokoll', 'vitamin-b2', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Hohe Vitamin-B2-Gaben wurden genannt.', 80, 'Dosis fehlt.', true, 'dose_review_required'),
      ('frequenz-protokoll', 'frequenzanwendung', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Frequenzanwendungen wurden genannt.', 80, '', true, 'experience_medicine_unreviewed'),
      ('herd-protokoll', 'herd-therapie', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Herd-Therapie wurde genannt.', 70, 'Konkretes Verfahren offen.', true, 'experience_medicine_unreviewed'),
      ('chip-ly-protokoll', 'chipcard-ly', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'ChipCard LY wurde genannt.', 80, '', true, 'experience_medicine_unreviewed'),
      ('derma-ly-protokoll', 'derma-clean-ly', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Derma-Clean Ly wurde genannt.', 80, '', true, 'experience_medicine_unreviewed'),
      ('vit-c-protokoll', 'mannayan-vit-c', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Mannayan Vit C+ wurde genannt.', 85, '', true, 'unreviewed'),
      ('echinacea-protokoll', 'echinacea', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Echinacea wurde genannt.', 85, '', true, 'unreviewed'),
      ('antioxi-protokoll', 'mannayan-antioxi', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'ANTIOXI+ wurde mit Praxisdosis genannt.', 90, '', true, 'dose_review_required'),
      ('beta-protokoll', 'mannayan-beta', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'BETA+ wurde mit Praxisdosis genannt.', 90, '', true, 'dose_review_required'),
      ('glucan-protokoll', 'mannayan-glucan', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'GLUCAN+ wurde mit Praxisdosis genannt.', 90, '', true, 'dose_review_required'),
      ('barberry-protokoll', 'barberry', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Barberry wurde mit Praxisdosis genannt.', 90, '', true, 'dose_review_required'),
      ('banderol-protokoll', 'banderol', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Banderol wurde mit Praxisdosis genannt.', 90, '', true, 'dose_review_required'),
      ('takuna-protokoll', 'takuna', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Takuna wurde mit Praxisdosis genannt.', 90, '', true, 'dose_review_required'),
      ('samento-protokoll', 'samento', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Samento wurde mit Praxisdosis genannt.', 90, '', true, 'dose_review_required'),
      ('houttuynia-protokoll', 'houttuynia', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Houttuynia wurde mit Praxisdosis genannt.', 90, '', true, 'dose_review_required'),
      ('weihrauch-protokoll', 'mannayan-weihrauch', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Mannayan Weihrauch wurde mit Praxisdosis genannt.', 90, '', true, 'dose_review_required'),
      ('zink-protokoll', 'mannayan-zink', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Mannayan ZINK+ wurde regulär und akut dosiert genannt.', 95, 'Akutschema gesperrt.', true, 'dose_review_required'),
      ('mineralvit-protokoll', 'mineralvit-gold', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'MineralVit Gold wurde bei tiefsitzender HNO-Symptomatik genannt.', 75, '', true, 'unreviewed'),
      ('mineralsalz-protokoll', 'mineralsalz', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Mineralsalz wurde bei tiefsitzender HNO-Symptomatik genannt.', 70, 'Produkt nicht eindeutig.', true, 'unreviewed'),
      ('dtx-protokoll', 'dtx-card', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'DTX-Card wurde bei tiefsitzender HNO-Symptomatik genannt.', 80, '', true, 'experience_medicine_unreviewed'),
      ('derma-n-protokoll', 'derma-clean-n', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Derma-Clean N wurde bei tiefsitzender HNO-Symptomatik genannt.', 80, '', true, 'experience_medicine_unreviewed'),
      ('derma-l-protokoll', 'derma-clean-l', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'peter', 'Praxisangaben 20.08.2026', 'Derma-Clean L wurde bei tiefsitzender HNO-Symptomatik genannt.', 80, '', true, 'experience_medicine_unreviewed'),
      ('trikombin-protokoll', 'trikombin', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'baklayan', 'Baklayan-Webseite', 'TRIKOMBIN wurde im Akutbehandlungskontext beschrieben.', 70, '', true, 'experience_medicine_unreviewed'),
      ('ingwertee-protokoll', 'ingwertee', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'greten-1625', 'Greten, Seite 1625', 'Ingwertee im Kontext der Erkältungsprophylaxe.', 90, '', true, 'traditional_source_unreviewed'),
      ('wintercandies-protokoll', 'wintercandies', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'greten-1625', 'Greten, Seite 1625', 'Wintercandies im Kontext der Erkältungsprophylaxe.', 80, 'Zusammensetzung offen.', true, 'traditional_source_unreviewed'),
      ('moxa-protokoll', 'moxa-bad', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'greten-1625', 'Greten, Seite 1625', 'Moxa-Bad im Kontext der Erkältungsprophylaxe.', 85, '', true, 'traditional_source_unreviewed'),
      ('rosmarin-protokoll', 'rosmarin', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'greten-1625', 'Greten, Seite 1625', 'Rosmarin im Kontext der Erkältungsprophylaxe.', 90, '', true, 'traditional_source_unreviewed'),
      ('pulmonalorbis-protokoll', 'tcm-pulmonalorbis', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'greten-333', 'Greten, Seite 333', 'Nase und Pulmonalorbis als traditionelles Modell.', 90, '', true, 'traditional_model'),
      ('algor-protokoll', 'tcm-algor-laedens', 'protocol-herbst-winter', 'part_of_protocol', 'contextual', 'greten-543-547', 'Greten, Seiten 543 bis 547', 'Algor-laedens-Theorie mit Stadien I bis III.', 90, '', true, 'traditional_model'),
      ('hno-card-hno', 'hno-chipcard', 'hno-symptomkomplex', 'indicated_for', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde HNO-Symptomen zugeordnet.', 70, 'Keine Wirksamkeitsfreigabe.', true, 'experience_medicine_unreviewed'),
      ('hno-card-rhinitis', 'hno-chipcard', 'rhinitis', 'indicated_for', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde Rhinitis und Schnupfen zugeordnet.', 70, 'Keine Wirksamkeitsfreigabe.', true, 'experience_medicine_unreviewed'),
      ('hno-card-kokken', 'hno-chipcard', 'bakterielle-kokken', 'targets_pathogen', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde bakteriellen Kokken zugeordnet.', 60, 'Keine Diagnostik- oder Wirksamkeitsfreigabe.', true, 'experience_medicine_unreviewed'),
      ('hno-card-staphylokokken', 'hno-chipcard', 'staphylokokken', 'targets_pathogen', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde Staphylokokken zugeordnet.', 60, 'Keine Diagnostik- oder Wirksamkeitsfreigabe.', true, 'experience_medicine_unreviewed'),
      ('hno-card-streptokokken', 'hno-chipcard', 'streptokokken', 'targets_pathogen', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde Streptokokken zugeordnet.', 60, 'Keine Diagnostik- oder Wirksamkeitsfreigabe.', true, 'experience_medicine_unreviewed'),
      ('hno-card-viren', 'hno-chipcard', 'respiratorische-viren', 'targets_pathogen', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde Viren zugeordnet.', 60, 'Keine Diagnostik- oder Wirksamkeitsfreigabe.', true, 'experience_medicine_unreviewed'),
      ('hno-card-saisonale-corona', 'hno-chipcard', 'saisonale-coronaviren', 'targets_pathogen', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde saisonalen Coronaviren zugeordnet.', 60, 'Keine Diagnostik- oder Wirksamkeitsfreigabe.', true, 'experience_medicine_unreviewed'),
      ('hno-card-sars-cov-2', 'hno-chipcard', 'sars-cov-2', 'targets_pathogen', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde SARS-CoV-2 zugeordnet.', 55, 'Keine Diagnostik- oder Wirksamkeitsfreigabe; medizinische Versorgung darf nicht verzögert werden.', true, 'experience_medicine_unreviewed'),
      ('hno-card-abszess', 'hno-chipcard', 'abszess', 'indicated_for', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde Abszessen zugeordnet.', 55, 'Dringliche medizinische Diagnostik hat Vorrang.', true, 'experience_medicine_unreviewed'),
      ('hno-card-gelenk', 'hno-chipcard', 'gelenk-knieinfektion', 'indicated_for', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde Gelenk- und Knieinfektionen zugeordnet.', 55, 'Dringliche medizinische Diagnostik hat Vorrang.', true, 'experience_medicine_unreviewed'),
      ('hno-card-niere', 'hno-chipcard', 'nierenentzuendung', 'indicated_for', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde Nierenentzündung zugeordnet.', 55, 'Medizinische Diagnostik hat Vorrang.', true, 'experience_medicine_unreviewed'),
      ('hno-card-lunge', 'hno-chipcard', 'lungenentzuendung', 'indicated_for', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde Lungenentzündung zugeordnet.', 50, 'Dringliche medizinische Diagnostik und Behandlung dürfen nicht verzögert werden.', true, 'experience_medicine_unreviewed'),
      ('hno-card-innenohr', 'hno-chipcard', 'innenohrbeschwerden', 'indicated_for', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde Innenohrbeschwerden zugeordnet.', 55, 'Plötzlicher Hörverlust oder starker Schwindel sind dringlich.', true, 'experience_medicine_unreviewed'),
      ('hno-card-stirnhoehle', 'hno-chipcard', 'stirnhoehlenbeschwerden', 'indicated_for', 'possible', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde Stirnhöhlenbeschwerden zugeordnet.', 60, 'Medizinische Differenzialdiagnose offen.', true, 'experience_medicine_unreviewed'),
      ('resp-viren-hno', 'respiratorische-viren', 'hno-symptomkomplex', 'manifests_as', 'possible', 'peter', 'Gewünschte Erreger-Symptom-Struktur', 'Respiratorische Viren können HNO-Beschwerden verursachen.', 80, 'Sammelbegriff.', false, 'medical_review_pending'),
      ('saisonale-corona-rhinitis', 'saisonale-coronaviren', 'rhinitis', 'manifests_as', 'possible', 'peter', 'Gewünschte Erreger-Symptom-Struktur', 'Saisonale Coronaviren können Erkältungs- und Rhinitissymptome verursachen.', 80, '', false, 'medical_review_pending'),
      ('sars-cov-2-hno', 'sars-cov-2', 'hno-symptomkomplex', 'manifests_as', 'possible', 'peter', 'Gewünschte Erreger-Symptom-Struktur', 'SARS-CoV-2 kann Beschwerden der oberen Atemwege verursachen.', 80, 'Kein diagnostischer Schluss aus Symptomen allein.', false, 'medical_review_pending'),
      ('strunz-vitamin-c-protocol', 'strunz-vitamin-c', 'strunz-winter-protocol', 'part_of_protocol', 'contextual', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Vitamin C wurde im Quellenprotokoll genannt.', 90, '', true, 'dose_review_required'),
      ('strunz-zink-protocol', 'strunz-zink', 'strunz-winter-protocol', 'part_of_protocol', 'contextual', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Zink wurde im Quellenprotokoll genannt.', 90, '', true, 'dose_review_required'),
      ('strunz-vitamin-e-protocol', 'strunz-vitamin-e', 'strunz-winter-protocol', 'part_of_protocol', 'contextual', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Vitamin E wurde im Quellenprotokoll genannt.', 90, '', true, 'dose_review_required'),
      ('strunz-low-carb-protocol', 'strunz-low-carb', 'strunz-winter-protocol', 'part_of_protocol', 'contextual', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Weniger als 50 g Kohlenhydrate pro Tag wurden im Quellenprotokoll genannt.', 90, 'Strikte Kleiner-als-Obergrenze.', true, 'nutrition_review_required'),
      ('strunz-protein-protocol', 'strunz-protein', 'strunz-winter-protocol', 'part_of_protocol', 'contextual', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Protein 1 bis 2 g pro kg Körpergewicht wurde im Quellenprotokoll genannt.', 90, '', true, 'dose_review_required'),
      ('strunz-omega-3-protocol', 'strunz-omega-3', 'strunz-winter-protocol', 'part_of_protocol', 'contextual', 'strunz', 'Ulrich Strunz, Seiten 161 bis 162', 'Omega-3-Fettsäuren 2 bis 6 g pro Tag wurden im Quellenprotokoll genannt.', 90, '', true, 'dose_review_required')
    ) AS relation(
      relation_key,
      subject_key,
      object_key,
      relation_type,
      strength,
      source_key,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      source_claim_only,
      evidence_status
    );

    INSERT INTO public.kb_dosage_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      subject_candidate_id,
      indication_candidate_id,
      application_route,
      minimum_dose,
      maximum_dose,
      dose_unit,
      reference_period,
      frequency_text,
      duration_text,
      timing_text,
      application_text,
      source_candidate_id,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    )
    SELECT
      md5('herbst-winter-hno-2026:dosage:' || dosage_key)::uuid,
      target_batch_id,
      'dosage:' || dosage_key,
      'imported_unreviewed',
      md5('herbst-winter-hno-2026:entity:' || subject_key)::uuid,
      md5('herbst-winter-hno-2026:entity:hno-symptomkomplex')::uuid,
      'oral',
      minimum_dose,
      maximum_dose,
      dose_unit,
      'day',
      frequency_text,
      '',
      timing_text,
      application_text,
      md5('herbst-winter-hno-2026:source:peter')::uuid,
      'Peters Praxisangaben 20.08.2026',
      original_excerpt,
      confidence,
      ambiguity_notes,
      jsonb_build_object(
        'visibility', 'admin_only',
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'dosage_clearance', false,
        'practice_source', true,
        'acute', acute
      )
    FROM (VALUES
      ('antioxi-daily', 'mannayan-antioxi', 1::numeric, 1::numeric, 'Tablette', '1 mal täglich', '', '', 'Mannayan ANTIOXI+: 1 mal täglich 1 Tablette.', 90, 'Herstellerinventar führt Kapseln; Darreichungsform klären.', false),
      ('beta-daily', 'mannayan-beta', 1::numeric, 1::numeric, 'Kapsel', '1 mal täglich', '', '', 'Mannayan BETA+: 1 mal täglich 1 Kapsel.', 95, '', false),
      ('barberry-daily', 'barberry', 15::numeric, 30::numeric, 'Tropfen', '2 mal täglich', '30 Minuten vor dem Essen', 'in einem halben Glas Wasser', 'Barberry: 2 mal täglich 15 bis 30 Tropfen, 30 Minuten vor dem Essen, in einem halben Glas Wasser.', 90, '', false),
      ('banderol-daily', 'banderol', 1::numeric, 30::numeric, 'Tropfen', '2 mal täglich', '', 'langsam steigern; in 120 ml Wasser', 'Banderol: 2 mal täglich 1 bis 30 Tropfen, langsam steigern, in 120 ml Wasser.', 90, '', false),
      ('glucan-daily', 'mannayan-glucan', 1::numeric, 1::numeric, 'Kapsel', '1 mal täglich', '', '', 'Mannayan GLUCAN+: 1 mal täglich 1 Kapsel.', 90, 'Herstellerinventar nennt 1 bis 3 Kapseln; Quellen getrennt halten.', false),
      ('takuna-daily', 'takuna', 8::numeric, 8::numeric, 'Tropfen', '2 mal täglich', '', '', 'Takuna: 2 mal täglich 8 Tropfen.', 90, '', false),
      ('samento-daily', 'samento', 8::numeric, 8::numeric, 'Tropfen', '2 mal täglich', '', '', 'Samento: 2 mal täglich 8 Tropfen.', 90, '', false),
      ('houttuynia-daily', 'houttuynia', 15::numeric, 15::numeric, 'Tropfen', '2 mal täglich', '', '', 'Houttuynia: 2 mal täglich 15 Tropfen.', 90, '', false),
      ('weihrauch-daily', 'mannayan-weihrauch', 1::numeric, 1::numeric, 'Kapsel', '1 mal täglich', '', '', 'Mannayan Weihrauch: 1 mal täglich 1 Kapsel.', 90, 'Exakte Produktvariante offen.', false),
      ('zink-regular', 'mannayan-zink', 1::numeric, 1::numeric, 'Tablette', '2 mal täglich', '', '', 'Mannayan ZINK+: 2 mal täglich 1 Tablette.', 95, 'Gesamtzufuhr und Dauer prüfen.', false),
      ('zink-acute', 'mannayan-zink', 5::numeric, 5::numeric, 'Tablette', '1 mal akut', '', '', 'Mannayan ZINK+: akut 1 mal 5 Tabletten.', 95, 'Entspricht rechnerisch 75 mg Zink; keine Freigabe.', true)
    ) AS dosage(
      dosage_key,
      subject_key,
      minimum_dose,
      maximum_dose,
      dose_unit,
      frequency_text,
      timing_text,
      application_text,
      original_excerpt,
      confidence,
      ambiguity_notes,
      acute
    );

    INSERT INTO public.kb_dosage_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      subject_candidate_id,
      indication_candidate_id,
      application_route,
      minimum_dose,
      maximum_dose,
      dose_unit,
      reference_period,
      frequency_text,
      duration_text,
      timing_text,
      application_text,
      source_candidate_id,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    )
    SELECT
      md5('herbst-winter-hno-2026:dosage:' || dosage_key)::uuid,
      target_batch_id,
      'dosage:' || dosage_key,
      'imported_unreviewed',
      md5('herbst-winter-hno-2026:entity:' || subject_key)::uuid,
      md5('herbst-winter-hno-2026:entity:strunz-winter-protocol')::uuid,
      'oral',
      minimum_dose,
      maximum_dose,
      dose_unit,
      'day',
      frequency_text,
      '',
      '',
      application_text,
      md5('herbst-winter-hno-2026:source:strunz')::uuid,
      'Ulrich Strunz, Seiten 161 bis 162',
      original_excerpt,
      90,
      'Normalisierte Quellenangabe; Originalabgleich, Dauer, Darreichungsform und individuelle Eignung vor Freigabe prüfen.',
      jsonb_build_object(
        'visibility', 'admin_only',
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'dosage_clearance', false,
        'source_claim_only', true,
        'upper_bound_exclusive', upper_bound_exclusive
      )
    FROM (VALUES
      ('strunz-vitamin-c', 'strunz-vitamin-c', 1::numeric, 3::numeric, 'g', '', '', 'Vitamin C 1 bis 3 g.', false),
      ('strunz-zink', 'strunz-zink', 30::numeric, 60::numeric, 'mg', 'täglich', '', 'Zink 30 bis 60 mg täglich.', false),
      ('strunz-vitamin-e', 'strunz-vitamin-e', 400::numeric, 400::numeric, 'IE', '', '', 'Vitamin E 400 IE.', false),
      ('strunz-low-carb', 'strunz-low-carb', NULL::numeric, 50::numeric, 'g', 'pro Tag', 'Kohlenhydrate gesamt', 'Weniger als 50 g Kohlenhydrate pro Tag.', true),
      ('strunz-protein', 'strunz-protein', 1::numeric, 2::numeric, 'g/kg Körpergewicht', '', '', 'Protein 1 bis 2 g pro kg Körpergewicht.', false),
      ('strunz-omega-3', 'strunz-omega-3', 2::numeric, 6::numeric, 'g', 'pro Tag', '', 'Omega-3-Fettsäuren 2 bis 6 g pro Tag.', false)
    ) AS dosage(
      dosage_key,
      subject_key,
      minimum_dose,
      maximum_dose,
      dose_unit,
      frequency_text,
      application_text,
      original_excerpt,
      upper_bound_exclusive
    );

    INSERT INTO public.kb_safety_candidates (
      id,
      batch_id,
      candidate_key,
      candidate_status,
      subject_candidate_id,
      rule_type,
      severity,
      action_text,
      source_candidate_id,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      proposed_data
    )
    SELECT
      md5('herbst-winter-hno-2026:safety:' || safety_key)::uuid,
      target_batch_id,
      'safety:' || safety_key,
      'imported_unreviewed',
      md5('herbst-winter-hno-2026:entity:' || subject_key)::uuid,
      rule_type,
      severity,
      action_text,
      md5('herbst-winter-hno-2026:source:' || source_key)::uuid,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes,
      jsonb_build_object(
        'visibility', 'admin_only',
        'patient_facing_allowed', false,
        'review_status', 'unreviewed',
        'safety_clearance', false
      )
    FROM (VALUES
      ('zink-acute-75mg', 'mannayan-zink', 'dose_adjustment', 'require_review', 'Akutschema nicht freigeben. Fünf Tabletten entsprechen 75 mg Zink; Dosis, Dauer, Gesamtzufuhr, Kupferhaushalt, gastrointestinale Risiken und Arzneimittelabstände fachlich prüfen.', 'mannayan', 'Lokales ZINK+-Inventar plus Peters Praxisangabe', '15 mg Zink pro Tablette; Peter nannte akut 5 Tabletten.', 98, ''),
      ('vitamin-b2-dose-missing', 'vitamin-b2', 'dose_adjustment', 'require_review', 'Keine Anwendung ableiten, bis konkrete Dosis, Dauer, Indikation, Gegenanzeigen und Wechselwirkungen dokumentiert und geprüft sind.', 'peter', 'Praxisangaben 20.08.2026', 'Hohe Vitamin-B2-Gaben ohne erhaltene Mengenangabe.', 95, ''),
      ('barberry-general-review', 'barberry', 'precaution', 'require_review', 'Vor Anwendung Schwangerschaft, Stillzeit, Alter, Allergien, Leber- und Nierenfunktion sowie Arzneimittelinteraktionen prüfen.', 'peter', 'Praxisangaben 20.08.2026', 'Barberry-Praxisdosis; Sicherheitsprüfung offen.', 90, ''),
      ('banderol-general-review', 'banderol', 'precaution', 'require_review', 'Vor Anwendung Schwangerschaft, Stillzeit, Alter, Allergien, Leber- und Nierenfunktion sowie Arzneimittelinteraktionen prüfen.', 'peter', 'Praxisangaben 20.08.2026', 'Banderol-Praxisdosis; Sicherheitsprüfung offen.', 90, ''),
      ('takuna-general-review', 'takuna', 'precaution', 'require_review', 'Vor Anwendung Schwangerschaft, Stillzeit, Alter, Allergien, Leber- und Nierenfunktion sowie Arzneimittelinteraktionen prüfen.', 'peter', 'Praxisangaben 20.08.2026', 'Takuna-Praxisdosis; Sicherheitsprüfung offen.', 90, ''),
      ('samento-general-review', 'samento', 'precaution', 'require_review', 'Vor Anwendung Schwangerschaft, Stillzeit, Alter, Allergien, Leber- und Nierenfunktion sowie Arzneimittelinteraktionen prüfen.', 'peter', 'Praxisangaben 20.08.2026', 'Samento-Praxisdosis; Sicherheitsprüfung offen.', 90, ''),
      ('houttuynia-general-review', 'houttuynia', 'precaution', 'require_review', 'Vor Anwendung Schwangerschaft, Stillzeit, Alter, Allergien, Leber- und Nierenfunktion sowie Arzneimittelinteraktionen prüfen.', 'peter', 'Praxisangaben 20.08.2026', 'Houttuynia-Praxisdosis; Sicherheitsprüfung offen.', 90, ''),
      ('supplement-total-intake', 'protocol-herbst-winter', 'monitoring', 'require_review', 'ANTIOXI+, BETA+, GLUCAN+, ZINK+, Vitamin C+ und weitere Produkte nur nach gemeinsamer Prüfung aller Inhaltsstoffe und der gesamten Nährstoffzufuhr kombinieren.', 'mannayan', 'Lokale Herstellerinventare', 'Mehrere Produkte enthalten sich überschneidende Vitamine, Mineralstoffe oder Pflanzenextrakte.', 95, ''),
      ('frequency-not-replacement', 'frequenzanwendung', 'precaution', 'require_review', 'Frequenz-, ChipCard- und TRIKOMBIN-Verfahren dürfen notwendige Labordiagnostik, ärztliche Diagnose, verordnete Behandlung oder Notfallversorgung nicht ersetzen oder verzögern.', 'peter', 'Getrennte Sicherheitsbewertung', 'Erfahrungsheilkundliche Verfahren ohne evidenzbasierte Wirkungsfreigabe.', 98, ''),
      ('hno-card-severe-conditions', 'hno-chipcard', 'precaution', 'require_review', 'Zuordnungen zu Abszess, Gelenk- oder Knieinfektion, Nierenentzündung, Pneumonie, Innenohr und SARS-CoV-2 sind reine Quellenzuordnungen. Dringliche medizinische Diagnostik und Behandlung haben Vorrang.', 'peter', 'Gewünschte HNO-ChipCard-Zuordnung', 'HNO-ChipCard wurde auch schweren oder dringlichen Zuständen zugeordnet.', 98, ''),
      ('acute-red-flags', 'protocol-herbst-winter', 'precaution', 'avoid', 'Bei Atemnot, Brustschmerz, Verwirrtheit, bläulichen Lippen, Kreislaufproblemen, deutlicher Verschlechterung, sehr hohem oder anhaltendem Fieber, Nackensteife, starker einseitiger Schwellung, schweren Ohr- oder Stirnhöhlenbeschwerden sowie Verdacht auf Pneumonie oder schweren COVID-19-Verlauf unverzüglich medizinisch abklären.', 'peter', 'Getrennte Sicherheitsbewertung', 'Komplementäre Maßnahmen dürfen dringliche Versorgung nicht verzögern.', 98, ''),
      ('tcm-model-label', 'tcm-algor-laedens', 'precaution', 'information', 'Pulmonalorbis und Algor laedens ausschließlich als traditionelle TCM-Deutungsmodelle kennzeichnen, nicht als moderne Anatomie, Mikrobiologie oder Pathophysiologie.', 'greten-543-547', 'Greten, Seiten 333 und 543 bis 547', 'Traditionelles TCM-Modell.', 95, ''),
      ('antioxi-dosage-form', 'mannayan-antioxi', 'monitoring', 'require_review', 'Darreichungsform vor jeder Verwendung klären: Peter nannte eine Tablette, das lokale Herstellerinventar führt Kapseln.', 'mannayan', 'Lokales ANTIOXI+-Inventar plus Peters Praxisangabe', 'Tablette gegenüber Kapsel.', 98, 'Quellenwiderspruch'),
      ('strunz-protocol-not-cleared', 'strunz-winter-protocol', 'precaution', 'require_review', 'Das Quellenprotokoll nicht als allgemeine Einnahme- oder Ernährungsanweisung freigeben. Indikation, Dauer, Gesamtzufuhr, Laborwerte, Vorerkrankungen und Arzneimittel getrennt prüfen.', 'strunz-safety', 'Getrennte interne Sicherheitsbewertung', 'Strunz-Quellenprotokoll mit kombinierten Dosis- und Ernährungsangaben.', 98, ''),
      ('strunz-vitamin-c-review', 'strunz-vitamin-c', 'precaution', 'require_review', 'Vor Anwendung insbesondere gastrointestinale Beschwerden, Nierenfunktion, Steinrisiko, Eisenstoffwechsel, Gesamtzufuhr und Arzneimittelinteraktionen prüfen.', 'strunz-safety', 'Getrennte interne Sicherheitsbewertung', 'Vitamin C 1 bis 3 g.', 95, ''),
      ('strunz-zink-review', 'strunz-zink', 'precaution', 'require_review', 'Dauer und Gesamtzufuhr festlegen sowie Kupferhaushalt, gastrointestinale Risiken, Arzneimittelabstände und Überschneidungen mit ZINK+, ANTIOXI+ und GLUCAN+ prüfen.', 'strunz-safety', 'Getrennte interne Sicherheitsbewertung', 'Zink 30 bis 60 mg täglich.', 98, ''),
      ('strunz-vitamin-e-review', 'strunz-vitamin-e', 'precaution', 'require_review', 'Vitamin-E-Form und IE-Umrechnung klären sowie Blutungsrisiko, Gerinnungshemmer, Thrombozytenhemmer, Operationen und Gesamtzufuhr prüfen.', 'strunz-safety', 'Getrennte interne Sicherheitsbewertung', 'Vitamin E 400 IE.', 98, ''),
      ('strunz-low-carb-review', 'strunz-low-carb', 'precaution', 'require_review', 'Keine pauschale Empfehlung ableiten. Diabetesmedikation, Schwangerschaft und Stillzeit, Essstörungen, Energieversorgung sowie Leber- und Nierenerkrankungen prüfen.', 'strunz-safety', 'Getrennte interne Sicherheitsbewertung', 'Weniger als 50 g Kohlenhydrate pro Tag.', 98, ''),
      ('strunz-protein-review', 'strunz-protein', 'precaution', 'require_review', 'Proteinmenge nach Körpergewicht, Alter, Aktivität, Gesamtenergie sowie Nieren- und Leberfunktion individuell einordnen.', 'strunz-safety', 'Getrennte interne Sicherheitsbewertung', 'Protein 1 bis 2 g pro kg Körpergewicht.', 95, ''),
      ('strunz-omega-3-review', 'strunz-omega-3', 'precaution', 'require_review', 'EPA-/DHA-Anteil, Produkt, Dosis, Medikamente, Operationen, Blutungsrisiko, Verträglichkeit und Gesamtzufuhr prüfen.', 'strunz-safety', 'Getrennte interne Sicherheitsbewertung', 'Omega-3-Fettsäuren 2 bis 6 g pro Tag.', 98, '')
    ) AS safety(
      safety_key,
      subject_key,
      rule_type,
      severity,
      action_text,
      source_key,
      source_locator,
      original_excerpt,
      confidence,
      ambiguity_notes
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

  SELECT count(*)
    INTO materialized_count
    FROM public.kb_import_core_links
   WHERE kb_import_core_links.batch_id = target_batch_id;

  IF materialized_count <> actual_count THEN
    RAISE EXCEPTION 'Autumn/winter HNO internal materialization count mismatch: expected %, found %', actual_count, materialized_count;
  END IF;
END seed;
$seed$;

COMMIT;
