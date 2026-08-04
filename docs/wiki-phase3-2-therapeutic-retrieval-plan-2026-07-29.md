# Wiki Phase 3.2+: Therapeutischer Katalog und erklaerbares Retrieval

Datum: 29.07.2026, aktualisiert am 03.08.2026
Status: Schritt 1 und Schritt 2A sind mit Commit `5c9488e` auf
`publish-wiki-blueprint-20260727` committed und gepusht. Schritt 2B ist
implementiert und verifiziert; sein Abschlussstand gehoert auf denselben
Feature-Zweig. Die Schritte 3A, 3B und 4A sind mit Commit `74ad20d` auf diesem
Zweig gesichert und gepusht. Schritt 4B-1 ist mit Commit `b6133db` als
schema-only Dosierungs- und Sicherheitsregelvertrag gesichert und gepusht.
Schritt 4B-2a ist mit Commit `c690e4f` als medizinisch inaktive,
releasegebundene Suchprojektion gesichert und gepusht. Schritt 4B-2b ist am
02.08.2026 als medizinisch inaktiver Laborparameter-, Referenzbereichs- und
Befunddefinitionsvertrag mit Commit `e1f6cbc` gesichert und gepusht. Schritt 5A
ist am 02.08.2026 als medizinisch inaktiver homoeopathischer
Repertoriumsvertrag implementiert und lokal verifiziert. Keiner dieser Schritte
ist nach Supabase ausgerollt. Schritt 5B-1 ist als medizinisch inaktiver,
owner-only Einzelrepertorium-Reader implementiert und vollstaendig lokal
verifiziert. Schritt 5B-2 ist als medizinisch inaktiver, owner-only
Importvorpruefvertrag implementiert und vollstaendig lokal verifiziert. Schritt
5B-3 ist als medizinisch inaktiver parserseitiger Bundle-Hashvertrag
implementiert und vollstaendig lokal verifiziert. Schritt 5B-4 ist als
parserseitiger Vertrag fuer die fuenf normalisierten Step-5A-Zeilenhashes
implementiert und vollstaendig lokal verifiziert. Schritt 5B-5 ist als
owner-only atomarer Kleinmengen-Referenzwriter implementiert und vollstaendig
lokal verifiziert. Schritt 5B-6 ist als owner-only persistenter Chunk-Staging-,
Resume-, Abbruch- und atomarer Finalisierungsvertrag implementiert und
vollstaendig lokal verifiziert. Echter lizenzierter Inhalt, ein Rohdatenparser,
ein produktiver Bulk-Importvertrag sowie die Schritte 6 und 7 bleiben offen.

## Ziel

Die interne Datenbank soll alle fuer Peter relevanten naturheilkundlichen
Wissensformen strukturiert aufnehmen und spaeter mit den tatsaechlichen
Patienteneingaben aus Lovable abgleichen koennen.

Abgedeckt werden insbesondere:

- Homoeopathische Einzel- und Komplexmittel
- Nosoden, Sarkoden und Isoden
- Urtinkturen, Pflanzentinkturen und Extrakte
- Vitamine, Mineralstoffe und Spurenelemente
- Aminosaeuren, Enzyme, Probiotika und Nahrungsergaenzungen
- konkrete Herstellerprodukte und Varianten
- Programme, Protokolle, Geraete und Therapieformen
- traditionelle Anwendung, Fachliteratur, Herstellerangaben,
  Erfahrungsheilkunde und interne Praxisregeln
- wissenschaftliche Quellen, sofern vorhanden

Wissenschaftliche Evidenz ist keine Voraussetzung fuer die Aufnahme und darf
traditionelle oder praktische Wissensgrundlagen nicht automatisch aus der Suche
verdraengen. Die Herkunft jeder Aussage bleibt jedoch getrennt sichtbar.
Sicherheit wird unabhaengig von der Wissensbasis deterministisch behandelt.

## Bereits vorhandenes Fundament

Phase 1 stellt bereits bereit:

- stabile Entitaeten und unveraenderliche kanonische Schluessel
- revisionierte Fachinhalte
- alternative Namen und externe Kennungen
- Produkte, Produktvarianten, Substanzen, Pflanzen und Naehrstoffe als Typen
- kontrollierte, quellengebundene Beziehungen
- versionierte Aussagen
- getrennte Evidenzbasis und Evidenzqualitaet
- versionierte Quellen und genaue Fundstellen
- Review- und Releaseworkflow
- Admin-RLS und Patientenausschluss

Phase 3 stellt ein geschlossenes Import-Staging bereit. Phase 3.1 kann gepruefte
Quellenkandidaten kontrolliert als Kernentwurf uebernehmen.

Diese Grundlagen werden erweitert und nicht ersetzt.

## Festgestellte Luecken im aktuellen Therapiepfad

Der aktuelle `therapy-recommend`-Pfad verarbeitet die meisten Befunde als
Freitext. Strukturiert extrahierte Laborwerte, Befundquellen und weitere
Anamnesebloecke werden noch nicht als stabile Fakten an das Retrieval gegeben.

Der aktuelle Pfad:

- liest weiterhin `admin_knowledge_base`
- bildet ein einzelnes skalares Relevanzranking
- nutzt bei Map-Reduce ein KI-Ranking vor der eigentlichen KI-Ausgabe
- speichert nicht die exakten verwendeten Kernrevisionen, Aussagen und Quellen
- prueft einen Teil der Mittelsicherheit erst nach der KI-Ausgabe im Client
- kann manuell fixierte Mittel nicht durchgehend an eine exakte Variante und
  Quellenrevision binden

Deshalb wird dieser Pfad nicht schrittweise zu einem undurchsichtigen v2
umgebaut. Ein neuer deterministischer Pfad laeuft spaeter parallel im
Schattenbetrieb.

## Verbindliche Systemgrenzen

### Allgemeine Wissensdatenbank

Enthaelt nur allgemeines Fachwissen:

- Mittel, Zubereitungen und Produkte
- Symptome, Erkrankungen, Pathogene, Organe und Laborbegriffe
- allgemeine Dosierungs- und Sicherheitsregeln
- Quellen, Aussagen und Praxiswissen

Sie enthaelt niemals:

- Patienten-ID oder Benutzer-ID
- Pseudonym
- Therapiesitzungs-ID
- Anamnese-ID
- Rohbefund oder Patientenzitat
- patientenspezifische Messung oder Beobachtung

### Geschuetzter Patientenbereich

Enthaelt spaeter unveraenderliche Eingaberevisionen, Quellenartefakte und
atomare Patientenfakten. Ein Patientenfakt darf optional auf eine allgemeine
`kb_entity_id` verweisen. Die Wissensentitaet verweist niemals zurueck auf den
Patienten.

### Retrieval und KI

Deterministische Suche, Sicherheit, Kandidatenstatus und Reihenfolge werden
serverseitig festgelegt und gespeichert. Eine KI darf danach nur erklaerenden
Text zu bereits erlaubten Kandidaten und Aussagen formulieren.

## Umsetzungsfolge

## Schritt 1: Therapeutischer Katalog

Neue additive Migration:

`supabase/migrations/20260729140000_create_kb_therapeutic_catalog.sql`

### Neuer Entitaetstyp

`preparation`

Eine Zubereitung ist die therapeutisch unterscheidbare Form zwischen
Ausgangsstoff und konkretem Herstellerprodukt.

Beispiele:

- `Arnica montana` als Pflanze
- `Arnica D6` als Zubereitung
- `Arnica-Urtinktur 1:5` als andere Zubereitung
- `Arnica D6 Globuli 10 g von Hersteller X` als konkrete Produktvariante

### Revisionierte Detailtabellen

Alle Details werden an eine konkrete `kb_entity_revisions`-Revision gebunden,
nicht nur an die stabile Entitaet. Dadurch bleiben Potenz, Zusammensetzung und
Produktvariante reproduzierbar.

#### `kb_preparation_revision_details`

- `entity_id`
- `entity_revision_id`
- `preparation_kind`
- `dosage_form`
- kontrollierte `administration_routes`
- `standardization_status`
- `basis_assertion_id`
- seltene technische Zusatzmetadaten
- Ersteller und Zeitpunkt

Kontrollierte Startwerte fuer `preparation_kind`:

- `homeopathic_single`
- `homeopathic_complex`
- `nosode`
- `sarcode`
- `isode`
- `mother_tincture`
- `herbal_tincture`
- `fluid_extract`
- `dry_extract`
- `essential_oil`
- `herbal_tea`
- `nutrient_single`
- `nutrient_combination`
- `mineral`
- `trace_element`
- `amino_acid`
- `probiotic`
- `enzyme`
- `supplement`
- `other`

#### `kb_homeopathic_revision_details`

- dieselbe Entitaets- und Revisionsbindung
- `remedy_kind`
- `potency_scale`
- `potency_value`
- `potentization_method`
- `basis_assertion_id`

Ein Einzelmittel, eine Nosode, Sarkode oder Isode benoetigt eine genaue Potenz.
Ein Komplexmittel darf seine Potenzen ueber einzelne Komponenten abbilden.

#### `kb_botanical_revision_details`

- dieselbe Entitaets- und Revisionsbindung
- verwendete Pflanzenteile
- frisches, getrocknetes oder gemischtes Ausgangsmaterial
- Zubereitungs-/Extraktionstyp
- Drogen-Extrakt-Verhaeltnis von/bis
- Extraktionsloesungsmittel
- Alkoholgehalt von/bis
- `basis_assertion_id`

Die zugehoerige Pflanze wird ueber eine kontrollierte, quellengebundene
`prepared_from`-Relation verknuepft.

#### `kb_nutrient_revision_details`

- dieselbe Entitaets- und Revisionsbindung
- Einzel- oder Kombinationsformulierung
- Darreichungs-/Traegersystem wie Standard, chelatiert, liposomal, gepuffert,
  retardiert, oelbasiert oder waessrig
- `basis_assertion_id`

Chemische Form, Gesamtmenge und Elementarmenge werden komponentenbezogen
gespeichert, nicht als Freitext in dieser Tabelle.

#### `kb_product_variant_revision_details`

- konkrete Produktvariantenrevision
- genaue Produktfamilienrevision
- genaue Zubereitungsrevision
- Packungsmenge und Einheit
- Marktstatus
- Gueltigkeitszeitraum
- `basis_assertion_id`

PZN, GTIN und Hersteller-SKU bleiben in `kb_entity_identifiers`.

#### `kb_composition_components`

Quellengebundene Zusammensetzung einer Zubereitung oder Produktvariante:

- Besitzer-Entitaet und Besitzerrevision
- Komponenten-Entitaet und Komponentenrevision
- Komponentenrolle
- chemische Form
- Mindest- und Hoechstmenge
- Einheit
- Bezugsmenge und Bezugseinheit
- Elementarmenge und Einheit
- Reihenfolge
- Gueltigkeitszeitraum
- `basis_assertion_id`

Komponenten koennen Substanzen, Pflanzen, Naehrstoffe oder bereits definierte
Zubereitungen sein. Dadurch lassen sich Vitaminverbindungen, Elementarmengen und
homoeopathische Komplexbestandteile ohne eine generische EAV-Tabelle abbilden.

### Quellenpflicht

Jede Detailzeile und jede Komponente verweist auf eine konkrete
`kb_assertions`-Aussage. Diese Aussage verwendet bereits:

- `manufacturer_statement`
- `traditional_use`
- `experiential_medicine`
- `practice_rule`
- `mechanistic`
- `observational_study`
- `clinical_study`
- `systematic_review`
- `guideline`
- oder vorlaeufig `unrated`

Die Aussage verweist ueber `kb_assertion_sources` auf eine konkrete
Quellenrevision und Fundstelle. Es wird keine wissenschaftliche Quelle erzwungen;
erzwungen wird nur eine ehrliche, nachvollziehbare Herkunft.

### Neue kontrollierte Relationen

- `prepared_from`: Zubereitung zu Pflanze, Substanz, Naehrstoff oder Pathogen
- `realizes_preparation`: Produktvariante zu Zubereitung
- `variant_of`: Produktvariante zu Produktfamilie
- `complementary_to`: homoeopathisch komplementaere Zubereitung
- `follows_well`: gerichtete Folgemittelbeziehung
- `antidotes`: gerichtete antidotierende Beziehung
- `inimical_with`: unvertraegliche Zubereitungen

Die vorhandenen Relationen `indicated_for`, `targets_pathogen`, `may_support`,
`contains`, `part_of_protocol`, `alternative_to`, `contraindicated_for` und
`interacts_with` werden um zulaessige `preparation`-Domains erweitert.

Alle fachlichen Kanten bleiben `kb_assertions`-gebunden. Eine Relation ist kein
Wirksamkeitsbeweis und traegt weiterhin Zuordnungsstaerke, Kontext, Evidenzbasis
und Quelle.

### Integritaet

Die Migration implementiert:

- korrekten Entitaetstyp pro Detailtabelle
- exakte Verbund-FKs auf Entitaet und Revision
- passende Unterdetailtabelle je Zubereitungsart
- positive Mengen und gueltige Bereiche
- Potenzskala/-wert-Konsistenz
- Extrakt- und Alkoholbereichspruefung
- Komponentenrollen und erlaubte Komponententypen
- Reviewstatuspruefung der `basis_assertion_id`
- unveraenderliche Details freigegebener oder historischer Revisionen
- kanonischen therapeutischen Revisionspayload und SHA-256
- verzögerte Validierung, damit Revision, Aussage, Details und Hash atomar in
  einer Transaktion angelegt werden koennen

Eine freigegebene Zubereitungs- oder Produktvariantenrevision darf keine
ungepruefte, zurueckgezogene oder quellenlose Detailaussage verwenden.

### Zugriff

- `anon`: kein Zugriff
- Patienten: kein Zugriff
- authentifizierte Nicht-Admins: keine sichtbaren Zeilen
- Administrator: RLS-gesteuerter Lese-/Schreibzugriff
- `service_role`: ausschliesslich Lesen fuer kontrollierte Edge-Pfade und Backup
- `kb_importer` und `kb_import_runtime`: kein Kernzugriff

## Schritt 2: Katalog-Promotion

Nach der Katalogmigration wird die geplante Entitaets-Promotion nicht als
beliebige generische Kopie umgesetzt. Sie muss atomar erzeugen:

- stabile Kernentitaet
- Revision 1 als `draft`
- Namen und Aliase
- typgerechte Detailzeilen
- quellengebundene Aussagen und Relationen
- unveraenderliche Importprovenienz
- kanonischen Inhalts-Hash

Unklare Potenz, chemische Form, Produktvariante oder Basisrelation fuehrt zu
`needs_clarification`, nicht zu einem geratenen Kernobjekt.

### Schritt 2A: Kandidatenvertrag

Am 2026-07-30 umgesetzt und mit Commit `5c9488e` auf
`publish-wiki-blueprint-20260727` gepusht: normalisierte, append-only
Kandidatenzeilen fuer Namen, Aussagen, Quellenbindungen und therapeutische
Details, ein versiegelter SHA-256-Vertrag sowie ein deterministischer,
schreibfreier Promotion-Readiness-Pruefer. Backup und gemeinsamer Snapshot
umfassen damit 48 Wiki-Tabellen. Dieser Teilschritt erzeugt selbst noch kein
Kernwissen und wurde nicht nach Supabase ausgerollt.

### Schritt 2B: Atomare Draft-Promotion

Am 2026-07-31 implementiert und verifiziert. Der admin-only RPC prueft die
Readiness unter Locks erneut und erzeugt in einer Transaktion eine neue
Kernentitaet, Revision 1 als `draft`, Namen, quellengebundene Aussagen mit den
exakten Quellenrevisionen sowie typisierte Details und Komponenten. Wiederholung
liefert nach erneuter Integritaetspruefung dieselben IDs und legt keine Duplikate
an. Kandidaten fuer bestehende Entitaeten bleiben ein getrenntes
Revisionsverfahren.

Zwei append-only Provenienztabellen frieren das strukturierte Eingangsmanifest,
das Aufloesungsmanifest, die initialen Inhalts-Hashes und alle direkten oder aus
Kandidaten aufgeloesten Revisionsabhaengigkeiten ein. Der gemeinsame
Snapshot-/Restore-Vertrag umfasst damit exakt 50 Wiki-Tabellen. Schritt 2B legt
keine Relationen, Dosierungen, Sicherheitsregeln oder Patientendaten an. Die
Aenderungen gehoeren ausschliesslich auf den Feature-Zweig und wurden nicht nach
Supabase ausgerollt.

## Schritt 3: Strukturierte Patienteneingaben und Fakten

Dieser Schritt erfolgt in einer eigenen Migration ausserhalb der `kb_*`-Tabellen.

### Schritt 3A: Unveraenderlicher Eingabe- und Quellenumschlag

Lokal implementiert in:

`supabase/migrations/20260731120000_create_therapy_input_envelope.sql`

Tabellen:

- `therapy_input_revisions`
- `therapy_input_sources`

Der Teilschritt friert ausschliesslich den deidentifizierten Eingabestand und
seine geordneten Quellenartefakte ein. Beide Tabellen sind append-only, besitzen
eine kanonische SHA-256-Kette und koennen nur gemeinsam in einer Transaktion
versiegelt werden. Es gibt keine direkte Patienten-, Benutzer-, Session-,
Anamnese- oder Wissensdatenbank-Fremdschluesselbeziehung.

Der Zugriff ist auf Administrator-Lesen und `service_role`-Lesen beschraenkt.
Ein Schreib-RPC, Backfill, Faktenextraktion und eine Live-Anbindung an
`therapy-recommend` sind ausdruecklich nicht enthalten. Freie Patientencodes
werden an dieser Auditgrenze nicht akzeptiert; zugelassen ist nur das
Praxispseudonym `P-YYYY-NNNN`.

Der Umschlag ist kein Rohdump des heutigen Autosave-/Anamneseobjekts. Die
eingefrorene PII-Pruefung `clinical-deidentification-v1` lehnt generische und
zusammengesetzte Namens-, Kontakt-, Adress-, Versicherungs-, Geburts- und
Dateipfadfelder fail-closed ab. Ein spaeterer Capture-Writer muss klinische
Bezeichnungen in eindeutige semantische Schluessel wie `medication_label`
ueberfuehren, direkte Identifikatoren entfernen, eine Residualpruefung
durchfuehren und erst danach hashen. Neue PII-Regeln erhalten eine neue Version;
die v1-Funktionen duerfen wegen historischer Restorefaehigkeit nicht ersetzt
werden.

Eine Revision ist auf 64 Quellen, 8 MiB je JSON-Objekt und insgesamt 32 MiB fuer
Umschlag, Quellenpayloads, Locator und neutrale IDs begrenzt.

Das positive v1-Schema akzeptiert im Umschlag exakt `format`, `clinical_text`
und einen eng typisierten `context`. Quellenpayloads enthalten exakt
`format: text`, deidentifizierten Fliesstext und `language`. JSON oder
JSON-artige Rohstrukturen im Text sind unzulaessig; bekannte Redaktionsmarker
und klinische Referenzbereiche bleiben erlaubt. Fundstellen sind leer oder
neutral kanonisiert, zum Beispiel `page:2`, `section:laboratory` oder
`time:00:10-00:30`.

Der historische Backupvertrag `therapy_input_export_snapshot_v1()` bleibt
definition- und bytegleich erhalten. Er serialisiert die beiden Step-3A-Tabellen
bereits in PostgreSQL verlustfrei als JSON-Text, damit grosse JSON-Zahlen nicht
durch JavaScript gerundet werden. Der aktuelle Backup-Pfad verwendet nach
Schritt 3B ausschliesslich den unten beschriebenen Vier-Tabellen-Snapshot v2.
Restore ist nur als Datenbankeigner in einer Transaktion zulaessig. Diese
Patientendaten gehoeren nie in `kb_export_wiki_snapshot()`.

Verifikation am 31.07.2026:

- 17/17 fokussierte PGlite-Vertrags-, PII-, RLS-, Snapshot- und Restoretests
- 107/107 verwandte Wiki-/Backup-Tests
- 374/374 Tests im vollstaendigen Projektlauf
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf der geaenderten TypeScript-Dateien ohne Fehler
- Produktionsbuild erfolgreich
- unabhaengige Abschlusspruefung mit ausdruecklichem Sign-off, keine P1/P2
- kein Supabase-Deployment, kein Backfill und kein Commit/Push

### Eingaberevision

Friert den fuer einen Therapielauf verwendeten, deidentifizierten Eingabestand
mit Hash ein. Mutable Autosaves und `patient_snapshot` bleiben Arbeitszustand,
sind aber nicht die Auditgrundlage.

### Quellenartefakte

Erfassen neutralisierte Dokument-ID, Quellentyp, Dokumentdatum, Inhalts-Hash und
Fundstellen fuer:

- manuelle Eingabe
- Anamnese
- Labor
- Arztbericht
- Bildgebung
- Stuhl/Mikrobiom
- Metatron/NLS
- Vieva Plus
- externe Recherche
- Bestellung

### Schritt 3B: Atomare Patientenfakten

Lokal implementiert in:

`supabase/migrations/20260731130000_create_therapy_input_facts.sql`

Neue Tabellen:

- `therapy_input_facts`
- `therapy_input_fact_sources`

Die Migration ist rein additiv. Sie erzeugt keinen Capture-Writer, keinen
Backfill und keine Anbindung an `therapy-recommend`, Patientenspeicherung oder
sichtbare Therapieausgabe. Ein Produktionsscan stellt sicher, dass die vier
`therapy_input_*`-Tabellen und ihre Export-RPCs vorerst nur in den ausdruecklich
erlaubten Backupflaechen vorkommen.

### Atomare Fakten

Starttypen:

- Demografie
- Symptom
- Erkrankung
- Medikament
- Allergie
- bisherige Behandlung
- Eingriff
- Laborbeobachtung
- Mikrobiombeobachtung
- Untersuchungsbefund
- Familien- und Sozialanamnese
- Lebensstil und Exposition
- Impfung
- Therapieziel
- Sicherheitsflag
- offene Frage

Jeder Fakt erhaelt Status, Zeitpunkt, Negation, Sicherheit, Extraktionsmethode,
Reviewstatus, Quellfundstelle und optional eine allgemeine `kb_entity_id`.

Metatron/NLS bleibt als `complementary_measurement` gekennzeichnet und wird
nicht still zu einer gesicherten Diagnose. Externe Recherche bleibt Quelle fuer
eine Pruefung und wird nicht automatisch zum Patientenfakt.

`fact_value` ist keine freie EAV-Ablage, sondern eine begrenzte getaggte Struktur
fuer `none`, `text`, `boolean`, `coded` oder `quantity`. Codesysteme,
Komparatoren, Einheiten, Referenzbereiche, Textlaengen, Faktenzahl und
Gesamtgroesse sind kontrolliert. Demografische Fakten besitzen eine kleine
Allowlist mit typisierten Wertebereichen beziehungsweise kontrollierten Codes;
Geburtsdatum, Name, Kontakt-, Versicherungs-, Benutzer-, Session- und
Dateipfadsemantik bleibt auch bei getrennten oder zusammengesetzten Schluesseln
und Fundstellen gesperrt. Legitimes klinisches Vokabular wie `pathogen` und
`mobility` bleibt zulaessig.

Jeder Fakt benoetigt mindestens eine primaere Quelle und fuer jede Bindung eine
nichtleere kanonische Fundstelle. `external_research` ist in jeder Quellenrolle,
allein oder gemischt, unzulaessig. `complementary_measurement` und `vieva_plus`
duerfen nur eng begrenzte Untersuchungsbefunde oder offene Fragen mit
`review_only` beziehungsweise auditierbar `rejected`, ohne `kb_entity_id`,
erzeugen.

Fakten und Quellenbindungen sind append-only. Korrekturen bleiben innerhalb
derselben Eingaberevision, muessen Typ und Schluessel beibehalten, zeitlich nach
dem Vorgaenger liegen und duerfen den Review-Vertrauensstand nicht absenken.
Pro Vorgaenger ist hoechstens eine Korrektur erlaubt. Eine Revisionssperre
serialisiert konkurrierende Einfuegungen, damit Faktenzahl- und
8-MiB-Gesamtgrenze nicht durch parallele Transaktionen umgangen werden.

Der Zugriff bleibt admin-only lesbar; `service_role` darf nur lesen und den
Snapshot exportieren. Patienten, `anon`, `kb_importer` und `kb_import_runtime`
erhalten keinen Zugriff. Es existiert weiterhin kein Schreib-RPC.

Der aktuelle Backupvertrag `therapy_input_export_snapshot_v2()` exportiert
`therapy_input_revisions`, `therapy_input_sources`, `therapy_input_facts` und
`therapy_input_fact_sources` gemeinsam, verlustfrei und deterministisch. Version,
exakte Tabellengrenze, Zeilenzahlen, SHA-256-Werte,
`invalid_revision_count = 0` und `invalid_fact_count = 0` werden sowohl an der
Edge-Grenze als auch vor dem Browser-ZIP fail-closed geprueft. Der Fakten-Snapshot
wird vor dem spaeteren Wiki-Snapshot erfasst; durch Append-only und den
restriktiven `kb_entity_id`-Fremdschluessel muss der spaetere Wiki-Snapshot alle
referenzierten Entitaeten enthalten. Restore erfolgt ausschliesslich als
Datenbankeigner, nach dem Wiki-Restore, in einer Transaktion und ohne
JavaScript-Neuserialisierung.

Verifikation am 31.07.2026:

- 47/47 fokussierte Step-3A-, Step-3B- und Backup-Vertragstests
- 404/404 Tests im vollstaendigen Projektlauf
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf der betroffenen TypeScript-Dateien ohne Fehler
- Produktionsbuild erfolgreich
- zwei unabhaengige Abschlusspruefungen mit ausdruecklichem `APPROVE`, keine P1/P2
- kein Supabase-Deployment, kein Backfill, kein Writer und kein Commit/Push

## Schritt 4: Freigaben, Regeln und Suchprojektion

### Schritt 4A: Medizinisch inaktiver Knowledge-Release-Vertrag

Lokal implementiert in:

`supabase/migrations/20260801090000_create_kb_release_contract.sql`

Die beiden additiven Tabellen `kb_releases` und `kb_release_items` bilden einen
strikten schema-only Vertrag. Es werden keine Releases angelegt, keine
Wissensdaten zurueckgeschrieben und keine Retrieval-, Therapie- oder
Patientenpfade angebunden.

Ein Item besitzt vier typisierte Referenzgruppen fuer eine exakte
Entity-Revision, Artikelrevision, Assertion oder Quellenrevision. Eine
fail-closed Exactly-one-Regel und zusammengesetzte Fremdschluessel verhindern
untypisierte EAV-Referenzen und Eigentuemerverwechslungen. Beim Versiegeln sind
nur Objekte im Status `released` zulaessig.

Das kanonische Item-Manifest v1 friert die exakte Wissensreferenz, den
Inhalts-Hash und alle fachlichen Abhaengigkeiten ein. Entity-Items enthalten
zusaetzlich die geordnete damalige Menge aller Namen und Identifikatoren. Diese
eingefrorenen Werte bleiben Teil des Release-Hashes, auch wenn spaeter lebende
Aliase oder Identifikatoren gepflegt werden. Auditakteur-, Patienten-, Benutzer-
oder Sitzungs-IDs werden nicht in die Release-Tabellen oder -Manifeste kopiert.

Der Seal-Validator verlangt:

- alle direkten und dadurch transitiv alle therapeutischen Entity-Revisionen
- alle Basisassertionen therapeutischer Detail- und Komponentenreihen
- fuer jede Assertion alle exakten primaeren freigegebenen unterstuetzenden
  oder qualifizierenden Quellenrevisionen mit Fundstelle
- fuer Relationsassertionen die konkrete Graphkante und freigegebene exakte
  Revisionen beider Endpunkte
- fuer Artikel alle konkret verknuepften Entity-Revisionen
- gueltige kanonische Item-, Release- und SHA-256-Manifeste

Der Build-zu-Seal-Uebergang ist ausschliesslich direkte Datenbankeigner-DML. Es
gibt keinen Seal-/Create-/Write-RPC und keinen Schreib-Grant. Build-Zeilen koennen
unter Owner-Kontrolle zusammengestellt werden; versiegelte Releases und ihre
Items sind unveraenderlich. Delete und Truncate werden fuer beide Tabellen
abgelehnt. Item-Writes erzeugen eine Parent-Zeilenversion, damit ein paralleler
Seal alle Items sieht oder serialisierungsbedingt abbricht. Der Snapshotzaehler
`invalid_knowledge_releases` erkennt unvollstaendige Abhaengigkeiten,
Manifestabweichungen und Hashmanipulation fail-closed.

Dosierungs- und Sicherheitsregeln fehlen weiterhin. Deshalb erzwingt v1 auf
jeder Release-Zeile `retrieval_eligible = false` und `is_active = false`. Der
Vertrag besitzt weder eine Aktivierungsfunktion noch einen produktiven Leser.

Administratorinnen und Administratoren duerfen ueber RLS nur lesen.
`service_role` darf nur lesen und den gemeinsamen Snapshot aufrufen. Patienten
sehen keine Zeilen; `anon`, `kb_importer` und `kb_import_runtime` haben keinen
Zugriff.

Der Wiki-Snapshot, Browser-/Edge-Vertrag und Owner-Restore umfassen nun exakt 52
Tabellen. `kb_releases` wird nach den Kernobjekten und `kb_release_items` zuletzt
nach allen gebundenen Revisionen und Abhaengigkeiten restauriert. Die
Therapie-Input-Snapshots v1 und v2 wurden nicht veraendert; v2 umfasst weiterhin
exakt seine vier Tabellen. Der Wiki-RPC liefert den exakten gehashten JSON-Text
je Tabelle; Edge und Browser pruefen den Inhalts-SHA-256 und sichern diesen Text
ohne JavaScript-Neuserialisierung. Ein Restore-Test haelt dabei eine reale
Therapie-Faktreferenz auf `kb_entities` und weist den byteidentischen Snapshot v2
vor und nach dem Wiki-Restore nach. Teil- und Vollbackup nennen beide das
notwendige vorherige Nullsetzen der drei `current_revision_id`-Zeiger; der
storagefreie Wiki-Bereich lehnt unerwartete Storage-Downloads fail-closed ab.

Die ausfuehrliche Implementierungsdokumentation steht in
`docs/wiki-phase3-5-knowledge-release-contract-implementation-2026-08-01.md`.

### Schritt 4B: Regeln und Suchprojektion

#### Schritt 4B-1: Medizinisch inaktiver klinischer Regelvertrag

Lokal implementiert in:

`supabase/migrations/20260801100000_create_kb_clinical_rule_contract.sql`

Der additive Vertrag erzeugt genau drei leere Tabellen:

- `kb_dosage_rules`
- `kb_safety_rules`
- `kb_safety_rule_conditions`

Jede Regel bindet genau eine vorhandene Assertion des passenden Typs
`dosage` beziehungsweise `safety`, eine konkrete therapeutische Subject-Revision
und die bereits vorhandenen Assertion-Quellen. Dosierungen koennen optional eine
exakte Indikations- und Populationsrevision binden. Dosis, Einheit, Frequenz,
Dauer, Timing und Route sind strukturiert und kontrolliert; freie Dosierungs-JSON
existiert nicht.

Safety-Regeln verwenden ausschliesslich die bereits fuer Safety-Kandidaten
definierten Regeltypen und Schweregrade. Der Effekt ist deterministisch:

- `information` wird `allow_with_notice`
- `caution` und `require_review` werden `review_only`
- `avoid` wird `exclude`

Bedingungen sind ausschliesslich eine geordnete AND-Menge aus `always`,
`entity_present`, `fact_present`, `fact_missing`, `coded_value_in` und
`quantity_compare`. Jeder Typ besitzt eine fail-closed Spaltenform; `always` ist
nur als einzige Bedingung zulaessig. Es gibt keine freie Predicate- oder
Metadata-JSON und keine Patienten-, Nutzer-, Sitzungs- oder Pseudonymreferenz.

Der transaktionsendgueltige Validator verlangt passende Assertion-Kinds,
exakte Entity-/Revisionspaare, zulaessige Typen, eine primaere Quelle mit
nichtleerer Fundstelle, statuskompatible Quellen und Revisionen, vollstaendige
Safety-Bedingungen sowie den kanonischen vollstaendigen `rule_content_hash`.
Regel-, Bedingungs-, Quellen- und Revisionswrites sperren die betroffenen
Abhaengigkeiten und erzeugen echte neue Zeilenversionen der koordinierenden
Entity-/Quellen-Eltern sowie der Regelassertion. Dadurch muss auch ein aelterer
`REPEATABLE READ`-Writer bei einer parallelen Freigabe oder einer fuer ihn noch
unsichtbaren neuen Revisionskante serialisierungsbedingt abbrechen, statt eine
Write-Skew-Luecke zu hinterlassen. Ab `approved` sind Regelinhalt und
Quellenbindung dauerhaft unveraenderlich; ein Zuruecksetzen der Regelassertion
auf `draft` ist dann ausgeschlossen.

Nur der Datenbankeigner kann direkt schreiben. Administratoren und
`service_role` duerfen wie in 4A nur lesen, wobei RLS Patientenzeilen verbirgt;
`anon`, `kb_importer` und `kb_import_runtime` haben keinen Zugriff. Writer-RPC,
Seed, Backfill, Kandidatenpromotion und produktiver Leser existieren nicht.
Release v1 bleibt unveraendert hart `retrieval_eligible = false` und
`is_active = false`.

Der gemeinsame Wiki-Snapshot umfasst nun exakt 55 statt 52 Tabellen und liefert
zusaetzlich `invalid_dosage_rules` und `invalid_safety_rules`. Browser, Edge,
Fallback und Owner-Restore verwenden dasselbe Inventar und pruefen weiterhin den
SHA-256 des exakten serialisierten Tabellenbytes. Der Therapie-Input-Snapshot v2
bleibt byteidentisch und exakt vier Tabellen gross. Die historische 4A-Grenze
von 50 auf 52 wird in ihren isolierten Migrationstests unveraendert geprueft;
4B-1 prueft separat die Grenze von 52 auf 55.

Die ausfuehrliche Implementierungsdokumentation steht in
`docs/wiki-phase4b-1-clinical-rule-contract-implementation-2026-08-01.md`.

#### Schritt 4B-2a: Medizinisch inaktive Suchprojektion

Lokal implementiert in:

`supabase/migrations/20260802090000_create_kb_search_document_contract.sql`

Die additive Tabelle `kb_search_documents` bindet jede Projektion an genau ein
Item eines gueltigen versiegelten Releases. Entity-, Artikel- und
Assertion-Suchtexte werden ausschliesslich aus den in 4A eingefrorenen
Item-Manifesten abgeleitet. Spaetere Alias- oder Kennungsaenderungen schreiben
historische Releases deshalb nicht um.

Die Projektion enthaelt kontrollierte Titel-, Alias-, Kennungs-, Facetten- und
Quellentitel-Felder sowie explizite deutsche und sprachneutrale PostgreSQL-
Volltextvektoren. Insert ist Owner-only; Update, Delete und Truncate sind
gesperrt. Ein kanonischer SHA-256 und `invalid_search_documents` erkennen
Manipulationen auch nach triggerumgehendem Restore.

Es gibt keinen Such-RPC, keinen Backfill und keine produktive Anbindung. Release
v1 bleibt unveraendert `retrieval_eligible = false` und `is_active = false`.
Der gemeinsame Wiki-Snapshot umfasst nun exakt 56 Tabellen; der Therapie-Input-
Snapshot v2 bleibt byteidentisch und exakt vier Tabellen gross.

Die ausfuehrliche Implementierungsdokumentation steht in
`docs/wiki-phase4b-2a-search-document-contract-implementation-2026-08-02.md`.

#### Schritt 4B-2b: Medizinisch inaktiver Laborvertrag

Lokal implementiert in:

`supabase/migrations/20260802100000_create_kb_laboratory_contract.sql`

Die drei additiven Tabellen `kb_lab_parameter_revision_details`,
`kb_lab_reference_ranges` und `kb_lab_finding_definition_revision_details`
binden Material, Werteart, kanonische Einheit, exakte Methode, optionales Labor,
Population, Alter, Geschlecht, numerischen oder qualitativen Referenzbereich und
die daraus abgeleitete Bereichsklassifikation an konkrete Revisionen und
quellengebundene Klassifikationsaussagen.

Jeder Parameter- und Befundrevisionshash sowie jeder Referenzbereichshash friert
die vollstaendigen fachlichen Revisions-, Kennungs-, Assertion-, Quellenbindungs-
und Quellenrevisionsfelder ein. Widerspruechliche, aber getrennt belegte Bereiche
bleiben darstellbar. Leere Intervalle, richtungslose Niedrig-/Hochdefinitionen,
unpassende Entitaetstypen, fehlende primaere Fundstellen und Statuskonflikte
werden fail-closed abgelehnt.

Der Block legt keine echten Laborwerte oder Referenzbereiche an, fuehrt keine
Einheitenumrechnung durch und bindet keinen Patienten- oder Retrievalpfad an.
Release v1 bleibt unveraendert inaktiv. Der gemeinsame Wiki-Snapshot umfasst nun
exakt 59 Tabellen und drei neue Pflichtzaehler; der Therapie-Input-Snapshot v2
bleibt byteidentisch und exakt vier Tabellen gross.

Die ausfuehrliche Implementierungsdokumentation steht in
`docs/wiki-phase4b-2b-laboratory-contract-implementation-2026-08-02.md`.

Embeddings sind spaeter optional und duerfen Sicherheitsregeln nicht
ausfiltern.

## Schritt 5: Homoeopathische Repertorisation

### Schritt 5A: Medizinisch inaktiver Repertoriumsvertrag

Lokal implementiert in:

`supabase/migrations/20260802110000_create_kb_homeopathic_repertory_contract.sql`

Der additive Vertrag fuegt genau die kontrollierten Entitaetstypen
`homeopathic_repertory` und `homeopathic_remedy` sowie sechs leere Tabellen
hinzu:

- `kb_homeopathic_repertory_revision_details`
- `kb_homeopathic_rubrics`
- `kb_homeopathic_rubric_revisions`
- `kb_homeopathic_grade_definitions`
- `kb_homeopathic_repertory_remedies`
- `kb_homeopathic_rubric_remedy_assignments`

