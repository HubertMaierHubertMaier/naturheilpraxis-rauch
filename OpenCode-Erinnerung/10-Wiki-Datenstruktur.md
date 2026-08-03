# Wiki-Datenstruktur

## Verbindlicher Gesamtumfang

Die neue Struktur gilt fuer die gesamte interne Wissensdatenbank und nicht nur fuer Diamond Shield. Die bestehende lesbare Wiki bleibt erhalten. Zusaetzlich entsteht eine strukturierte, vernetzte Wissensebene.

Der vorgeschlagene Grundaufbau wurde am 27.07.2026 inhaltlich bestaetigt. Die Architektur muss langfristig offen bleiben fuer neue Hersteller, Apotheken, Mittel, Inhaltsstoffe, Therapierichtungen, Beschwerden, Erkrankungen, Pathogene, Organe, Laborwerte, diagnostische Verfahren, Programme, Protokolle und Quellen.

## Grundprinzip

Keine starre, immer tiefer verschachtelte Ordnerstruktur und keine einzige Riesentabelle. Empfohlen ist ein hybrides Modell:

1. Lesbare Wiki-Artikel fuer Menschen und KI.
2. Stabile Fachdaten fuer Hersteller, Mittel, Inhaltsstoffe und medizinische Begriffe.
3. Typisierte Viele-zu-viele-Verknuepfungen mit Kontext, Prioritaet, Anwendung und Quelle.
4. Flexible Zusatzattribute nur dort als JSON, wo noch kein stabiles Fachschema besteht.

## Notwendige Trennungen

- Hersteller, Produkt, Inhaltsstoff und konkrete Variante sind getrennte Objekte.
- Beschwerden, Erkrankungen, Ursachen, Pathogene, Organe und Laborbefunde duerfen nicht gleichgesetzt werden.
- Ein Befund speichert immer die diagnostische Methode und den Sicherheits-/Pruefstatus.
- Herstellerangabe, Erfahrungsheilkunde, interne Praxisregel und externe Fachquelle bleiben unterscheidbar.
- Allgemeines Wiki-Wissen und personenbezogene Patientendaten bleiben technisch strikt getrennt.
- Von KI oder Importen erzeugte Vorschlaege gelangen zuerst in einen Pruefbereich und nicht direkt in den freigegebenen Wissensbestand.

## Noch vor der Implementierung ausarbeiten

1. Konkretes Tabellen- und Beziehungsschema mit stabilen IDs, Synonymen und externen Kennungen.
2. Quellen-, Versions-, Freigabe- und Aenderungsmodell.
3. Sicherheitsdaten fuer Kontraindikationen, Wechselwirkungen, Dosierung und besondere Personengruppen.
4. Labormodell mit Einheit, Methode, Labor, Referenzbereich, Alter, Geschlecht und Verlauf.
5. Erklaerbare Such- und Empfehlungslogik mit direkter, indirekter und nur moeglicher Zuordnung.
6. Pilotdatensaetze fuer Erschoepfung, EBV oder Candida, Ferritin erniedrigt und ein Heel-Praeparat.

## Aktueller Status

Der konkrete Bauplan wurde am 27.07.2026 erstellt. Es ist noch keine neue Datenbankmigration ausgerollt. Die vorhandene flache Tabelle `admin_knowledge_base` und die lokalen Diamond-Shield-Erweiterungen bleiben bis zur gemeinsam geprueften, gesicherten und getesteten Einfuehrung unveraendert.

## Festgelegte Architektur

Empfohlen ist genau ein hybrider Ansatz innerhalb der bestehenden PostgreSQL-/Supabase-Datenbank:

1. `public.admin_knowledge_base` bleibt vorerst als lesbare Wiki und Kompatibilitaetsschicht erhalten.
2. Ein neues Schema `knowledge` enthaelt stabile Fachobjekte, Versionen, Relationen, Quellen und freigegebene Regeln.
3. Ein getrenntes Schema `knowledge_ingest` enthaelt ungepruefte Parser-, Import- und KI-Vorschlaege.
4. Patientendaten bleiben ausserhalb beider Wissensschemata in ihrem besonders geschuetzten Bereich.
5. Eine separate Graphdatenbank wird nicht eingefuehrt. PostgreSQL kann die benoetigten, kontrolliert begrenzten Graphabfragen selbst ausfuehren.
6. Es wird keine generische EAV-Riesentabelle aufgebaut. Stabile Fachdaten erhalten konkrete Tabellen; JSON dient nur fuer vorlaeufige Importdaten und seltene Zusatzattribute.

Die Ordnerstruktur dient nur der Navigation. Die fachliche Wahrheit liegt in stabilen IDs, typisierten Beziehungen, konkreten Quellen und unveraenderlichen Revisionen.

## Kritische Ausgangsrisiken

