BEGIN;

-- Internal, additive source capture only. This migration does not publish the
-- article and does not alter the legacy admin_knowledge_base table.
DO $$
DECLARE
  article_id uuid;
  revision_id uuid;
  pdf_source_id uuid;
  pdf_source_revision_id uuid;
  kirkamm_source_id uuid;
  kirkamm_source_revision_id uuid;
  article_content text := $article$
# SIBO-Gasprofile: Wasserstoff, Schwefelwasserstoff und Methan

## Interner Quellenstand

Dieser Artikel nimmt die Aussagen aus einem vom Nutzer bereitgestellten dreiseitigen SIBO-PDF vollstaendig auf. Die Schreibweise wurde bei erkennbaren OCR-Fehlern lesbar normalisiert; die Quelle, ihre Mittel-, Anwendungs- und Dosierungsangaben bleiben als quellengebundene Originalaussagen erhalten. Eine fachliche und sicherheitsbezogene Bewertung steht davon getrennt. Der Artikel ist `admin_only`, `review_status=unreviewed` und keine Patientenempfehlung.

## Wasserstoff-SIBO (H2-dominantes Muster)

### Symptome laut bereitgestelltem PDF

Durchfall, Blaehungen, Bauchgeraeusche, Voellegefuehl, Kraempfe und Gewichtsverlust.

### Dominante Bakterien laut bereitgestelltem PDF

E. coli, Candida, Enterobacter, Clostridien, Prevotella und Streptococcus.

### Behandlungsaussagen laut bereitgestelltem PDF

- Biofilmloser morgens
- Oreganooel
- Berberin
- Wermut
- Thymianextrakt
- Phellodendron
- Ingwer und Iberogast fuer MCC

### Ernaehrung laut bereitgestelltem PDF

Low-FODMAP-Ernaehrung, Fruktose vermeiden sowie Suessstoffe und Milchprodukte vermeiden.

### Hinweis laut bereitgestelltem PDF

YouTube-Video: Dr. Kirkamm zu SIBO.

## Schwefelwasserstoff-SIBO (H2S-bezogenes Muster)

### Symptome laut bereitgestelltem PDF

Eher Durchfall, brennendes Gefuehl im Darm, Blaehungen, Schwefel- oder fauliger Stuhlgeruch, Harndrang, starker Brainfog beziehungsweise Muedigkeit, Schmerzen im rechten Unterbauch sowie Kribbeln oder Taubheit an Unterarm oder Beinen.

### Dominante Bakterien laut bereitgestelltem PDF

Desulfovibrio, Bilophila wadsworthia, Fusobacterium, einige Clostridien, Salmonellen sowie eventuell Klebsiella und E. coli.

### Behandlungsaussagen laut bereitgestelltem PDF

- Biofilmloser morgens
- Oreganooel
- Berberin
- Wismut (im PDF als wichtig markiert)
- Molybdaen (im PDF als wichtig markiert)
- Zinkacetat
- Tributyrat
- L. plantarum (im PDF als probiotisches Bakterium bezeichnet)

### Ernaehrung laut bereitgestelltem PDF

Low-FODMAP-Ernaehrung, vor allem schwefelarm.

### Hinweis laut bereitgestelltem PDF

YouTube-Video: Dr. Kirkamm zu Schwefelwasserstoff-SIBO.

## Methan-SIBO beziehungsweise IMO (methanbezogenes Muster)

### Symptome laut bereitgestelltem PDF

Verstopfung, starke Blaehungen, Voellegefuehl, verlangsamte Darmmotilitaet und Brainfog.

### Dominante Mikroorganismen laut bereitgestelltem PDF

Archaeen, vor allem Methanobrevibacter smithii, Methanomassiliicoccus und Methanosphaera stadtmaniae. Als Wasserstoffproduzenten, die die Archaeen fuettern, werden Clostridien, Bacteroides, Prevotella, Streptococcus, E. coli, Klebsiella und Enterobacter genannt.

### Behandlungsaussagen laut bereitgestelltem PDF

- Biofilmloser morgens
- Allicin als staerkstes Mittel gegen Archaeen, bis ca. 2500 mg taeglich
- Oreganooel gegen Wasserstoffproduzenten
- Berberin gegen Wasserstoffproduzenten
- Neem
- Altratin zur Verminderung der Gasbildung
- Ingwer-Extrakt und Artischocken-Extrakt, jeweils ca. 500 mg taeglich, um MCC zu aktivieren, vor dem Schlafengehen
- Sporenbasierte Bakterien; im PDF steht ausdruecklich: keine normalen Probiotika

### Ernaehrung laut bereitgestelltem PDF

Low-FODMAP-Ernaehrung.

## Ergaenzende Dr.-Kirkamm-Quellen

Die oeffentlich zugaengliche Seite und die oeffentlichen Videoseiten von Dr. med. Ralf Kirkamm wurden als Quellenzusammenfassung aufgenommen, nicht als wortgetreues Volltranskript:

- Die Seite beschreibt SIBO als zu viele beziehungsweise fehlgeleitete Bakterien am falschen Ort und nennt als entstehende Gase Wasserstoff, Methan, Schwefelwasserstoff und CO2.
- Die Seite beschreibt Wasserstoffbildner, methanbildende Archaeen und sulfat-reduzierende Bakterien als unterschiedliche Stoffwechselgruppen.
- Die Seite nennt als klinische Hinweise unter anderem Blaehungen, Bauchschmerzen, Durchfall oder Verstopfung, Gewichtsverlust, Mangelzustaende, Besserung nach Nuechternphasen, Zunahme im Tagesverlauf und Verschlechterung nach kohlenhydratreichen Mahlzeiten.
- Als beguenstigende Faktoren werden unter anderem gestoerte Selbstreinigung beziehungsweise Motilitaet, Operationen, Protonenpumpenhemmer, Antibiotika, Schmerzmittel, akute Magen-Darm-Infekte, Parasiten oder Pilze sowie fehlende Verdauungssekrete beschrieben.
- Der beschriebene H2-/Methan-Atemtest verwendet Laktulose, Atemproben in 20-Minuten-Abstaenden und eine Gesamtdauer von etwa drei Stunden; dies bleibt als Quellenangabe getrennt von einer eigenen diagnostischen Bewertung.
- Die Therapie-Seite beschreibt vier Saeulen: zugrundeliegende Erkrankungen behandeln, Ernaehrung anpassen, die Ueberwucherung mit synthetischen oder pflanzlichen Antibiotika und Prokinetika adressieren sowie nutritive Mangelzustaende ausgleichen.
- Die Videos "Reizdarm und Duennarmfehlbesiedlung", "Was ist eine Duennarm-Fehlbesiedlung", "Gasbildung im Darm" und "Therapie der Duennarm-Fehlbesiedlung" werden als Fundstellen gefuehrt. Ein wortgetreues Transkript wird nicht dauerhaft gespeichert.

## Getrennte Evidenz- und Sicherheitsbewertung

- Die drei Gasprofile werden quellengetreu als PDF- und Kirkamm-Aussagen erhalten; Symptome oder Keimlisten beweisen allein keine SIBO beziehungsweise IMO.
- Wasserstoff- und Methan-Atemtests sind in der Fachliteratur anders standardisiert als H2S. H2S bleibt als moeglicher biologischer Kontext sichtbar, ist aber nicht mit einem gesicherten Routinediagnosekriterium gleichzusetzen.
- Archaeen sind keine Bakterien; bei methanbezogenen Mustern wird in der Fachliteratur auch die Bezeichnung intestinal methanogen overgrowth (IMO) verwendet.
- Die genannten Mittel, Kombinationen und Dosierungen sind keine automatische Therapieanweisung. Gegenanzeigen, Wechselwirkungen, Schwangerschaft, Stillzeit, Leber- und Nierenfunktion sowie Produktqualitaet muessen separat geprueft werden.
- Wismut, Molybdaen, Zink, Allicin, Berberin, Oreganooel, Neem, Wermut, Thymian, Phellodendron, Tributyrat, Probiotika und Extrakte erhalten jeweils einen separaten Safety-Review-Bedarf.
- Evidenzunsicherheit ist kein Ausschlussgrund. Sie wird als `unreviewed`, `domain_review` oder `safety_review` gekennzeichnet und blockiert eine automatische Freigabe.

## Quellen