Jede Repertoriumsrevision bindet ein exaktes Entitaets-/Revisionspaar an ein
exaktes Quellen-/Quellenrevisionspaar, einen quelleneigenen Repertoriumscode,
eine Sprache und eine Fundstelle. Die Quellenrevision muss `own_content`,
`licensed` oder `public_domain` sein; `unknown` und `quoted` werden fail-closed
abgelehnt. Rubriken besitzen eine stabile, innerhalb des
Repertoriums eindeutige Quellencode-Identitaet. Ihre revisionslokalen Texte,
Domaenen, Eltern und Geschwisterpositionen bilden eine lueckenlose azyklische
Hierarchie. Graddefinitionen, Mittelcodes, Quellennamen und Aliasse bleiben
ausschliesslich im Namensraum derselben Repertoriumsrevision.

Die Mittelzuordnung verwendet den neuen potenzneutralen Typ
`homeopathic_remedy`. Sie bindet eine exakte generische Mittelrevision und darf
keine Zeile aus den potenztragenden `kb_homeopathic_revision_details` verwenden.
Potenz, Darreichung und Produktvariante bleiben getrennte Katalogobjekte.

Kanonische SHA-256-Payloads frieren die Repertoriumsrevision, vollstaendige
Quellenrevision, Rubrikstruktur, source-native Grade, source-native
Mittelbezeichnungen, exakte Fundstellen und jede Rubrik-Mittel-Grad-Zuordnung
ein. Fuenf Pflichtzaehler erkennen auch nach Triggerumgehung ungueltige
Repertoriumsrevisionen, Rubriken, Graddefinitionen, Mittelzuordnungen und
Assignments.

Der Block legt keine Repertoriums-, Rubrik-, Grad- oder Mitteldaten an. Er
enthaelt weder Importer noch Repertorisierungs-, Ranking-, Reader- oder
Writer-RPC, keine normalisierte Gradskala, keine Patientenreferenz und keine
Anbindung an den Therapiepfad. Release v1 bleibt unveraendert
`retrieval_eligible = false` und `is_active = false`.

Der gemeinsame Wiki-Snapshot umfasst nun exakt 65 Tabellen. Der
Therapie-Eingabe-Snapshot v2 bleibt byteidentisch und umfasst weiterhin exakt
vier Tabellen. Die ausfuehrliche Implementierungsdokumentation steht in
`docs/wiki-step5a-homeopathic-repertory-contract-implementation-2026-08-02.md`.

### Schritt 5B: Lizenzierter Inhalt und deterministische Repertorisation

Materia-medica-Aussagen, Leitsymptome, Modalitaeten und Beziehungen koennen
zunaechst ueber Entitaeten, Artikel, Aussagen und kontrollierte Relationen
erfasst werden. Eine echte deterministische Repertorisation benoetigt weiterhin
eine lizenzierte, gepruefte und exakt versionierte Repertoriumsquelle sowie
einen separat abgenommenen Import- und Readervertrag.

Grade verschiedener Repertorien werden niemals still zusammengefuehrt. Ohne
lizenzierte Daten liefert ein spaeterer neuer Pfad
`HOMEOPATHIC_LANE_UNAVAILABLE`; eine KI darf keine Rubriken oder Grade erfinden.

#### Schritt 5B-1: Medizinisch inaktiver Einzelrepertorium-Reader

Lokal implementiert in:

`supabase/migrations/20260803100000_create_kb_homeopathic_reader_contract.sql`

Der additive, reine Funktionsvertrag liest ausschliesslich genau eine
vollstaendig gueltige, mindestens freigegebene Repertoriumsrevision mit
ausreichendem Quellenrecht. Ohne diesen Bestand liefert er geschlossen
`HOMEOPATHIC_LANE_UNAVAILABLE`. Eine Anfrage bindet 1 bis 256 eindeutige
Rubrikrevisionen desselben Repertoriums, ganzzahlige Wichtigkeit 1 bis 5 und die
Polaritaet `include` oder `exclude`.

Das Ergebnis trennt Rubrik-, Wichtigkeits- und Domaenenabdeckung,
Ausschlusskonflikte sowie das vollstaendige source-native Gradprofil. Jede
Fundstelle und jeder Rubrik-, Grad-, Mittel- und Assignmenthash bleibt sichtbar.
Es gibt keinen undurchsichtigen Gesamtscore, keine Umrechnung zwischen
Repertorien und keine Wirksamkeits-, Sicherheits- oder Dosierungsaussage.
Permutierte Eingaben erzeugen dasselbe kanonische Manifest und denselben
Ergebnishash.

Alle vier Readerfunktionen sind fuer Anwendungs-, Service- und Importrollen
widerrufen. Es gibt keinen Runtime-Grant, keine Tabelle, keine Patientendaten,
keinen Seed und keine Release-Aktivierung. Der 65-Tabellen-Wiki-Snapshot und der
Vier-Tabellen-Therapie-Input-Snapshot bleiben byteidentisch. Der fokussierte
PGlite-Test verwendet ausschliesslich synthetische, nichtmedizinische Daten und
bestand mit 5/5 Tests. Die ausfuehrliche Dokumentation steht in
`docs/wiki-step5b1-homeopathic-reader-contract-implementation-2026-08-03.md`.
Der vollstaendige Projektlauf bestand mit 46/46 Dateien und 501/501 Tests;
beide TypeScript-Projekte und der Produktionsbuild sind ebenfalls erfolgreich.

Echter Inhalt und ein Bulk-Importvertrag bleiben bis zur konkreten
Lizenzfreigabe, Quellenabnahme und PostgreSQL-Grossmengenprofilierung blockiert.

#### Schritt 5B-2: Medizinisch inaktiver Importvorpruefvertrag

Lokal implementiert in:

`supabase/migrations/20260803110000_create_kb_homeopathic_import_preflight_contract.sql`

Der reine Funktionsvertrag bildet fuer genau eine vollstaendig gueltige,
owner-seitig geladene Repertoriumsrevision ein kompaktes kanonisches Manifest.
Es enthaelt den exakten Repertoriums- und Quellenstand, getrennte Zeilenzahlen
fuer Rubriken, source-native Grade, Mittel und Assignments sowie vier stabil
geordnete Komponentenhashes. Der daraus gebildete Bundle-Hash bleibt bei einem
reinen Reviewstatuswechsel unveraendert.

Eine Importvorpruefung vergleicht einen vor dem Laden festgelegten erwarteten
Bundle-Hash und exakt vier positive Zaehler mit dem gespeicherten Stand. Sie
unterscheidet ungueltige Erwartungen, fehlende oder semantisch ungueltige
Bundles, Hash-/Zaehlerabweichungen und einen exakten Integritaetstreffer. Der
Trefferstatus `HOMEOPATHIC_IMPORT_BUNDLE_READY` ist ausdruecklich keine
Import-, Release-, Wirksamkeits- oder Therapiefreigabe.

Der Block schreibt keine Daten, erzeugt keine Tabelle und vergibt keine Rechte
an Anwendung, Service- oder Importrollen. Wiki- und Therapie-Input-Snapshot
bleiben byteidentisch. Der fokussierte PGlite-Test verwendet nur synthetische,
nichtmedizinische Daten und bestand mit 6/6 Tests. Die ausfuehrliche
Dokumentation steht in
`docs/wiki-step5b2-homeopathic-import-preflight-contract-implementation-2026-08-03.md`.
Auch ein gueltiges, noch keiner Rubrik zugeordnetes Mittel wird durch Zaehler und
Komponentenhash gebunden. Die zusammenhaengende Repertoriumsregression bestand
mit 22/22 Tests, der vollstaendige Projektlauf mit 47/47 Dateien und 507/507
Tests. Beide TypeScript-Projekte und der Produktionsbuild sind erfolgreich.

Ein quellenspezifischer Rohdaten- und Zeilenhashvertrag, ein owner-only
Chunk-/Bulk-Writer, Resume- und Rollbacksemantik sowie die
PostgreSQL-Grossmengenprofilierung bleiben vor jedem echten Repertoriumsimport
separat abzunehmen.

#### Schritt 5B-3: Parserseitiger Bundle-Hashvertrag

Lokal implementiert in:

`src/lib/homeopathicImportBundle.ts`

Die reine TypeScript-Referenz akzeptiert nur einen streng versionierten,
medizinisch inaktiven Umschlag aus kanonischen UUIDs, Repertoriums- und
Quellenmetadaten sowie bereits semantisch gebildeten Zeilenhashes. Sie prueft
exakte Felder, UTF-8-Grenzen, eindeutige Identitaeten und alle
Assignment-Verweise, sortiert die vier Komponenten stabil und bildet deren
SHA-256 ohne Mutation der Parserdaten.

Die PostgreSQL-`jsonb`-Textdarstellung wird bytegenau und unabhaengig von
JavaScript-Objektreihenfolge oder Gebietsschema nachgebildet. Ein PGlite-
Kreuztest bestaetigt fuer dasselbe synthetische Bundle ein identisches Manifest
und einen identischen Bundle-Hash auf Parser- und Datenbankseite, einschliesslich
Fundstellen mit Anfuehrungszeichen und Zeilenumbruch. Der fokussierte Lauf
bestand mit 2/2 Dateien und 9/9 Tests. Die zusammenhaengende
Repertoriumsregression bestand mit 25/25 Tests, der vollstaendige Projektlauf mit
48/48 Dateien und 510/510 Tests. Beide TypeScript-Projekte und der
Produktionsbuild sind erfolgreich.

Der Block ist kein Rohdatenparser und bildet keine medizinischen Zeilenhashes.
Lizenzierte Gold-Fixtures, der quellenspezifische Parser, ein owner-only
Chunk-/Bulk-Writer sowie Resume-, Rollback- und Grossmengenabnahme bleiben offen.
Die ausfuehrliche Dokumentation steht in
`docs/wiki-step5b3-homeopathic-parser-bundle-contract-implementation-2026-08-03.md`.

#### Schritt 5B-4: Parserseitiger Zeilenhashvertrag

Lokal implementiert in:

`src/lib/homeopathicImportRowHashes.ts`

Fuenf geschlossene Payload-Schemata bilden Repertoriums-, Rubrik-, Grad-,
Repertoriumsmittel- und Assignmenthash bytegleich zu den vorhandenen
PostgreSQL-Funktionen. Kontrollierte IDs, Hashes, Rechte, Urspruenge,
UTF-8-Grenzen, Elternfelder und alle verschachtelten Repertoriums- und
Unterhashbindungen werden vor der Hashbildung fail-closed geprueft.

Der PGlite-Kreuzlauf vergleicht Parser-, Datenbank- und gespeicherten Hash fuer
alle sieben synthetischen Zeileninstanzen des Testbuendels, einschliesslich
UTF-8, Nullwerten, Arrays, Anfuehrungszeichen und Zeilenumbruch. Der fokussierte
Lauf bestand mit 2/2 Dateien und 10/10 Tests.
Die zusammenhaengende Repertoriumsregression bestand mit 29/29 Tests, der
vollstaendige Projektlauf mit 49/49 Dateien und 514/514 Tests. Beide
TypeScript-Projekte und der Produktionsbuild sind erfolgreich.

Quelleninhaltshash, Metadatenhashes und generischer Mittelrevisionshash bleiben
bewusste Eingaben. Konkrete Lizenzquelle, Rohdatenparser, Gold-Fixtures,
owner-only Writer sowie Resume-, Rollback- und Grossmengenabnahme sind weiterhin
offen. Die ausfuehrliche Dokumentation steht in
`docs/wiki-step5b4-homeopathic-row-hash-contract-implementation-2026-08-03.md`.

#### Schritt 5B-5: Owner-only atomarer Kleinmengen-Referenzwriter

Lokal implementiert in:

`supabase/migrations/20260803120000_create_kb_homeopathic_small_bundle_writer.sql`

`kb_homeopathic_write_small_bundle_v1(jsonb)` akzeptiert nur einen exakt
versionierten, medizinisch inaktiven und maximal 4 MiB grossen Umschlag mit
bereits parserseitig gebildeten Zeilen- und Bundlehashes. Der Referenzpfad ist
auf 256 Rubriken, 64 Grade, 256 Mittel und 2.048 Assignments begrenzt. Quelle,
Repertoriumsrevision und generische Mittelrevisionen werden nicht erzeugt,
sondern muessen owner-gesteuert als gueltige Abhaengigkeiten vorliegen.

Beim Erstlauf schreibt die Funktion die sechs vorhandenen Step-5A-Tabellen in
einem Statementkontext. Danach vergleicht sie jede gespeicherte Spalte, prueft
alle fuenf Hashtypen, die vollstaendige Repertoriumssemantik und zuletzt den
Step-5B-2-Preflight. Jede Exception rollt alle Aenderungen des Aufrufs zurueck.
Der synthetische PGlite-Test belegt dies mit einem absichtlich falschen
Assignmenthash innerhalb eines Savepoints; alle Tabellen und der vorherige
Repertoriumshash bleiben dabei unveraendert.