1. Das Repository reproduziert den vollstaendigen realen Wiki-Bestand nicht. Mehrere Migrationen aktualisieren bereits vorhandene Live-Datensaetze, deren urspruengliche Inserts fehlen.
2. Titel werden bisher teilweise als technische Schluessel verwendet, obwohl sie weder eindeutig noch unveraenderlich sind.
3. Pathogen-, Mittel-, Dosierungs- und Quellenbeziehungen werden aus Markdown geparst und koennen durch redaktionelle Aenderungen brechen.
4. Freigegebene Wiki-Inhalte besitzen keine Revisionen. Aenderungen ueberschreiben den vorherigen Stand.
5. Die Therapie-KI speichert bisher keine vollstaendige, reproduzierbare Kette aus Wissensrevisionen, Claims, Quellen und verwendeten Textabschnitten.
6. Kurze Fachcodes wie `EBV`, `CMV`, `TSH`, `CRP`, `IM` oder `SD` sind in der normalen Wiki-Suche teilweise nicht auffindbar.
7. Neue Wissensbanktabellen waeren ohne Anpassung der Backup-Bereichslisten nicht im Wiki-Teilbackup enthalten.
8. Sicherheitsregeln, Kontraindikationen und Wechselwirkungen stehen bisher ueberwiegend in Freitext oder Promptlogik und sind nicht deterministisch pruefbar.

Wegen dieser Risiken darf keine destruktive oder direkte Live-Migration erfolgen.

## Stabiler Identitaetsraum

### `knowledge.kb_entity_types`

Kontrollierte, erweiterbare Typen statt eines PostgreSQL-Enums. Starttypen:

- `manufacturer`
- `pharmacy`
- `laboratory`
- `publisher`
- `product`
- `product_variant`
- `substance`
- `plant`
- `nutrient`
- `symptom`
- `disease`
- `cause`
- `pathogen`
- `organ`
- `tissue`
- `lab_parameter`
- `lab_finding_definition`
- `diagnostic_method`
- `therapy_method`
- `device`
- `program`
- `protocol`
- `population_group`

Neue Typen koennen spaeter kontrolliert ergaenzt werden, ohne die vorhandenen IDs zu veraendern.

### `knowledge.kb_entities`

Gemeinsame stabile Identitaet aller Fachobjekte:

- `id uuid` als Primaerschluessel
- `entity_type_code` als Fremdschluessel
- `canonical_key` als unveraenderlicher, eindeutiger ASCII-Schluessel
- `lifecycle_status`
- `current_revision_id`
- `created_at`, `created_by`

Beispiele fuer `canonical_key`:

- `pathogen:epstein-barr-virus`
- `symptom:fatigue`
- `lab-parameter:ferritin`
- `manufacturer:heel`
- `program:diamond-shield:ebv`

Titel und Anzeigenamen duerfen sich aendern. Sie sind niemals technische Identitaeten.

### `knowledge.kb_entity_revisions`

Unveraenderliche Versionen mit:

- Revisionsnummer
- Anzeigename
- Kurzbeschreibung
- ausfuehrlicher Markdown-Beschreibung
- Bearbeitungs- und Freigabestatus
- Ursprungstyp
- Ersteller und Pruefer
- Inhalts-Hash
- Erstellungs-, Pruef-, Freigabe- und Wiedervorlagedatum

Eine veroeffentlichte Revision wird nicht ueberschrieben. Eine Korrektur erzeugt eine neue Revision.

### `knowledge.kb_entity_names`

Bevorzugte Namen, Abkuerzungen, wissenschaftliche Namen, Handelsnamen, historische Namen und Schreibvarianten:

- `EBV`
- `Epstein-Barr-Virus`
- `Humanes Herpesvirus 4`
- `HHV-4`

Alle Namen verweisen auf dieselbe stabile Entitaet.

### `knowledge.kb_entity_identifiers`

Externe Kennungen werden nicht als freie Tags gespeichert. Vorgesehene Systeme:

- PZN
- GTIN
- Hersteller-SKU
- LOINC
- ICD-10-GM
- ATC
- NCBI Taxonomy
- Hersteller- und Programmcodes

Die Kennungstypen liegen in einer kontrollierten Tabelle und koennen spaeter erweitert werden.

## Lesbare Wiki und Revisionen

### `knowledge.kb_articles`

- stabile Artikel-ID und `canonical_key`
- optionale Verbindung zur bisherigen `admin_knowledge_base.id`
- Artikeltyp
- aktuelle Revision
- Archivstatus

### `knowledge.kb_article_revisions`

Jede Revision speichert den vollstaendigen Stand von Titel, Kategorie, Tags und Markdown-Inhalt samt Hash. Der erste Import uebernimmt den bisherigen Artikel bytegetreu als `legacy_snapshot`.

### `knowledge.kb_article_entities`

Verknuepft einen lesbaren Artikel mit Fachobjekten. Rollen:

- `about`
- `mentions`
- `recommends`
- `warns_about`
- `source_for`

Die alte Wiki kann dadurch weiter gelesen werden, waehrend strukturierte Daten schrittweise entstehen.

### `knowledge.kb_categories`

Echte beliebig tiefe Hierarchie mit `parent_id`, stabilem Slug und Sortierung. Der bisherige Kategoriepfad mit ` > ` bleibt waehrend des Parallelbetriebs als kompatible Anzeige erhalten.

## Hersteller, Produkte und Inhaltsstoffe

### `knowledge.kb_organizations`

Details fuer Hersteller, Apotheken, Labore, Verlage und Distributoren:

- rechtlicher und angezeigter Name
- Organisationstyp
- Land
- Website
- externe Kennungen

### `knowledge.kb_products`

Das allgemeine Produkt beziehungsweise die Produktfamilie:

- Produkttyp
- Therapiesystem
- regulatorischer Status
- Herstellerrelation

### `knowledge.kb_product_variants`

