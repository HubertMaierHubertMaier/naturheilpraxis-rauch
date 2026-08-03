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
verifiziert. Echter lizenzierter Inhalt, der Importvertrag sowie die Schritte 6
und 7 bleiben offen.

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