Bei vorhandener Repertoriumsbindung schreibt die Funktion nichts erneut. Ein
exakt identisches Buendel liefert denselben Resultathash, auch nachdem die
Revisionen spaeter freigegeben und eingefroren wurden. Eine abweichende
Wiederholung scheitert vor jeder Aenderung. Der Writer ist `SECURITY INVOKER`,
prueft den Tabellenowner und bleibt fuer Anwendung, Service- und Importrollen
vollstaendig widerrufen. Wiki- und Therapie-Input-Snapshot bleiben durch die
Installation byteidentisch.

Der fokussierte Writer-/Preflightlauf bestand mit 10/10 Tests. Die
zusammenhaengende Repertoriumsregression bestand mit 32/32 Tests, der
vollstaendige Projektlauf mit 49/49 Dateien und 517/517 Tests. Beide
TypeScript-Projekte und der Produktionsbuild sind erfolgreich. Die
ausfuehrliche Dokumentation steht in
`docs/wiki-step5b5-homeopathic-small-bundle-writer-implementation-2026-08-03.md`.

Der Block ist weiterhin kein Rohdatenparser und kein Chunk-/Bulk-Importer.
Lizenzquelle, Gold-Fixtures, Batch-/Resume-Semantik und
PostgreSQL-Grossmengenprofilierung bleiben vor echten Repertoriumsdaten offen.

#### Schritt 5B-6: Owner-only persistentes Chunk-Staging und Resume

Lokal implementiert in:

`supabase/migrations/20260803130000_create_kb_homeopathic_chunk_import_contract.sql`

Ein Batch bindet eine explizite UUID, das exakte Repertoriums-/Revisionspaar,
den erwarteten Bundlehash, vier Gesamtzaehler und 1 bis 64 geordnete,
eindeutige Chunkhashes. Die Chunks sind auf je 1 MiB begrenzt, werden
vollstaendig gegen die Step-5B-5-Zeilenformen geprueft und nach dem Insert
unveraenderlich. Kumulative Payloadbytes sind konservativ auf 4.000.000 und
jeder Komponentenzaehler auf seine Batcherwartung begrenzt. Die Chunks duerfen
in beliebiger Reihenfolge eintreffen; der
deterministische Status nennt die fehlenden Indizes und aktuellen Zaehler.
Identische Wiederholungen schreiben nichts erneut, abweichende scheitern.

Nur ein offener oder geschriebener Batch darf ein Repertoriums-Revisionspaar
binden. Ein falscher offener Versuch kann owner-seitig terminal abgebrochen
werden, waehrend seine Chunks als Audit erhalten bleiben und eine neue Batch-ID
das Ziel uebernehmen darf. Erst ein vollstaendiger Batch wird ueber den atomaren
Step-5B-5-Writer finalisiert. Ein absichtlich falscher Gesamt-Hash laesst alle
sechs Zieltabellen und den Repertoriumshash unveraendert; nach Erfolg liefert eine
exakte Wiederholung denselben Resultathash.

Die zwei neuen, RLS-geschuetzten Tabellen und alle Vertragsfunktionen bleiben
fuer Anwendung, Service- und Importrollen vollstaendig gesperrt. Der Wiki-
Snapshot und die Restore-Reihenfolge umfassen nun exakt 67 Tabellen; der neue
Integritaetszaehler `invalid_homeopathic_chunk_imports` bleibt 0. Der Therapie-
Eingabe-Snapshot v2 bleibt byteidentisch. Der fokussierte Writer-/Chunk-/
Preflightlauf bestand mit 15/15 Tests, zusammen mit den Sicherungsvertraegen
3/3 Dateien und 67/67 Tests. Die zusammenhaengende Repertoriumsregression
bestand mit 37/37 Tests, der vollstaendige Projektlauf mit 49/49 Dateien und
523/523 Tests. Beide TypeScript-Projekte, der gezielte ESLint-Lauf und der
Produktionsbuild sind erfolgreich. Die ausfuehrliche Dokumentation steht in
`docs/wiki-step5b6-homeopathic-chunk-import-contract-implementation-2026-08-03.md`.

Der Block erbt bewusst die Step-5B-5-Gesamtgrenze von 4 MiB, 256 Rubriken, 64
Graden, 256 Mitteln und 2.048 Assignments. Er ist deshalb ein persistenter
Resume- und Rollbackbeweis, aber noch kein produktiver Bulk-Importer. Konkrete
Lizenzquelle, Rohdatenparser, Gold-Fixtures, echte PostgreSQL-
Grossmengenprofilierung sowie Restore-, RLS- und Fachabnahme bleiben offen.

## Schritt 6: Deterministisches Retrieval v2

Neuer Schattenpfad statt Umbau des sichtbaren v1:

1. unveraenderliche Patienteneingaberevision laden
2. nur verifizierte oder gezielt als Review markierte Fakten verwenden
3. genau ein unveraenderliches Knowledge-Release fixieren
4. Entitaeten ueber Kennung, Alias, Namen, Volltext und begrenzte Graphkanten
   aufloesen
5. konventionelle/naturheilkundliche und homoeopathische Suchspur getrennt
   berechnen
6. Sicherheitsregeln vor jeder KI anwenden
7. Kandidaten mehrdimensional und deterministisch ordnen
8. erlaubte, pruefpflichtige und ausgeschlossene Kandidaten mitsamt Gruenden
   speichern
9. KI nur zur Formulierung der gespeicherten Ergebnisse einsetzen
10. KI-Ausgabe serverseitig validieren und Sicherheit erneut pruefen

### Schritt 6A: Medizinisch inaktiver Eingabe-/Release-Preflight

Lokal implementiert in:

`supabase/migrations/20260804090000_create_therapy_retrieval_v2_preflight.sql`

Der additive Block erzeugt vier geschlossene Lesefunktionen und keine Tabelle.
Er bindet genau eine gueltige Therapie-Eingaberevision an ein genaues
Eingabemanifest. Ausgewaehlt werden ausschliesslich terminale Fakten mit
`verified` oder `review_only`; supersedierte, unreviewte und abgelehnte Fakten
werden nicht verwendet. Alle Fakten muessen dennoch ihren vollstaendigen
Integritaetsvalidator bestehen; verwaiste Fakten-Quellenbindungen sperren die
gesamte Revision. Ein kompletter Faktensethash bindet auch die nicht
ausgewaehlten Zeilen, waehrend die Manifestliste keine Rohwerte, Labels,
Quellenpayloads oder Pseudonyme ausgibt.

Der Preflight bindet dieses Eingabemanifest an genau ein versiegeltes, mit
`kb_release_is_valid(id, true)` validiertes Knowledge-Release und vergleicht
beide vorab erwarteten SHA-256-Werte getrennt. Bindungs- und Resultathash sind
kanonisch und deterministisch. Ein `review_only`-Fakt bleibt als ausdrueckliche
Reviewpflicht sichtbar.

Auch der positive Status heisst bewusst
`RETRIEVAL_V2_PREFLIGHT_BOUND_INACTIVE`. Jede Antwort traegt
`medical_use_allowed = false`, `retrieval_execution_allowed = false` und die
Interpretation `PREFLIGHT_ONLY_NOT_RETRIEVAL_OR_MEDICAL_USE`. Release v1 bleibt
hart `retrieval_eligible = false` und `is_active = false`; 6A prueft beide Flags
bei jedem Aufruf nochmals explizit. Es gibt weder Entitaetsaufloesung noch
Sicherheit, Kandidaten, Ranking, Dosierung, KI, Persistenz oder Anbindung an den
sichtbaren v1-Pfad.

Wiki- und Therapie-Eingabe-Snapshot bleiben byteidentisch bei 67
beziehungsweise vier Tabellen. Alle Funktionen sind fuer Anwendungs-, Service-
und Importrollen gesperrt. Der fokussierte synthetische PGlite-Lauf besteht mit
6/6 Tests, die zusammenhaengende Eingabe-/Release-Regression mit 61/61 Tests und
der vollstaendige Projektlauf mit 50/50 Dateien und 529/529 Tests. Beide
TypeScript-Projekte, der gezielte ESLint-Lauf und der Produktionsbuild sind
erfolgreich. Die unabhaengige Abschlussreview meldet nach expliziter
Inaktivitaetshaertung keine verbleibenden P0/P1-Befunde. Die ausfuehrliche
Dokumentation steht in
`docs/wiki-step6a-therapy-retrieval-v2-preflight-implementation-2026-08-04.md`.

### Schritt 6B: Releasegebundener Entity-Resolution-Preflight

Lokal implementiert in:

`supabase/migrations/20260804100000_create_therapy_entity_resolution_preflight.sql`

Der additive Block erzeugt drei weitere geschlossene Owner-Lesefunktionen und
keine Tabelle. Aus den in 6A gebundenen terminalen Fakten entsteht ein
kanonisches Suchmanifest mit begrenzten normalisierten Labels, Textwerten,
Codeanzeigen und Codes. Strukturierte globale Kennungen werden qualifiziert und
unqualifiziert, lokale `program_code`-Werte mangels Namespace ausschliesslich
unqualifiziert gesucht. Uebergrosse Werte werden nicht abgeschnitten.

Vor jeder Aufloesung muss fuer jedes Entity-Item des exakt gebundenen Releases
eine vollstaendig gueltige `kb_search_documents`-Projektion existieren. Ein
expliziter `kb_entity_id` im Patientenfakt muss selbst im Release liegen und
kann nicht durch einen Texttreffer ersetzt werden.

Ein vor dem 6A-Bindungsvalidator liegender begrenzter Scan erlaubt in diesem
Referenzvertrag hoechstens 4.096 Release-Items. Die Projektionspruefung bricht
danach stufenweise bei mehr als 1.024 Entity-Items oder 2.048
Relationsassertions ab. Dadurch bleiben auch breite Treffer und Graphkanten vor
der Ergebnisbegrenzung ressourcenseitig endlich; groessere Releases scheitern
geschlossen statt teilweise zu laufen.

Direkte Treffer verwenden die feste Reihenfolge exakter KB-Link, qualifizierte
Kennung, unqualifizierte Kennung, normalisierter Titel, Alias, kanonischer
Schluessel, deutscher Volltext und sprachneutraler Volltext. Die Abfragen sind
kanalweise auf die bestehenden B-Tree-/GIN-Indizes ausgerichtet; Rohtext wird
nur ueber `plainto_tsquery` verarbeitet. Es gibt keinen Relevanz- oder
Gesamtscore.

Von limitierten direkten Treffern wird hoechstens eine im Release versiegelte
Graphkante in beide Richtungen verfolgt. Relation, Richtung, Assertion und
exakte Nachbarrevision bleiben sichtbar. Der Status
`GRAPH_EDGE_MATCH_ONLY_NOT_RECOMMENDATION` verhindert eine Umdeutung der Kante
in Eignung oder Empfehlung.

Jede Antwort bleibt medizinisch und operativ inaktiv. Wiki- und
Therapie-Eingabe-Snapshot bleiben byteidentisch bei 67 beziehungsweise vier
Tabellen; alle Funktionen sind fuer Anwendungs-, Service- und Importrollen
gesperrt. Der fokussierte gemeinsame Schritt-6A-/6B-Lauf besteht mit 11/11
Tests, die zusammenhaengende Eingabe-, Release- und Suchregression mit 75/75
Tests und der vollstaendige Projektlauf mit 50/50 Dateien und 534/534 Tests.
Beide TypeScript-Projekte, der gezielte ESLint-Lauf und der Produktionsbuild
sind erfolgreich. Nach Ressourcenhaertung fuer vorgezogene und sofort
abbrechende Mengengrenzen sowie einer auf reine Lesezugriffe verengten
Suchvertragsausnahme meldet die unabhaengige Abschlussreview keine verbleibenden
P0/P1-Befunde. Die ausfuehrliche Dokumentation steht in
`docs/wiki-step6b-entity-resolution-preflight-implementation-2026-08-04.md`.

### Schritt 6C: Medizinisch inaktiver Split-Track-Preflight

Lokal implementiert in:

`supabase/migrations/20260804110000_create_therapy_split_track_preflight.sql`

Der additive Block erzeugt drei weitere geschlossene Owner-Lesefunktionen und
keine Tabelle. Allgemeine beziehungsweise naturheilkundliche 6B-Referenzen und
source-native homoeopathische Step-5B-1-Repertoriumstreffer bleiben in getrennten
Teilresultaten mit getrennten Hashes. Beide Spuren sind reine Matchprovenienz;
Kandidateneignung, Sicherheit, Wirksamkeit, Dosierung und Empfehlung bleiben
ausdruecklich unbewertet.

Jede homoeopathische Rubrik wird kanonisch an genau einen in 6A ausgewaehlten
`verified`- oder `review_only`-Fakt samt Fakteninhaltshash und 6B-Queryhash
gebunden. Repertorium, Quellenrevision und alle Repertoriumsmittel muessen als
exakte Revisionen im selben, weiterhin inaktiven Knowledge-Release liegen.