Die konkrete kauf- oder anwendbare Variante:

- Produkt-ID
- Darreichungsform
- Staerke oder Potenz
- Packungsgroesse
- PZN, SKU oder GTIN
- Markt- und Gueltigkeitsstatus

Arnica D6, D12 und C30 oder verschiedene Packungsgroessen bleiben getrennte Varianten.

### `knowledge.kb_substances`

Wirkstoffe, Hilfsstoffe, Pflanzen, Vitamine, Mineralstoffe, Spurenelemente, Aminosaeuren und weitere Substanzklassen.

### `knowledge.kb_product_ingredients`

Quellengebundene Zusammensetzung einer konkreten Produktvariante:

- Produktvariante
- Substanz
- Rolle des Inhaltsstoffs
- Menge von/bis
- Einheit und Bezugsmenge
- Potenzskala und Potenzwert bei Homoeopathika
- Gueltigkeitszeitraum
- zugehoerige freigegebene Aussage

Hersteller, Produkt, Variante und Inhaltsstoff duerfen nicht zu einem Datensatz zusammengezogen werden.

## Medizinische und diagnostische Fachobjekte

Eigene Detailtabellen erweitern die gemeinsamen Entitaeten:

- `kb_symptom_details`
- `kb_disease_details`
- `kb_pathogen_details`
- `kb_organ_details`
- `kb_diagnostic_method_details`
- `kb_lab_parameter_details`
- `kb_lab_finding_definitions`
- `kb_program_details`
- `kb_protocol_details`
- `kb_population_group_details`

Beschwerde, Symptom, Erkrankung, Ursache, Pathogen, Organ und Laborbefund bleiben getrennte Typen.

Ein Metatron-/NLS-Hinweis, ein klinischer Verdacht, ein Antikoerperbefund, eine PCR und ein bildgebender Befund werden niemals als gleichartige Diagnose gespeichert. Jede Beobachtung benoetigt ihre diagnostische Methode und ihren Sicherheits-/Pruefstatus.

## Laborstruktur

### `knowledge.kb_lab_parameters`

- Analyt
- Material beziehungsweise Probe
- kanonische Einheit
- Werteart
- optionale LOINC-Kennung

### `knowledge.kb_lab_reference_ranges`

Jeder Referenzbereich benoetigt:

- Laborparameter
- Methode und gegebenenfalls Labor
- Material
- Einheit
- untere und obere Grenze oder qualitativen Wert
- Alter und Geschlecht
- besondere Population, beispielsweise Schwangerschaft
- Gueltigkeitszeitraum
- Quelle und Freigabestatus

Patientenmesswerte gehoeren nicht in diese Tabellen. Sie bleiben im geschuetzten Patientenbereich und duerfen hoechstens die stabile Parameter-ID referenzieren.

Werte verschiedener Methoden oder Einheiten werden nicht ungeprueft zusammengefuehrt. Eine automatische Umrechnung ist nur mit getesteten, dimensionssicheren Regeln erlaubt.

## Aussagen und kontrollierte Beziehungen

### `knowledge.kb_relation_types`

Erlaubte gerichtete Beziehungen mit zulaessigen Subjekt- und Objekttypen. Startbeispiele:

- `manufactured_by`
- `contains`
- `targets_pathogen`
- `indicated_for`
- `may_support`
- `may_be_associated_with`
- `manifests_as`
- `affects_organ`
- `measured_by`
- `may_indicate`
- `part_of_protocol`
- `alternative_to`
- `contraindicated_for`
- `interacts_with`

Eine breite, bedeutungslose Relation `related_to` wird nicht zugelassen. Ein Constraint-Trigger verhindert unlogische Typkombinationen.

### `knowledge.kb_assertions`

Jede fachlich relevante Behauptung wird als eigene versionierte Aussage gespeichert:

- stabile logische ID und Versionsnummer
- Aussageart
- Bearbeitungs- und Freigabestatus
- Ursprungstyp
- Evidenzbasis und Evidenzqualitaet
- Gueltigkeitszeitraum
- Ersteller, Pruefer und Wiedervorlagedatum
- ersetzte Vorversion

Eine neue Quelle ueberschreibt keine abweichende alte Aussage. Widersprueche bleiben sichtbar und koennen als offen, kontextabhaengig, bevorzugt oder ersetzt bewertet werden.

### `knowledge.kb_entity_relations`

Die konkrete Graphkante einer Aussage:

- Subjekt-Entitaet
- kontrollierter Relationstyp
- Objekt-Entitaet
- Zuordnungsstaerke
- Rang und Kontext

Zuordnungsstaerken:

- `direct`
- `indirect`
- `possible`
- `contextual`
- `not_recommended`

Dadurch wird zum Beispiel Erschoepfung nicht mit EBV gleichgesetzt. Die Datenbank kann lediglich eine quellengebundene, entsprechend gekennzeichnete moegliche Verbindung darstellen.

## Quellen, Evidenz und Herkunft

### `knowledge.kb_sources`

Stabile Identitaet einer Quelle.

### `knowledge.kb_source_revisions`

- Quellentyp
- Titel und Autoren
- Verlag oder Hersteller
- Auflage und Veroeffentlichungsdatum
- URL, DOI, PMID oder ISBN
- Abrufdatum
- Datei-Hash
- Lizenz- und Archivangaben
- Freigabestatus

