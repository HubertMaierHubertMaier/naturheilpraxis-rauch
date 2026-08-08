# Wiki Phase 3.2+: Therapeutischer Katalog und erklaerbares Retrieval

Datum: 29.07.2026
Status: Schritt 1 lokal implementiert und verifiziert; nicht committed, nicht ausgerollt. Schritte 2 bis 7 bleiben Planung.

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

Lokal umgesetzt am 2026-07-30: normalisierte, append-only Kandidatenzeilen fuer
Namen, Aussagen, Quellenbindungen und therapeutische Details, ein versiegelter
SHA-256-Vertrag sowie ein deterministischer, schreibfreier Promotion-Readiness-
Pruefer. Backup und gemeinsamer Snapshot umfassen damit 48 Wiki-Tabellen. Dieser
Teilschritt erzeugt noch kein Kernwissen.

### Schritt 2B: Atomare Draft-Promotion

Naechster Datenbankblock. Er schreibt nur bei erneut bestandener Readiness eine
neue Kernentitaet mit Revision 1 als `draft`, typisierten Namen, Aussagen,
Details, Hash und unveraenderlicher Importprovenienz. Kandidaten fuer bestehende
Entitaeten bleiben ein getrenntes Revisionsverfahren.

## Schritt 3: Strukturierte Patientenfakten

Dieser Schritt erfolgt in einer eigenen Migration ausserhalb der `kb_*`-Tabellen.

Geplante Tabellen:

- `therapy_input_revisions`
- `therapy_input_sources`
- `therapy_input_facts`
- `therapy_input_fact_sources`

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

## Schritt 4: Freigaben, Regeln und Suchprojektion

Vor dem neuen Retrieval werden additiv umgesetzt:

- `kb_releases` und `kb_release_items`
- konkrete, quellengebundene `kb_dosage_rules`
- deterministische `kb_safety_rules`
- `kb_search_documents` nur fuer freigegebene Revisionen
- Laborparameter- und Referenzbereichsdetails, bevor Laborwerte automatisch
  interpretiert werden

Die klassische Volltext- und Alias-Suche wird zuerst umgesetzt. Embeddings sind
spaeter optional und duerfen Sicherheitsregeln nicht ausfiltern.

## Schritt 5: Homoeopathische Repertorisation

Materia-medica-Aussagen, Leitsymptome, Modalitaeten und Beziehungen koennen
zunaechst ueber Entitaeten, Artikel, Aussagen und kontrollierte Relationen
erfasst werden.

Eine echte deterministische Repertorisation benoetigt spaeter:

- lizenzierte und gepruefte Repertoriumsquelle
- versioniertes Repertorium
- hierarchische Rubriken
- Rubrikdomaenen wie Allgemein, Gemuet, Modalitaet, Lokalisation, Empfindung und
  Begleitsymptom
- quelleneigene Wertigkeits-/Gradskala
- quellengebundene Mittelzuordnung

Grade verschiedener Repertorien werden niemals still zusammengefuehrt. Ohne
lizenzierte Daten liefert der neue Pfad
`HOMEOPATHIC_LANE_UNAVAILABLE`; eine KI darf keine Rubriken oder Grade erfinden.

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

## Erster Implementierungsblock

Der naechste Codeblock umfasst ausschliesslich Schritt 1:

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

## Lokale Ausfuehrungsgrenzen fuer diesen Block

Die aktuelle Windowsumgebung besitzt vier CPU-Kerne und 16 GB RAM. Bei der
Bestandsaufnahme waren nur etwa 2,2 bis 2,6 GB physischer Speicher frei; die
Auslagerungsdatei wurde bereits genutzt. OpenCode, CodeAgentSwarm und Node
belegten gemeinsam rund 3 GB RAM. Drei bestehende Vite-Prozesse lauschten auf
`127.0.0.1:4173`, `:4174` und `:4175`.

Fuer die Implementierung gilt deshalb:

- hoechstens zwei schwere Agenten-, Test- oder Buildaufgaben parallel
- fokussierte Tests waehrend der Entwicklung; voller Test und Build
  nacheinander als Abschlussgates
- bestehende Prozesse nicht ungeprueft beenden, da sie zu parallelen Arbeiten
  gehoeren koennen
- vor weiterem umfangreichem Code eine ShadowCopy des uncommittierten
  Temp-Worktrees ausserhalb temporaerer Verzeichnisse erstellen
- aktuelles aktives Worktree nicht verschieben oder bereinigen
- neue saubere Worktrees bevorzugt auf dem freien Laufwerk `G:` anlegen
- Projektbefehle mit der dokumentierten Node-20-/npm-10-Basis ausfuehren; die
  globale Node-24-/npm-11-Installation nicht als neue Projektbaseline behandeln
- Git-Zeilenenden erst in einem eigenen geprueften Block mit `.gitattributes`
  vereinheitlichen; die 18 bestehenden HTML-Statusaenderungen nicht mitsichern
- `git worktree prune`, `git gc`, Prozessstopps und OpenCode-/Pluginupdates nur
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
- `OpenCode-Erinnerung/10-Wiki-Datenstruktur.md`
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