Vorgezogene und stufenweise abbrechende Scans begrenzen den Referenzvertrag auf
256 Rubrikrevisionen, 64 Graddefinitionen, 256 Mittel und 2.048 Zuordnungen,
bevor der vollstaendige Repertoriumsvalidator oder Reader laeuft. Groessere oder
unvollstaendige Bereiche scheitern geschlossen ohne Teilergebnis.

Die allgemeine Spur erfordert bei Graphreferenzen sowohl eine allgemeine Quelle
als auch ein allgemeines Ziel. Eine homoeopathische Quelle mit allgemein
aussehendem Nachbarziel bleibt damit ebenso vollstaendig ausgeschlossen wie ein
homoeopathisches Ziel. Produktfamilien ohne exakte Variante bleiben
unaufgeloest. Die homoeopathische Spur stammt ausschliesslich aus genau einem
source-nativen Repertorium; null Treffer bleiben sichtbar und werden nicht durch
allgemeine Ergebnisse ersetzt.

Jede Antwort bleibt medizinisch und operativ inaktiv. Wiki- und
Therapie-Eingabe-Snapshot bleiben byteidentisch bei 67 beziehungsweise vier
Tabellen; alle Funktionen sind fuer Anwendungs-, Service- und Importrollen
gesperrt. Der fokussierte gemeinsame Schritt-6A-bis-6C-Lauf besteht mit 16/16
Tests, die zusammenhaengende Eingabe-, Release-, Such- und
Repertoriumsregression mit 96/96 Tests und der vollstaendige Projektlauf mit
50/50 Dateien und 539/539 Tests. Beide TypeScript-Projekte, der gezielte
ESLint-Lauf und der Produktionsbuild sind erfolgreich. Nach der beidseitigen
Graphklassifikation und einer auf reine Lesezugriffe begrenzten
Repertoriums-Isolationsausnahme meldet die unabhaengige Gegenpruefung keine
verbleibenden P0/P1-Befunde. Die ausfuehrliche Dokumentation steht in
`docs/wiki-step6c-split-track-preflight-implementation-2026-08-04.md`.

### Schritt 6D: Medizinisch inaktiver Safety-Gate-Preflight

Lokal implementiert in:

`supabase/migrations/20260804120000_create_therapy_safety_gate_preflight.sql`

Der additive Block erzeugt drei weitere geschlossene Owner-Lesefunktionen und
keine Tabelle. Er bindet den vollstaendigen 6C-Resultathash an ein separates
Safety-Eingabemanifest und eine release-geschlossene Auswertung aller
freigegebenen Safety-Regeln fuer jede exakte `preparation`- oder
`product_variant`-Revision des Releases.

Aktive, nicht negierte Red-Flag-Fakten mit Status `current` oder `unknown`
erzeugen ausschliesslich `ESCALATE_ONLY`; nachgeordnete Regeln koennen diese
Sperre nicht abschwaechen. Der Medikamentenstatus muss als einzelner,
verifizierter, bestaetigter aktueller `medication.status`-Fakt mit kontrolliertem
`local_v1`-Code `complete` oder `none_reported` vorliegen. Fehlende,
widerspruechliche, unklare oder unaufgeloeste Medikation sowie jeder andere
`review_only`-Fakt erzwingen Review. Eine explizit releasefremde Entity wird
bereits durch die vorgelagerte 6B-/6C-Bindung vollstaendig gesperrt.

Vorgezogene Scans begrenzen den Vertrag auf 512 exakte therapeutische Subjects,
2.048 Safety-Regeln und 8.192 Bedingungen. Jedes Subject benoetigt mindestens
eine Safety-Regel. Saemtliche global freigegebenen Safety-Regeln eines
Release-Subjects muessen gemeinsam enthalten sein; Cherry-Picking bleibt auch
dann gesperrt, wenn das darunterliegende Release-v1-Manifest noch formal
gueltig waere. Subject, Related- und Condition-Entity-Revisionen sowie alle
Assertion-Quellen muessen als exakte Items desselben Releases vorliegen.

Die sechs 4B-1-Bedingungsarten werden als geordnete AND-Menge ausgewertet.
Interaktionen verlangen zusaetzlich implizit die Related-Entity in einem aktiven
ausgewaehlten Fakt. Coded- und Quantity-Mehrdeutigkeiten werden nicht
priorisiert, sondern reviewpflichtig. Quantity-Vergleiche erlauben nur einen
exakten Gleichheitsmesswert mit identischer Einheit und fuehren keine
Einheitenumrechnung durch.

Je Subject koennen Safety-Effekte `EXCLUDE`, `REVIEW_ONLY`, `NOTICE_ONLY` oder
`NO_MATCHING_RULE_INACTIVE` entstehen. Es gibt bewusst kein `ALLOW`.
Selbst `SAFETY_GATE_PREFLIGHT_COMPLETE_INACTIVE` setzt
`medical_use_allowed`, `retrieval_execution_allowed`,
`candidate_formation_allowed` und `candidate_status_assignment_allowed` auf
`false`. Wiki- und Therapie-Eingabe-Snapshot bleiben byteidentisch bei 67
beziehungsweise vier Tabellen; alle Funktionen bleiben fuer Anwendungs-,
Service- und Importrollen gesperrt.

Der fokussierte Schritt-6A-bis-6D-Vertrag besteht in zwei laufzeitbegrenzten
Gruppen mit zusammen 22/22 Tests. Die zusammenhaengende Eingabe-, Release-,
Regel-, Such- und Repertoriumsregression besteht mit 7/7 Dateien und 109/109
Tests, der vollstaendige Projektlauf mit 50/50 Dateien und 545/545 Tests. Beide
TypeScript-Projekte, gezieltes ESLint und Produktionsbuild sind erfolgreich.
Nach der fail-closed Haertung von unsicherem Medikamentenstatus und
SQL-`NULL`-Semantik meldet die unabhaengige Gegenpruefung `APPROVE` ohne
verbleibenden P0/P1-Befund.
Die ausfuehrliche Dokumentation steht in
`docs/wiki-step6d-safety-gate-preflight-implementation-2026-08-04.md`.

### Schritt 6E: Medizinisch inaktiver Kandidatenstatus-Preflight

Lokal implementiert in:

`supabase/migrations/20260804130000_create_therapy_candidate_status_preflight.sql`

Der additive Block erzeugt drei weitere geschlossene Owner-Lesefunktionen und
keine Tabelle. Er verlangt den exakten 6D-Resultathash, berechnet Safety-Gate und
6C-Split-Track erneut und bildet erst danach zwei weiterhin getrennte,
medizinisch inaktive Kandidatenspuren. Red-Flag-`ESCALATE_ONLY` und
Medikamenten-`REVIEW_ONLY` werden vor einer veralteten Safety-Hasherwartung
ausgegeben, damit Aufruferdrift keine neu erkannte Sperre verbergen kann.

Die allgemeine beziehungsweise naturheilkundliche Spur uebernimmt nur exakte
`preparation`-/`product_variant`-Revisionen. `EXCLUDE` stammt unveraendert aus
6D und ist nicht aufhebbar. Ein inaktives `ALLOW` benoetigt mindestens einen
aktuellen, nicht negierten, bestaetigten und verifizierten Fakt sowie eine
freigegebene, releasegebundene `indicated_for`-/`may_support`-Assertion mit
direkter oder indirekter Zuordnung und bewerteter Grundlage und Qualitaet.
Unsichere, historische, negierte oder nur pruefpflichtige Faktentreffer,
fehlender starker Support, `not_recommended` oder ein reviewpflichtiger
Safety-Effekt erzeugen `REVIEW_ONLY`. Nur die bekannten nicht blockierenden
Effekte `NOTICE_ONLY` und `NO_MATCHING_RULE_INACTIVE` koennen bei vollstaendigen
uebrigen Bedingungen `ALLOW` erreichen; unbekannte Effekte scheitern
geschlossen als `REVIEW_ONLY`.

Die homoeopathische Spur behaelt Rubrikabdeckung, source-natives Gradprofil,
Domaenenabdeckung, negative Konflikte und stabile Repertoriumsposition getrennt.
Da die generische Mittelrevision noch keine exakte Zubereitungs-, Potenz- und
Subject-Safety-Bindung besitzt, bleibt jeder Treffer zwingend `REVIEW_ONLY`.
Materia-medica-Uebereinstimmung und Praxiserfahrung werden sichtbar als noch
nicht bewertet markiert und nicht erfunden.

Allgemeine Faktenabdeckung, Referenzpraezision, Relationssupport,
Evidenzgrundlagen, Evidenzqualitaet, Praxiserfahrung,
Quellenaktualitaet/-spezifitaet sowie Praeferenz/Budget bleiben getrennte
Dimensionen. Es gibt keinen undurchsichtigen Gesamtscore und keine Vermischung
beider Spuren. Praeferenz und Budget sind nur nachgelagerter Kontext und aendern
keinen Status.

Alle drei Resultate besitzen getrennte kanonische Hashes; das Gesamtergebnis ist
auf 8 MiB begrenzt. Wiki- und Therapie-Eingabe-Snapshot bleiben byteidentisch
bei 67 beziehungsweise vier Tabellen. Alle Funktionen sind fuer Anwendungs-,
Service- und Importrollen gesperrt; Release v1 bleibt inaktiv. Der fokussierte
Schritt-6A-bis-6E-Vertrag besteht mit 29/29 Tests, die zusammenhaengende
Eingabe-, Release-, Regel-, Such- und Repertoriumsregression mit 7/7 Dateien und
116/116 Tests und der vollstaendige Projektlauf mit 50/50 Dateien und 552/552
Tests. Beide TypeScript-Projekte, gezieltes ESLint und Produktionsbuild sind
erfolgreich. Nach der Fail-Closed-Haertung unbekannter Safety-Effekte und der
vollstaendigen Tie-Break-Reihenfolge der Referenzprovenienz meldet die
unabhaengige Gegenpruefung `APPROVE` ohne verbleibenden P0/P1-Befund. Die
ausfuehrliche Dokumentation steht in
`docs/wiki-step6e-candidate-status-preflight-implementation-2026-08-04.md`.

### Schritt 6F: Medizinisch inaktiver Dosierungsregel-Preflight

Lokal implementiert in:

`supabase/migrations/20260804140000_create_therapy_dosage_rule_preflight.sql`

Der additive Block erzeugt drei weitere geschlossene Owner-Lesefunktionen und
keine Tabelle. Er verlangt den exakten 6E-Resultathash und uebernimmt
ausschliesslich allgemeine `ALLOW`-Kandidaten mit exakter `preparation`- oder
`product_variant`-Revision. `EXCLUDE`, `REVIEW_ONLY`, `ESCALATE_ONLY`, fremde
oder fehlende Entitaetstypen und saemtliche homoeopathischen Kandidaten bleiben
technisch ausgeschlossen.

Fuer jedes zulaessige Subject muessen alle global freigegebenen
Dosierungsregeln gemeinsam im gebundenen Release liegen. Regel, Assertion,
Subject, optionale Indikation und Population sowie jede Quellenrevision werden
exakt und hashgebunden geprueft. Fehlende, triggerumgehend entfernte,
releasefremde oder semantisch ungueltige Regeln machen den Scope unverfuegbar.

Optionale Indikations- und Populationsbindungen gelten nur bei einem
ausgewaehlten, aktuellen, nicht negierten, bestaetigten und verifizierten Fakt
mit exakter `kb_entity_id` als erfuellt. Null passende Regeln blockieren; mehr
als eine passende Regel erzwingt Review. Nur genau eine passende Regel erzeugt
den weiterhin inaktiven Status `EXACT_DOSAGE_RULE_BINDING_READY_INACTIVE`.

6F gibt ausschliesslich Regelidentitaeten, Inhalts-Hashes und exakte
Anwendbarkeitsprovenienz aus. Dosis, Einheit, Frequenz, Dauer, Timing und Route
werden nicht projiziert. Freie Quellenfundstellen erscheinen nur als kanonische
Hashes. Medizinische Nutzung, produktive Kandidatennutzung, Dosierungsauswertung,
Dosierungsanzeige und KI bleiben in jedem Status `false`.

Vorgezogene Scans begrenzen den Vertrag auf 4.096 Dosierungsassertions, 4.096
Dosierungsregeln, 16.384 zugehoerige Quellenbindungen, 2.048 Kandidatenregeln
und 8.192 Quellenbindungen dieser Kandidatenregeln. Das Gesamtergebnis bleibt
auf 8 MiB begrenzt. Scope, Bewertungen und Resultat besitzen getrennte
kanonische Hashes.