### `knowledge.kb_assertion_sources`

Verbindet eine Aussage mit einer konkreten Quellenrevision:

- Rolle `supports`, `refutes`, `qualifies` oder `mentions`
- Seite, Kapitel, Abschnitt oder URL-Anker
- kurzes Originalzitat
- Kennzeichnung der Hauptquelle

KI und Parser sind keine fachlichen Quellen. Sie sind lediglich Ursprung eines ungeprueften Vorschlags.

Evidenz wird zweiachsig gespeichert:

1. Basis: Herstellerangabe, traditionelle Anwendung, Erfahrungsheilkunde, interne Praxisregel, Beobachtungsstudie, klinische Studie, Review oder Leitlinie.
2. Qualitaet: hoch, moderat, niedrig, sehr niedrig oder noch nicht bewertet.

Hersteller- und Therapeutenangaben werden damit nicht faelschlich als wissenschaftlicher Wirksamkeitsnachweis dargestellt.

## Dosierung, Protokolle und Sicherheit

### `knowledge.kb_dosage_rules`

- konkrete Intervention oder Produktvariante
- Indikation
- Population
- Applikationsweg
- Mindest- und Hoechstdosis
- Einheit und Bezugszeitraum
- Haeufigkeit
- Mindest- und Hoechstdauer
- Einnahmezeitpunkt
- zusaetzlicher Anwendungstext
- Aussage, Quelle, Freigabe und Gueltigkeit

### `knowledge.kb_safety_rules`

Regeltypen:

- Kontraindikation
- Wechselwirkung
- Vorsichtsmassnahme
- Dosisanpassung
- Nebenwirkung
- Monitoring
- Schwangerschaft
- Stillzeit
- Kind
- Nierenfunktion
- Leberfunktion

Jede Regel benoetigt betroffene Entitaeten, Schweregrad, Handlung, Quelle, Gueltigkeit und Freigabe.

Die deterministische Sicherheitspruefung muss vor der generativen KI laufen und deren Ergebnis danach nochmals kontrollieren. Produktpraeferenzen, Pinning und Prompttexte duerfen eine harte Blockregel nicht uebersteuern. Unaufgeloeste Mittel oder fehlende kritische Patientendaten fuehren zu `REQUIRE_REVIEW`, nicht stillschweigend zu `ALLOW`.

### `knowledge.kb_protocols`, `kb_protocol_revisions`, `kb_protocol_steps`

Protokolle werden versioniert in geordnete Phasen und Schritte zerlegt. Ein Schritt kann Produkte, Wirkstoffe, Programme, Methoden und konkrete Dosierungsregeln referenzieren.

Diamond-Shield-ChipCards und begleitende Mittel bleiben dadurch getrennte Interventionen innerhalb eines gemeinsamen Protokolls.

## Import und fachliche Pruefung

Das Schema `knowledge_ingest` enthaelt:

- `kb_import_batches`
- `kb_entity_candidates`
- `kb_relation_candidates`
- `kb_dosage_candidates`
- `kb_safety_candidates`
- `kb_source_candidates`
- `kb_review_decisions`
- `kb_import_errors`

Jeder Import speichert Quelle, Datei-Hash, Parser- oder Modellversion und Originalfundstelle. Unklare Sammelbegriffe und kombinierte Tabellenzellen landen in der Pruefliste und werden nicht automatisch zerlegt oder freigegeben.

Statusfolge:

1. `imported_unreviewed`
2. `draft`
3. `domain_review`
4. `safety_review`, falls erforderlich
5. `approved`
6. `released`
7. `superseded` oder `withdrawn`

KI und Parser duerfen niemals `approved` oder `released` setzen. Der Projektinhaber erhaelt initial die Publisher-Berechtigung; weitere Editor-, Reviewer- und Publisherrollen koennen spaeter getrennt vergeben werden.

## Wissensfreigaben und Nachvollziehbarkeit

### `knowledge.kb_releases`

Eine Empfehlung verwendet nur einen unveraenderlichen, freigegebenen Wissensstand. Ein Release enthaelt die konkreten freigegebenen Revisionen, Aussagen, Quellen und Sicherheitsregeln.

### `knowledge.kb_change_log`

Append-only-Protokoll mit Bearbeiter, Aktion, Objekt, alter und neuer Revision sowie Zeitpunkt.

### Therapie-Audit im Patientenbereich

Jeder spaetere Empfehlungslauf muss speichern:

- verwendete Knowledge-Release-ID
- Regelpaket und Retrievalversion
- Modell und Prompt-Hash
- verwendete Entitaets-, Aussage-, Artikel-, Chunk- und Quellen-IDs
- Treffer- und Ausschlussgruende
- Sicherheitsentscheidungen
- strukturierte Empfehlung
- daraus erzeugte Anzeige

Alte Empfehlungen bleiben damit gegen den damals gueltigen Wissensstand reproduzierbar. Personenbezogene Eingaben und Rohbefunde werden nicht in `knowledge` gespeichert.

## Suche und KI-Retrieval

### `knowledge.kb_search_documents`

Denormalisierte Suchprojektion ausschliesslich freigegebener Revisionen:

- stabile Entitaets-, Artikel- oder Aussage-ID
- Revisions-ID
- Titel und Aliase
- kontrollierte Codes
- Typen und Kategorien
- relevanter Text
- Quellen
- deutscher und einfacher `tsvector`
- optional spaeter Embedding plus Modellversion