1. Vom Nutzer bereitgestelltes dreiseitiges SIBO-PDF, interne Quellenaufnahme vom 10.08.2026; Dateiname und Datei-Hash lagen im Importtext nicht vor.
2. Dr. med. Ralf Kirkamm, "Reizdarm - SIBO - Duennarm-Fehlbesiedlung", https://www.dr-kirkamm.de/untersuchung/reizdarm-sibo
3. Dr. med. Ralf Kirkamm, "Was ist eine Duennarm-Fehlbesiedlung", https://www.dr-kirkamm.de/videos/was-ist-eine-duenndarm-fehlbesiedlung
4. Dr. med. Ralf Kirkamm, "Gasbildung im Darm", https://www.dr-kirkamm.de/videos/gasbildung-sibo
5. Dr. med. Ralf Kirkamm, "Therapie der Duennarm-Fehlbesiedlung", https://www.dr-kirkamm.de/videos/therapie-der-duenndarm-fehlbesiedlung
$article$;
BEGIN
  INSERT INTO public.kb_sources (canonical_key, metadata)
  VALUES (
    'source:sibo-pdf-2026-08-10',
    jsonb_build_object('admin_only', true, 'provided_text_only', true, 'file_hash_available', false)
  )
  ON CONFLICT (canonical_key) DO NOTHING
  RETURNING id INTO pdf_source_id;
  IF pdf_source_id IS NULL THEN
    SELECT id INTO pdf_source_id FROM public.kb_sources WHERE canonical_key = 'source:sibo-pdf-2026-08-10';
  END IF;

  INSERT INTO public.kb_source_revisions (
    source_id, revision_no, source_type, title, authors, rights_status,
    review_status, content_hash, metadata
  )
  VALUES (
    pdf_source_id, 1, 'other',
    'Vom Nutzer bereitgestelltes dreiseitiges SIBO-PDF',
    ARRAY['Nutzerbereitgestellte Quelle'], 'quoted', 'draft',
    md5('sibo-pdf-2026-08-10:1') || md5('sibo-pdf-2026-08-10:2'),
    jsonb_build_object('retrieved_on', '2026-08-10', 'file_name_available', false, 'ocr_text_received', true)
  )
  ON CONFLICT (source_id, revision_no) DO NOTHING;
  SELECT id INTO pdf_source_revision_id
    FROM public.kb_source_revisions
   WHERE source_id = pdf_source_id AND revision_no = 1;
  UPDATE public.kb_sources
     SET current_revision_id = pdf_source_revision_id
   WHERE id = pdf_source_id;

  INSERT INTO public.kb_sources (canonical_key, metadata)
  VALUES (
    'source:dr-kirkamm-sibo-public-material',
    jsonb_build_object('admin_only', true, 'source_scope', 'public_web_pages_and_video_page_summaries')
  )
  ON CONFLICT (canonical_key) DO NOTHING
  RETURNING id INTO kirkamm_source_id;
  IF kirkamm_source_id IS NULL THEN
    SELECT id INTO kirkamm_source_id FROM public.kb_sources WHERE canonical_key = 'source:dr-kirkamm-sibo-public-material';
  END IF;

  INSERT INTO public.kb_source_revisions (
    source_id, revision_no, source_type, title, authors, publisher, published_on,
    url, retrieved_on, rights_status, review_status, content_hash, metadata
  )
  VALUES (
    kirkamm_source_id, 1, 'website',
    'Dr. med. Ralf Kirkamm: SIBO und Duennarmfehlbesiedlung - oeffentliche Webseiten und Video-Seiten',
    ARRAY['Dr. med. Ralf Kirkamm'], 'dr-kirkamm.de', NULL,
    'https://www.dr-kirkamm.de/untersuchung/reizdarm-sibo', '2026-08-10',
    'quoted', 'draft', md5('dr-kirkamm-sibo-public-material:1') || md5('dr-kirkamm-sibo-public-material:2'),
    jsonb_build_object(
      'video_pages', jsonb_build_array(
        'https://www.dr-kirkamm.de/videos/reizdarm-und-duenndarmfehlbesiedlung',
        'https://www.dr-kirkamm.de/videos/was-ist-eine-duenndarm-fehlbesiedlung',
        'https://www.dr-kirkamm.de/videos/gasbildung-sibo',
        'https://www.dr-kirkamm.de/videos/therapie-der-duenndarm-fehlbesiedlung'
      ),
      'stored_as', 'source_summary_not_full_transcript'
    )
  )
  ON CONFLICT (source_id, revision_no) DO NOTHING;
  SELECT id INTO kirkamm_source_revision_id
    FROM public.kb_source_revisions
   WHERE source_id = kirkamm_source_id AND revision_no = 1;
  UPDATE public.kb_sources
     SET current_revision_id = kirkamm_source_revision_id
   WHERE id = kirkamm_source_id;

  INSERT INTO public.kb_articles (canonical_key, article_kind, metadata)
  VALUES (
    'reference:sibo-gasprofile-drei-formen-pdf-kirkamm',
    'reference',
    jsonb_build_object(
      'admin_only', true,
      'patient_facing_allowed', false,
      'commercial_claims_reviewed', false,
      'review_status', 'unreviewed',
      'source_revision_ids', jsonb_build_array(pdf_source_revision_id, kirkamm_source_revision_id),
      'source_citations_preserved', true,
      'safety_review_required', true
    )
  )
  ON CONFLICT (canonical_key) DO NOTHING
  RETURNING id INTO article_id;
  IF article_id IS NULL THEN
    SELECT id INTO article_id FROM public.kb_articles
     WHERE canonical_key = 'reference:sibo-gasprofile-drei-formen-pdf-kirkamm';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.kb_article_revisions AS existing_revision
     WHERE existing_revision.article_id = article_id AND existing_revision.revision_no = 1
  ) THEN
    INSERT INTO public.kb_article_revisions (
      article_id, revision_no, title, category_path, tags, content_markdown,
      review_status, origin_type, content_hash, metadata
    )
    VALUES (
      article_id, 1,
      'SIBO-Gasprofile: Wasserstoff, Schwefelwasserstoff und Methan',
      'Infothek > Verdauung > SIBO',
      ARRAY['SIBO', 'Duenndarmfehlbesiedlung', 'Wasserstoff', 'H2', 'Schwefelwasserstoff', 'H2S', 'Methan', 'IMO', 'Dr. Kirkamm'],
      article_content, 'draft', 'import',
      md5(article_content) || md5(article_content || ':sibo-article:1'),
      jsonb_build_object(
        'source_revision_ids', jsonb_build_array(pdf_source_revision_id, kirkamm_source_revision_id),
        'admin_only', true,
        'patient_facing_allowed', false,
        'evidence_and_safety_separate', true
      )
    )
    RETURNING id INTO revision_id;

    UPDATE public.kb_articles
       SET current_revision_id = revision_id
     WHERE id = article_id;
  END IF;
END;
$$;

COMMIT;