Wiki- und Therapie-Eingabe-Snapshot bleiben byteidentisch bei 67 beziehungsweise
vier Tabellen. Alle Funktionen sind fuer Anwendungs-, Service- und Importrollen
gesperrt; Release v1 bleibt inaktiv. Der fokussierte Schritt-6A-bis-6F-Vertrag
besteht mit 40/40 Tests, die zusammenhaengende Eingabe-, Release-, Regel-, Such-
und Repertoriumsregression mit 7/7 Dateien und 127/127 Tests und der
vollstaendige Projektlauf mit 50/50 Dateien und 563/563 Tests. Beide
TypeScript-Projekte, gezieltes ESLint, Secret-Policy und Produktionsbuild sind
erfolgreich. Nach der fail-closed Typpruefung und dem Ersatz freier Fundstellen
durch kanonische Hashes meldet die unabhaengige Gegenpruefung `APPROVE` ohne
verbleibenden P0/P1-Befund. Die ausfuehrliche Dokumentation steht in
`docs/wiki-step6f-dosage-rule-preflight-implementation-2026-08-04.md`.

### Kandidatenstatus

- `ALLOW`
- `REVIEW_ONLY`
- `EXCLUDE`
- `ESCALATE_ONLY`

### Getrennte Bewertungsdimensionen

Keine einzige undurchsichtige Gesamtpunktzahl.

Naturheilkundliche/allgemeine Spur:

- klinische beziehungsweise fachliche Passgenauigkeit
- Abdeckung bestaetigter Patientenfakten
- exakte Zubereitungs- und Produktvariantengenauigkeit
- traditionelle, praktische, Hersteller- und wissenschaftliche Grundlagen
  getrennt sichtbar
- Evidenzqualitaet innerhalb der jeweiligen Grundlage
- gepruefte Praxiserfahrung
- Aktualitaet und Spezifitaet der Quelle
- Praeferenz und Budget erst nach Eignung und Sicherheit
- stabiler kanonischer Tie-Break

Homoeopathische Spur:

- Abdeckung wichtiger Rubriken
- Gradprofil des konkreten Repertoriums
- Domaenenabdeckung
- negative Rubrikkonflikte
- Materia-medica-Uebereinstimmung
- gepruefte Praxiserfahrung
- stabiler kanonischer Tie-Break

Die homoeopathische Uebereinstimmung wird niemals als wissenschaftlicher
Wirksamkeitsscore dargestellt und nicht mit der anderen Spur zu einer Zahl
vermischt.

### Harte Regeln

- Red Flags koennen nur `ESCALATE_ONLY` erzeugen.
- Fehlender oder ungeklaerter Medikamentenstatus erzwingt Review.
- Harte Kontraindikation oder Interaktion erzeugt `EXCLUDE`.
- Fehlende exakte Zubereitung, Potenz oder Produktvariante verhindert Dosierung.
- Fehlende freigegebene Dosierungsregel verhindert Dosierungsanzeige.
- Pins und Produktpraeferenzen koennen nur einen Kandidaten zur Pruefung
  anfordern oder einen bereits geeigneten Gleichstand brechen.
- Manuell ergaenzte Mittel durchlaufen dieselbe serverseitige Pruefung.
- KI, Prompt oder Clientbestaetigung koennen `EXCLUDE` nicht aufheben.

## Schritt 7: Audit und Schattenbetrieb

Geplante Auditbereiche:

- Retrievallauf mit Eingabe-, Release-, Regel- und Comparatorversion
- verwendete Fakten und Quellenfundstellen
- jeder erlaubte, pruefpflichtige und ausgeschlossene Kandidat
- exakte Entitaets-, Revisions-, Aussage- und Quellen-IDs
- Dosierungs- und Sicherheitsentscheidungen
- KI-Modell, Prompt-Hash, Roh- und validierte JSON-Ausgabe
- final von Peter ausgewaehlte Planpositionen

Der neue Pfad laeuft zunaechst unsichtbar neben `therapy-recommend`. Verglichen
werden Abdeckung, Sicherheitsabweichungen, Quellenabdeckung, exakte Varianten,
fehlende Daten, deterministische Replay-Hashes, Laufzeit und Validatorfehler.

Die sichtbare Empfehlung bleibt bis zur fachlichen, technischen,
datenschutzrechtlichen und Restore-Abnahme im bisherigen Pfad.

### Schritt 7A: Medizinisch inaktiver Retrieval-Audit-Envelope-Preflight

Lokal implementiert in:

`supabase/migrations/20260804150000_create_therapy_retrieval_audit_envelope_preflight.sql`

Der additive Block erzeugt genau eine geschlossene Owner-Lesefunktion und keine
Tabelle. Er berechnet Schritt 6F erneut, verlangt dessen exakten Resultathash und
bindet danach ein deterministisches Audit-Envelope fuer Eingabe-, Release-,
Regel-, Comparator-, Fakten-, Quellen- und Kandidatenentscheidungsprovenienz.

Red-Flag-`ESCALATE_ONLY` und Medikamenten-`REVIEW_ONLY` besitzen Vorrang vor
einer veralteten 6F-Erwartung und erzeugen kein Envelope. Ein vollstaendiges
Envelope kann sowohl einen 6F-Erfolg als auch einen fachlich blockierten 6F-
Ausgang auditieren; es macht keinen dieser Ausgaenge medizinisch zulaessig.

Ausgewaehlte Fakten und ihre Eingabequellen werden nur mit Identitaeten,
kontrollierten Schluesseln und Inhalts-Hashes gebunden. Freie Eingabe-, Fakten-
und Wissensquellenfundstellen werden ausschliesslich als kanonische Hashes
ausgegeben. Faktwerte, klinischer Freitext, Quellenpayload, Safety-Notice und
konkrete Dosierungswerte fehlen. Allgemeine und homoeopathische
Comparator-Dimensionen bleiben versioniert und getrennt; es gibt keinen
Gesamtscore.

Safety- und Dosierungsregelentscheidungen enthalten exakte Regel-, Assertion-,
Entity-, Revisions-, Fakten- und Quellenidentitaeten samt getrennten Hashes.
KI-Modell, Prompt, Roh-/validierte KI-Ausgabe und Planpositionen werden nicht
erfunden, sondern explizit als abwesend gebunden.

Eigene Grenzen erlauben hoechstens 2.048 ausgewaehlte Fakten, jeweils 16.384
Faktenquellen- und Safety-Quellenbindungen, 512 allgemeine und 200
homoeopathische Kandidaten, 32.768 normalisierte Wissensquellenverwendungen und
8 MiB Ergebnis. Persistenz, Replayausfuehrung, Schattenlauf, Dosierungsanzeige,
KI, Planwahl, medizinische und produktive Nutzung sowie Aktivierung bleiben in
jedem Status `false`.

Wiki- und Therapie-Eingabe-Snapshot bleiben byteidentisch bei 67 beziehungsweise
vier Tabellen. Die Funktion ist fuer Anwendungs-, Service- und Importrollen
gesperrt; Release v1 bleibt inaktiv. Der fokussierte Schritt-6A-bis-7A-Vertrag
besteht in vier sauberen Gruppen mit 46/46 Tests, die zusammenhaengende
Regression mit 7/7 Dateien und 133/133 Tests und der gruppierte Gesamtstand mit
50/50 Dateien und 569/569 Tests. Beide TypeScript-Projekte, gezieltes ESLint,
Secret-Policy und Produktionsbuild sind erfolgreich. Die unabhaengige
Gegenpruefung meldet `APPROVE` ohne P0/P1-Befund. Die ausfuehrliche
Dokumentation steht in
`docs/wiki-step7a-retrieval-audit-envelope-preflight-implementation-2026-08-04.md`.

### Schritt 7B: Inaktive append-only Retrieval-Audit-Persistenz

Lokal implementiert in:

`supabase/migrations/20260804160000_create_therapy_retrieval_audit_persistence.sql`

Der additive Block persistiert ausschliesslich ein serverseitig erneut
berechnetes, exakt erwartetes positives 7A-Resultat. Ein frei geliefertes
Audit-JSON wird nicht akzeptiert. Die geschlossene Owner-Funktion schreibt
idempotent in `therapy_retrieval_audit_runs`; der 7A-Resultathash ist eindeutig,
und ein zweiter identischer Aufruf gibt dieselbe gueltige Auditzeile zurueck.

Insert-Gate, Update-/Delete-/Truncate-Sperren und ein aufgeschobener
Integritaetstrigger machen die Tabelle append-only. Ein separater kanonischer
Zeilenhash bindet Auditinhalt, Stufenidentitaeten, Persistenzzeitpunkt und
Akteur-ID. Die Validierung reproduziert 7A-, Envelope-, Dosierungsregel- und
Zeilenhash, prueft Eingabe und Release erneut und verlangt weiterhin alle
inaktiven Sperrfelder. Eine manipulierte Zeile erhoeht den fail-closed
Integritaetszaehler.

RLS erlaubt `authenticated` nur als bestaetigtem Admin zu lesen;
`service_role` besitzt nur den fuer Backups erforderlichen Lesezugriff. Keine
Anwendungs-, Service- oder Importrolle darf schreiben oder die Owner-
Persistenzfunktion ausfuehren. Auch die Persistenzantwort setzt medizinische und
produktive Nutzung, Dosierungsauswertung und -anzeige, weitere Persistenz,
Replay, Schattenlauf, KI, Planwahl und Aktivierung explizit auf `false`.

Der bestehende Therapie-Snapshot v2 bleibt byteidentisch. Snapshot v3 nimmt die
Auditzeilen als fuenfte geschuetzte Tabelle mit exaktem JSON-Text, Zeilenzahl,
SHA-256 und `invalid_audit_run_count` auf. Voll- und IAA-/ICD10-Teilbackup,
Frontendvalidator, Edge-Validator und Owner-Restore-Anleitung verwenden den
neuen Fuenf-Tabellen-Vertrag. Ein Restore ist nur in einer einzigen Owner-
Transaktion mit deaktivierten User-Triggern, unveraenderten JSON-Texten,
anschliessender Constraint-/Triggerreaktivierung und exaktem Manifestvergleich
zulaessig.

Es gibt weiterhin kein Deployment, keinen Runtime-RPC, keinen Replay- oder
Schattenlauf, keine KI- oder Planwahl und keine sichtbare Therapieausgabe. Die
fuenf disjunkten Schritt-6A-bis-7B-Gruppen bestehen mit 52/52 Tests, die
zusammenhaengende Regression mit 7/7 Dateien und 139/139 Tests und der
gruppierte Gesamtstand mit 50/50 Dateien und 575/575 Tests. Beide
TypeScript-Projekte, gezieltes ESLint, Secret-Policy und Produktionsbuild sind
erfolgreich. Die strukturierte P0/P1-Gegenpruefung meldet nach Schliessen der
Wiki-Restore-Abhaengigkeit `APPROVE`. Die
ausfuehrliche Dokumentation steht in
`docs/wiki-step7b-retrieval-audit-persistence-implementation-2026-08-04.md`.

### Schritt 7C: Audit-Aufbewahrungs- und Restore-Preflight

Lokal implementiert in:

`supabase/migrations/20260804170000_create_therapy_retrieval_audit_retention_restore_preflight.sql`

Der rein additive Block erzeugt genau eine geschlossene Owner-Lesefunktion und
keine Tabelle oder Schreibschnittstelle. Sie prueft innerhalb der vom Owner
vorgegebenen Zeilen- und Bytegrenzen den vollstaendigen 7B-Auditbestand, die
vier aktivierten
append-only Trigger, die drei deferrable `NO ACTION`-Restore-Fremdschluessel,
RLS, Adminpolicy, minimale Tabellenrechte und den weiterhin geschlossenen
Persistenzwriter.

Der geschuetzte Snapshot v3 wird intern erneut gelesen. Alle fuenf
Tabellenstrings, Zeilenzahlen und SHA-256-Werte sowie die drei Nullzaehler
muessen reproduzierbar sein. Ausgegeben werden nur Auditzeilenzahl,
Snapshotgrenze, ein Hash des gesamten Snapshotmanifests, der Audit-
Inventarhash und technische Boolesche Nachweise; keine Auditzeile und kein
medizinischer Inhalt werden offengelegt.

7C genehmigt keine Aufbewahrungs- oder Loeschregel. Fristbeginn und
Aufbewahrungsjahre bleiben `null`, Rechtsfreigabe und Loeschung bleiben `false`.
Ebenso bleiben der operative Restore-Drill und die Real-PostgreSQL-Pruefung
sichtbar offen. Der positive Status bezeichnet nur einen technisch
vollstaendigen, weiterhin inaktiven Preflight. Replay, Schattenlauf, KI,
Planwahl, Dosierungsanzeige, medizinische und produktive Nutzung sowie
Aktivierung bleiben in jedem Status `false`.

Wiki-, Therapie-v2- und Therapie-v3-Snapshot bleiben byteidentisch. Die
sechs disjunkten Schritt-6A-bis-7C-Gruppen bestehen mit 56/56 Tests, die
zusammenhaengende Regression mit 7/7 Dateien und 143/143 Tests und der
gruppierte Gesamtstand mit 50/50 Dateien und 579/579 Tests. Beide
TypeScript-Projekte, gezieltes ESLint, Secret-Policy und Produktionsbuild sind
erfolgreich. Die strukturierte P0/P1-Gegenpruefung meldet nach der
Ressourcen- und Rechtehaertung `APPROVE`. Die
ausfuehrliche Dokumentation steht in
`docs/wiki-step7c-audit-retention-restore-preflight-implementation-2026-08-04.md`.