Suchreihenfolge:

1. exakte externe Kennung
2. exakter Alias oder Kurzcode
3. exakter Anzeigename
4. Code-Praefix
5. deutsche Volltextsuche
6. einfache Volltextsuche fuer Produktnamen und Codes
7. Trigrammsuche fuer Schreibfehler
8. kontrollierte Grapherweiterung um hoechstens zwei Kanten
9. optionales KI-Reranking einer kleinen, bereits begruendeten Treffermenge

Jeder Treffer liefert seinen Auswahlgrund, die konkrete Revision, Relation, Zuordnungsstaerke, Evidenz und Quelle. Sicherheitsclaims werden deterministisch geladen und nicht durch semantisches Ranking aussortiert.

## Rollen und Zugriff

Startrollen:

- `viewer`: sieht nur freigegebene Inhalte
- `editor`: erstellt Entwuerfe und Importvorschlaege
- `reviewer`: prueft vorgelegte Revisionen
- `publisher`: veroeffentlicht ueber kontrollierte Funktionen

Anonyme Benutzer und Patienten erhalten keinen Zugriff auf `knowledge` oder `knowledge_ingest`. Freigegebene Revisionen sind gegen direkte Aenderung und Loeschung geschuetzt. Veroeffentlichung erfolgt ueber gepruefte RPC-Funktionen mit festem `search_path`.

Service-Role-Verwendung in Edge Functions hebt RLS auf und erfordert deshalb immer eine vorherige Benutzer- und Rollenpruefung.

## Pilotdatensaetze

Der erste Pilot umfasst sieben unterschiedliche Modellierungswege:

1. `Erschoepfung/Fatigue`: Symptom mit deutschen und englischen Aliasen.
2. `Epstein-Barr-Virus`: Pathogen mit den Kurzcodes `EBV` und `HHV-4`.
3. `Candida albicans`: Pilz mit wissenschaftlichem Namen und Schreibvarianten.
4. `Ferritin erniedrigt`: Laborparameter plus methoden- und referenzbereichsgebundene Befunddefinition; keine erfundene universelle Grenzzahl.
5. Ein konkretes Heel-Komplexmittel: Hersteller, Produkt, Variante, Inhaltsstoffe, Dosierung und Sicherheit nur aus einer aktuellen Originalquelle.
6. Ein Diamond-Shield-Programm: Anbieter, Programmcode, konkrete Handbuchrevision und quellengebundene Pathogenzuordnung.
7. Ein NutraMedix- oder anderes Pflanzenprodukt: Herstellerprodukt, konkrete Variante, Pflanzenwirkstoff, botanischer Name und quellengebundene Zuordnungen.

Die vorhandenen Markdowntexte dienen als Importhinweis, nicht automatisch als freigegebener Nachweis.

## Einfuehrungsplan

### Phase 0: Vollstaendigen Live-Bestand sichern

- autorisierten Export der gesamten Live-Wiki als JSON und CSV erstellen
- IDs, Zeilenzahl, Kategorien, Tags, Byte-Laengen und Hashes dokumentieren
- doppelte Titel und identische Inhalte nur berichten, nicht automatisch zusammenfuehren
- vollstaendiges Datenbankbackup erzeugen
- Restore in isolierter Umgebung mit Hashvergleich testen

Ohne erfolgreichen Export und Restore darf keine Datenmigration beginnen.

### Phase 1: Additives Fundament

- neue Schemas und Kernobjekte parallel anlegen
- kontrollierte Typen, Revisionen, Quellen, Aussagen, Rollen und RLS einrichten
- `admin_knowledge_base` weder umbenennen noch loeschen oder inhaltlich umschreiben
- Backup- und Restoredefinitionen um alle neuen Tabellen erweitern
- generierte Supabase-Typen aktualisieren

### Phase 2: Verlustfreie Wiki-Bruecke

- jede bestehende Wiki-Zeile unveraendert als erste Artikelrevision spiegeln
- Legacy-ID und Hash erhalten
- neue Aenderungen als weitere Snapshots erfassen
- Kategorien und Tags zunaechst unveraendert uebernehmen
- alte Wiki-Oberflaeche weiterhin voll funktionsfaehig halten

### Phase 3: Import-Staging und Pilot

- Markdown- und Pathogenparser schreiben nur Kandidaten
- sieben Pilotbuendel modellieren
- jede fachliche Beziehung auf Originalquelle und Fundstelle zurueckfuehren
- Synonyme und Codes pruefen
- Dosierungs- und Safety-Daten gesondert freigeben

### Phase 4: Fachredaktion

- Editor fuer Fachobjekte, Relationen und Quellen
- Vergleich von Revisionen
- Review-, Freigabe-, Ablehnungs- und Ruecknahmeprozess
- Wiedervorlage veralteter Quellen
- kontrollierte Taxonomieverwaltung

### Phase 5: Suche und strukturierter Pathogenindex

- serverseitige Suche mit Kennungen, Aliasen, Volltext und Tippfehlertoleranz
- bestehenden Markdown-Parser und neue strukturierte Relationen parallel vergleichen
- bei noch nicht migrierten Artikeln Legacy-Fallback beibehalten
- kurze Codes und Umlaute mit festen Testfaellen absichern

### Phase 6: Recommendation v2 im Schattenbetrieb

- neues Retrieval parallel zur bisherigen Therapie-KI ausfuehren
- sichtbare Empfehlung weiterhin zunaechst aus dem alten Pfad liefern
- Unterschiede, Quellenabdeckung und Sicherheitsentscheidungen auditieren
- KI-Antwort ueber ein strukturiertes JSON-Schema statt ueber Pipe-Markdown erzeugen
- Server validiert IDs, Quellen, Dosierungen und Safety vor der Anzeige

### Phase 7: Kontrollierte Umschaltung

- neue Suche und Empfehlungen nur nach fachlicher, technischer, Datenschutz- und Restore-Abnahme aktivieren
- sofort umschaltbaren Legacy-Lesepfad beibehalten
- bestehende Therapiesitzungen und historische JSON-Felder lesbar halten
- alte Parser erst nach nachgewiesener Vollstaendigkeit schrittweise abschalten

## Unverhandelbarer Kompatibilitaetsvertrag

Bis zur vollstaendigen Abnahme gilt:

1. Kein `DROP`, `RENAME` oder Spaltentypwechsel an `admin_knowledge_base`.
2. Bestehende UUIDs bleiben erhalten.
3. Alte Markdown-Inhalte werden bytegetreu archiviert.
4. Bisherige Kategoriepfade, Tags und Pathogentabellen bleiben lesbar.
5. Titel werden nicht mehr als neue technische Identitaeten verwendet.
6. Neue Daten werden zunaechst nur additiv und nicht zurueck in Legacy-Freitext geschrieben.
7. Rollback bedeutet Umschalten des Lesepfads, nicht Loeschen oder Rueckuebersetzen neuer Daten.
8. Neue Tabellen muessen in `src/lib/backupAreas.ts` und `supabase/functions/backup-export/index.ts` aufgenommen werden.
9. Historische `therapy_sessions.eingabe_daten` mit Kategorien, Pinning und Pathogenen bleiben kompatibel.

## Stop- und Rueckrollkriterien

Die Einfuehrung wird sofort angehalten bei:

- fehlendem oder nicht erfolgreich getesteten Live-Backup
- nicht erklaerbarer Hash- oder Zeilenabweichung
- verlorener Legacy-Aenderung
- Patientendaten in Wissens-, Quellen-, Such- oder Embeddingtabellen
- automatischer Freigabe von KI- oder Parservorschlaegen
- freigegebener Dosierungs- oder Sicherheitsregel ohne konkrete Quelle
- unzulaessiger oder mehrdeutiger Graphbeziehung
- Vermischung unterschiedlicher diagnostischer Methoden
- Sicherheitsregel, die durch Pinning, Produktpraeferenz oder KI umgangen wird
- Empfehlung ohne reproduzierbaren Knowledge-Release und Quellenstand

Die neuen Lesepfade werden dann per Feature Flag deaktiviert. Die alte Wiki bleibt unveraendert nutzbar.

## Abnahmetests

1. Leere Datenbank vollstaendig aus Migrationen herstellen.
2. Live-Export testweise einspielen und IDs, Zeilenzahl und Hashes vergleichen.
3. Bestehendes Wiki-CRUD unveraendert testen.
4. RLS fuer anonym, Patient, Admin, Editor, Reviewer und Publisher testen.
5. Titel- und Kategorieaenderungen duerfen stabile Verknuepfungen nicht brechen.
6. `EBV`, `CMV`, `TSH`, `CRP`, `IM`, `SD`, Umlaute und Tippfehler muessen auffindbar sein.
7. Synonyme muessen auf dasselbe Fachobjekt zeigen.
8. Direkte, indirekte und moegliche Relationen muessen getrennt bleiben.
9. Jede freigegebene Dosierungs- und Sicherheitsregel benoetigt Quelle und Revision.
10. Widersprechende Quellen bleiben gleichzeitig nachvollziehbar.
11. Laborregeln beruecksichtigen Einheit, Methode, Alter, Geschlecht und Gueltigkeit.
12. Unterschiedliche Produktvarianten werden nicht zusammengefuehrt.
13. Kein Entwurf und kein abgelehnter Import erscheint in produktiver Suche oder KI.
14. Jede Empfehlung speichert die tatsaechlich verwendeten Revisionen, Claims und Quellen.
15. Audit meldet nur Textabschnitte als verwendet, die tatsaechlich im KI-Kontext lagen.
16. Harte Sicherheitsregeln koennen nicht durch Pinning oder Prompttexte uebersteuert werden.
17. Wiki-Teilbackup und Vollbackup enthalten alle neuen Tabellen und lassen sich wiederherstellen.
18. Alter und neuer Pathogenindex werden waehrend des Parallelbetriebs gegen ein gemeinsames Gold-Testset verglichen.

## Naechster operativer Schritt

Vor SQL-Migrationen oder UI-Umbauten wird der vollstaendige Live-Bestand von `admin_knowledge_base` autorisiert exportiert und in einer isolierten Umgebung wiederhergestellt. In der aktuellen Sitzung fehlen Supabase-Zugang und Projektverknuepfung; deshalb wurde bewusst noch keine Live-Abfrage oder Migration ausgefuehrt.

Nach erfolgreicher Sicherung wird Phase 1 als kleine additive Migration mit Kernobjekten, Quellen, Revisionen und RLS vorbereitet. Die sieben Pilotdatensaetze folgen erst danach im Pruefbereich.