### Schritt 7D: PostgreSQL-17-Konformitaetslauf

7D aendert weder Datenbankschema noch Anwendung. Der bestehende synthetische
Schritt-6A-bis-7C-Test verwendet lokal weiterhin PGlite und nur bei expliziter
`THERAPY_RETRIEVAL_TEST_DATABASE_URL` denselben kleinen Adapter fuer einen
echten PostgreSQL-Treiber. Migrationen, Fixtures und alle 56 fachlichen,
Integritaets-, Rechte-, Restore- und Governance-Nachweise bleiben identisch.

Da lokal weder Docker, Podman noch `psql` vorhanden sind, startet der isolierte
Workflow `.github/workflows/therapy-retrieval-postgres-conformance.yml` sechs
disjunkte Gruppen gegen jeweils einen frischen offiziellen PostgreSQL-17-
Service. Er besitzt nur Leserechte auf den Repositoryinhalt, verwendet
synthetische Service-Zugangsdaten und enthaelt weder Secrets noch Deployment-
oder Produktionsbefehle.

PGlite bleibt der konfigurationsfreie lokale Standard. `pg` und `@types/pg`
sind reine Entwicklungsabhaengigkeiten. Ein bestandener PostgreSQL-Lauf ist nur
ein technischer Portabilitaetsnachweis und genehmigt weder Aufbewahrung oder
Loeschung noch Replay, Schattenlauf, KI, Planwahl, Dosierungsanzeige,
medizinische oder produktive Nutzung oder Aktivierung. Die lokale Matrix
bestand mit 56/56 Retrievaltests; die uebrigen 50 Testdateien
bestanden mit 526/526 Tests. Beide TypeScript-Projekte, gezieltes ESLint und der
Produktionsbuild auf Node 20.20.2/npm 10.9.9 sind erfolgreich. Die ausfuehrliche
Dokumentation steht in
`docs/wiki-step7d-postgresql-conformance-implementation-2026-08-04.md`.
Der finale PostgreSQL-17.10-Lauf fuer Commit `d9f71af` bestand alle sechs Jobs
und 56/56 Tests:
<https://github.com/HubertMaierHubertMaier/naturheilpraxis-rauch/actions/runs/30903049293>.

### Schritt 7E: Ephemere PostgreSQL-Dump-/Restore-Probe

7E erweitert ausschliesslich den synthetischen PostgreSQL-17-CI-Nachweis. Nach
der Auditpersistenz-Gruppe wird die ephemere Quelldatenbank mit dem
versionsgleichen `pg_dump` im Custom-Format gesichert, innerhalb einer harten
64-MiB-Grenze in eine frische `template0`-Datenbank transaktional restauriert
und danach vollstaendig mit dem Servicecontainer verworfen.

Quelle und Ziel muessen exakte SHA-256-Werte fuer Wiki-, Therapie-v2- und
Therapie-v3-Snapshot sowie fuer das vollstaendige 7C-Preflightresultat liefern.
Damit bleiben Integritaetszaehler, Trigger, Restore-Fremdschluessel, RLS,
Policy, Rechte und geschlossener Writer im Vergleich enthalten. Der technische
Preflight muss vor und nach dem Restore weiterhin denselben inaktiven Status
liefern.

Der Dump wird nicht hochgeladen und ist nicht verschluesselt. Die Probe ist
deshalb ausdruecklich kein operativer Restore-Drill und genehmigt weder
Aufbewahrung oder Loeschung noch Deployment, Replay, Schattenlauf, KI,
Planwahl, Dosierungsanzeige, medizinische oder produktive Nutzung oder
Aktivierung. Die ausfuehrliche Dokumentation steht in
`docs/wiki-step7e-postgresql-dump-restore-rehearsal-implementation-2026-08-04.md`.
Der finale PostgreSQL-17.10-Lauf fuer Commit `fe7dd95` bestand alle sechs
Vertragsgruppen und die zusaetzliche Dump-/Restore-Probe mit exakten
Quell-/Zielhashes:
<https://github.com/HubertMaierHubertMaier/naturheilpraxis-rauch/actions/runs/30904172952>.

### Schritt 7F: Begrenzter PostgreSQL-Owner-Nebenlaeufigkeitsnachweis

7F erweitert ausschliesslich die isolierte synthetische Gruppe 5. Neben dem
vollstaendigen 7E-Restore entsteht eine zweite frische PostgreSQL-17-
Zieldatenbank aus einem auf 64 MiB begrenzten Custom-Dump, der nur die Daten der
Audit-Tabelle auslaesst. Schema, Trigger, Funktionen, Rollenvertrag sowie alle
synthetischen Eingabe- und Wissensfixtures bleiben erhalten. Dadurch beginnt
der konkurrierende Test mit null Auditzeilen, ohne `DELETE`, `TRUNCATE` oder
eine Triggerumgehung zu verwenden.

Vier Owner-Testaufrufer muessen nachweislich gemeinsam an einer Advisory-
Startbarriere warten. Erst wenn `pg_locks` alle vier Warteanforderungen zeigt,
gibt ein Inspektor die kompatiblen Shared-Sperren frei. Danach muss der
idempotente Writer genau einen neuen inaktiven Auditlauf erzeugen; ein Aufruf
meldet `PERSISTED`, drei melden `ALREADY_PERSISTED`, und alle sehen dieselbe ID
und dieselben gespeicherten Hashes. Fuenf Zielsitzungen, feste Statement-, Lock-
und Idle-Zeitgrenzen sowie die bestehende 15-Minuten-Jobgrenze begrenzen den
Ressourcenverbrauch.

Der anschliessende 7C-Preflight muss weiterhin vollstaendig positiv und inaktiv
sein; ungewahrte Sperren und ungueltige Auditzeilen muessen null bleiben.
Aufbewahrung, Loeschung, Deployment, Replay, Schattenlauf, KI, Planwahl,
Dosierungsanzeige, medizinische oder produktive Nutzung und Aktivierung werden
nicht freigegeben. Die ausfuehrliche Dokumentation steht in
`docs/wiki-step7f-postgresql-owner-concurrency-implementation-2026-08-04.md`.
Der finale PostgreSQL-17.10-Lauf fuer Commit `2259d28` bestand alle sechs
Vertragsgruppen. Gruppe 5 bestaetigte exakt vier Barriere-Warter, einen Insert,
drei idempotente Ergebnisse, eine gueltige Auditzeile, null ungueltige Zeilen
und null verbleibende Wartesperren:
<https://github.com/HubertMaierHubertMaier/naturheilpraxis-rauch/actions/runs/30907725812>.

### Schritt 7G: Begrenzter PostgreSQL-Owner-Abbruch- und Fehlerisolationsnachweis

7G erweitert ausschliesslich den isolierten synthetischen PostgreSQL-17-
Nachweis. Derselbe Auditdaten ausschliessende 7F-Dump wird transaktional in eine
weitere frische `template0`-Datenbank restauriert. Ein gueltiger Owner-Write muss
innerhalb einer expliziten Transaktion sichtbar sein und nach `ROLLBACK` wieder
einen exakten Auditbestand von `0:0` hinterlassen.

Danach warten vier Aufrufer gemeinsam an einer harten Advisory-Startbarriere.
Genau einer verwendet den exakten positiven 7A-Hash; drei verwenden
verschiedene syntaktisch gueltige, aber veraltete Hashes. Nur der gueltige
Aufruf darf persistieren. Die drei anderen muessen fail-closed abbrechen, ohne
eine zweite oder ungueltige Auditzeile und ohne verbleibende Wartesperre.

Fuenf gleichzeitige Zielsitzungen, feste Statement-, Lock-, Idle- und
Barrieregrenzen sowie die bestehende 15-Minuten-Jobgrenze begrenzen den Test.
Der anschliessende 7C-Preflight muss weiterhin technisch bereit und inaktiv
sein. Aufbewahrung, Loeschung, Deployment, Replay, Schattenlauf, KI, Planwahl,
Dosierungsanzeige, medizinische oder produktive Nutzung und Aktivierung werden
nicht freigegeben. Die ausfuehrliche Dokumentation steht in
`docs/wiki-step7g-postgresql-owner-failure-isolation-implementation-2026-08-04.md`.

## Historischer erster Implementierungsblock

Der erste abgeschlossene Codeblock umfasste ausschliesslich Schritt 1:

1. therapeutische Katalogmigration mit sechs Revisionstabellen
2. kontrollierte Entitaets- und Relations-Erweiterungen
3. Integritaets-, Hash-, RLS- und Rollenregeln
4. Erweiterung von Wiki-Teilbackup und gemeinsamem Snapshot von 32 auf 38
   Tabellen
5. exakte Restore-Reihenfolge
6. PGlite-Laufzeittests und statische Vertragspruefungen
7. Dokumentation und unabhaengige Review

Keine echten medizinischen Mittel, Dosierungen, Rubriken oder Patientendaten
werden in diesem Block angelegt.

## Ausfuehrungsgrenzen fuer diesen Block

Die Verifikation erfolgte auf einer Windowsumgebung mit vier CPU-Kernen und
16 GB RAM. Fuer reproduzierbare Abschlusslaeufe gilt:

- hoechstens zwei schwere Test- oder Buildaufgaben parallel
- fokussierte Tests waehrend der Entwicklung; voller Test und Build
  nacheinander als Abschlussgates
- bestehende Prozesse nicht ungeprueft beenden, da sie zu parallelen Arbeiten
  gehoeren koennen
- aktuelles aktives Worktree nicht verschieben oder bereinigen
- Projektbefehle mit der dokumentierten Node-20-/npm-10-Basis ausfuehren; die
  globale Node-24-/npm-11-Installation nicht als neue Projektbaseline behandeln
- Git-Zeilenenden erst in einem eigenen geprueften Block mit `.gitattributes`
  vereinheitlichen; die 18 bestehenden HTML-Statusaenderungen nicht mitsichern
- `git worktree prune`, `git gc` und Prozessstopps nur
  nach separater Bestands- und Freigabepruefung

## Betroffene Dateien des ersten Blocks

- `supabase/migrations/20260729140000_create_kb_therapeutic_catalog.sql`
- `src/lib/backupAreas.ts`
- `supabase/functions/backup-export/index.ts`
- `src/components/admin/BackupCenter.tsx`
- `src/test/wiki-phase1-core-schema.test.ts`
- `src/test/wiki-phase2-legacy-bridge.test.ts`
- `src/test/wiki-phase3-import-staging.test.ts`
- neu: `src/test/wiki-phase3-2-therapeutic-catalog.test.ts`
- Wiki-Phasendokumentation unter `docs/`

## Verifikation des ersten Blocks

### Schema und Integritaet

- leere Datenbank aus Migrationen herstellen
- nur korrekte Entitaetstypen in Detailtabellen zulassen
- Zubereitungsuntertyp und Detailtabelle muessen zusammenpassen
- Potenz-, Extrakt-, Alkohol-, Mengen- und Gueltigkeitschecks
- exakte Produktfamilien- und Zubereitungsrevision
- Komponenten mit chemischer Form und Elementarmenge
- ehrliche Basisassertion ohne wissenschaftliche Pflicht
- keine Mutation freigegebener oder historischer Details
- Inhalts-Hash erkennt jede Detail- oder Komponentenmanipulation

### Zugriff

- anonyme Rolle: Tabellenzugriff verweigert
- Patient: null sichtbare Zeilen und keine Mutation
- Admin: kontrollierter Zugriff
- `service_role`: Lesen, kein Schreiben oder Truncate
- `kb_importer` und `kb_import_runtime`: kein Zugriff

### Backup und Restore

- Frontend- und Edge-Inventar enthalten dieselben 38 Wiki-Tabellen
- Snapshotmanifest enthaelt alle 38 Tabellen
- integrierter synthetischer Export und Restore
- Zeilenzahl- und SHA-256-Manifeste stimmen exakt
- semantische Validierung erkennt verwaiste oder inkonsistente
  Katalogrevisionen

### Gesamtgates

- fokussierte Wiki-Tests
- vollstaendiger Testlauf
- beide TypeScript-Projekte
- Produktionsbuild
- `git diff --check`
- Secret-, PII- und Patientendatenpruefung
- unabhaengige Code- und Architekturreview

## Nicht im ersten Block

- keine echte Mittelbefuellung
- keine Entitaets-Promotion
- keine Patientenfaktentabellen
- keine Laborinterpretation
- keine Dosierungs- oder Sicherheitsregel im Kern
- kein Repertorium oder Rubrikimport
- keine Embeddings
- keine Aenderung am sichtbaren Therapievorschlag
- kein Supabase-Deployment
- kein Commit oder Push ohne gesonderte Freigabe