## Stopppunkt fuer die naechste Sitzung

Stand vom 27.07.2026:

1. Der vollstaendige technische Wiki-Datenbank-Bauplan ist erstellt und in dieser Datei dauerhaft dokumentiert.
2. Der Bauplan und die allgemeine Speicher-/Datenschutzregel wurden mit Commit `9076ae3` auf GitHub `main` gesichert.
3. Die neue Datenbankstruktur wurde noch nicht als Migration implementiert und nicht live ausgerollt.
4. Die bestehende Wiki und alle bisherigen Daten bleiben unveraendert.
5. Die naechste Sitzung beginnt mit Phase 0: vollstaendiger autorisierter Export von `admin_knowledge_base`, Inventur mit IDs und Hashes sowie ein isolierter Restore-Test.
6. Ohne nachgewiesene Vollstaendigkeit und erfolgreichen Restore wird keine neue Wissensdatenbankmigration gestartet.

## Phase-0-Ergebnis vom 28.07.2026

Phase 0 wurde erfolgreich abgeschlossen:

1. Lokales Vollbackup: `Naturheilpraxis-DATEN-voll-Backup-2026-07-28_08-18.zip`, SHA-256 `26f0a4fa33b5333c37c4a5f944145c58d4b42b0a50fc6251f00cf3a7122e8502`.
2. Lokales Codebackup: `Naturheilpraxis-CODE-Backup-2026-07-28_08-18.zip`, SHA-256 `165dae9ec05b17ee9627129687c4258c2c301880075eef0c6b9772105e1a445d`.
3. Beide ZIPs sind lesbar und enthalten keine `.ERROR.txt`-Eintraege.
4. Das Codebackup entspricht GitHub-Commit `12bfd05` und enthaelt Bauplan, Speicherregel, Migrationen und Backup-Function.
5. Wiki-Export: 436 erwartete und 436 vorhandene Zeilen, 436 eindeutige gueltige UUIDs, keine fehlenden Pflichtfelder.
6. Bestand: 32 Kategorien und 1087 eindeutige Tags.
7. Es gibt 12 normalisierte Titel-Dublettengruppen, darunter zwei exakt doppelte Vitaplace-Titel. Diese werden nur dokumentiert und nicht automatisch zusammengefuehrt.
8. Die Live-Datenbank enthaelt zusaetzlich `knowledge_product_links` mit 2 ungeprueften Verknuepfungen und `mannayan_products` mit 542 allgemeinen Produkten.
9. Beide Produktverknuepfungen zeigen auf vorhandene Wiki- und Produkt-UUIDs; es gibt keine verwaisten Beziehungen.
10. Der isolierte PostgreSQL-kompatible Restore-Test hat 436/436 Wiki-Zeilen, 542/542 Produkte und 2/2 Verknuepfungen mit exakten Feldvergleichen wiederhergestellt.

Die Rohbackups und extrahierten Daten bleiben ausschliesslich lokal ausserhalb des Git-Repositories. Auf GitHub wird nur der technische Pruefbericht ohne Patientendaten gesichert.

Abgleich mit dem aktuellen Codebackup: `knowledge_product_links` ist in der GitHub-Migration `20260715155222_728b55a8-4b41-4449-9e5b-976c711ed4ed.sql` und im dortigen Supabase-Typstand korrekt enthalten. Nur der alte, stark zurueckliegende lokale Hauptarbeitsstand kannte diese Dateien noch nicht. Es besteht deshalb keine fehlende Live-Migration fuer diese Tabelle. Die bestehende Migration hat ausserdem bereits Review-, Evidenz-, Dosierungs-, Quellen- und Sicherheitsfelder an `admin_knowledge_base` ergaenzt; Phase 1 muss darauf aufbauen und darf diese Arbeit nicht duplizieren.

Naechster Schritt: additive Phase-1-Migration zunaechst lokal entwerfen und testen; keine Live-Ausrollung ohne erneute Pruefung.

## Fortschritt bis Schritt 5B-2 am 03.08.2026

Auf dem separaten Datenbankzweig sind die additiven, weiterhin nicht live
ausgerollten Vertraege inzwischen bis zum homoeopathischen Import-Preflight
fortgeschrieben. Schritt 5B-2 fuegt ausschliesslich vier owner-seitig getestete
Funktionen hinzu: ein kompaktes Repertoriums-Bundle-Manifest, dessen SHA-256,
eine strikte Erwartungsvalidierung und einen fail-closed Hash-/Zaehlervergleich.
Die Mittelkomponente bindet alle Mittelzuordnungen des Repertoriums, auch wenn
ein Mittel noch keiner Rubrik zugeordnet ist.

Der Block erzeugt keine Tabelle, schreibt keine Daten, enthaelt keine echten
medizinischen Inhalte und vergibt kein Recht an Anwendung, `service_role` oder
Importrollen. Die bestehenden 65 Wiki-Tabellen und vier Therapie-Input-Tabellen
bleiben byteidentisch. `HOMEOPATHIC_IMPORT_BUNDLE_READY` bedeutet nur
Integritaetsgleichheit mit einer vorab festgelegten Importerwartung und niemals
Freigabe, Wirksamkeit oder therapeutische Eignung.

Vor echten Repertoriumsdaten bleiben Lizenz- und Quellenfreigabe,
quellenspezifischer Rohdaten- und Zeilenhashvertrag, owner-only
Chunk-/Bulk-Writer, Resume/Rollback, PostgreSQL-Grossmengenprofilierung sowie
Restore-, RLS- und Fachabnahme offen.

## Fortschritt bis Schritt 5B-3 am 03.08.2026

Der parserseitige Bundle-Hashvertrag ist als reine TypeScript-Referenz lokal
implementiert. Er erzeugt aus kanonischen UUIDs, Quellenmetadaten und bereits
semantisch gebildeten Zeilenhashes bytegleich das kompakte PostgreSQL-Manifest
und dessen SHA-256. Exakte Felder, UTF-8-Grenzen, Eindeutigkeit und
Assignment-Verweise werden vor der Hashbildung fail-closed geprueft.

Dieser Vertrag ist kein Rohdatenparser, kein Writer und keine medizinische
Freigabe. Offen bleiben weiterhin die konkrete lizenzierte Quelle, die
quellenspezifische Bildung der Zeilenhashes, Gold-Fixtures, owner-only
Chunk-/Bulk-Schreiben, Resume/Rollback sowie PostgreSQL-Grossmengen-, Restore-,
RLS- und Fachabnahme.

## Fortschritt bis Schritt 5B-4 am 03.08.2026

Die fuenf normalisierten Step-5A-Zeilenpayloads koennen nun parserseitig
bytegleich zu PostgreSQL gehasht werden. Der Vertrag prueft exakte UUIDs,
SHA-256-Werte, kontrollierte Rechte und Urspruenge, UTF-8-Grenzen, Elternfelder
sowie alle verschachtelten Repertoriums-, Rubrik-, Grad- und Mittelhashbindungen.

Der Vertrag verarbeitet weiterhin weder Quelldateien noch echte medizinische
Inhalte und schreibt nichts. Quelleninhalt, Metadaten und generische
Mittelrevision bleiben vorgelagerte, noch mit einer lizenzierten Quelle und
Gold-Fixtures abzunehmende Eingaben; ein owner-only Writer folgt erst danach.

## Fortschritt bis Schritt 5B-5 am 03.08.2026

Ein kleiner owner-only Referenzwriter kann nun genau ein bereits normalisiertes
und parserseitig vorgehashtes Repertoriumsbuendel atomar in die sechs
Step-5A-Tabellen schreiben. Der streng typisierte Umschlag ist auf 4 MiB, 256
Rubriken, 64 Grade, 256 Mittel und 2.048 Assignments begrenzt. Quelle,
Repertoriumsrevision und generische Mittelrevisionen werden nicht erzeugt.

Ein absichtlich falscher Zeilenhash rollt alle Writerzeilen und die
Repertoriumshashaenderung zurueck. Exakt gleiche Wiederholungen schreiben nichts
erneut und bleiben auch nach Freigabe der Revisionen gueltig; jede abweichende
Wiederholung scheitert. Der Preflight muss abschliessend Hash- und Zaehlergleichheit
melden. Anwendung, Service- und Importrollen besitzen kein Ausfuehrungsrecht.

Dieser Schritt verarbeitet weiterhin keine echte Quelle und ist kein Chunk-
oder Bulk-Importer. Lizenzfreigabe, quellenspezifischer Parser, Gold-Fixtures,
Batch-/Resume-Semantik, PostgreSQL-Grossmengenprofilierung sowie Restore-, RLS-
und Fachabnahme bleiben offen.

## Fortschritt bis Schritt 5B-6 am 03.08.2026

Zwei owner-only Stagingtabellen binden nun eine exakte Batch-ID, den erwarteten
Gesamt- und 1 bis 64 Chunkhashes sowie die vier Gesamtzaehler. Chunks duerfen in
beliebiger Reihenfolge eintreffen, sind nach dem Insert unveraenderlich und
koennen nach einer Unterbrechung anhand der exakt gemeldeten fehlenden Indizes
fortgesetzt werden. Kumulative Payloadbytes und Komponentenzaehler werden schon
beim Staging gegen die Kleinmengengrenze geprueft. Identische Wiederholungen
schreiben nichts erneut.

Ein vollstaendiger Batch wird ausschliesslich ueber den atomaren Step-5B-5-
Writer finalisiert. Ein falscher Gesamt-Hash schreibt keine finale Zeile; die
Stagingchunks bleiben fuer Diagnose oder einen owner-seitigen terminalen
Abbruch erhalten. Danach darf eine neue Batch-ID dasselbe Ziel uebernehmen. Der
Wiki-Snapshot umfasst nun 67 Tabellen und prueft zusaetzlich
`invalid_homeopathic_chunk_imports = 0`; der Therapie-Eingabe-Snapshot bleibt
unveraendert. Die Repertoriumsregression besteht mit 37/37 Tests, der
vollstaendige Projektlauf mit 49/49 Dateien und 523/523 Tests.

Der Vertrag verarbeitet weiterhin keine echte Quelle und erbt die 4-MiB-
Kleinmengengrenze aus Schritt 5B-5. Lizenzfreigabe, quellenspezifischer Parser,
Gold-Fixtures, produktiver Bulk-Writer, PostgreSQL-Grossmengenprofilierung sowie
Restore-, RLS- und Fachabnahme bleiben offen.
