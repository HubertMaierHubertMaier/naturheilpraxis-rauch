# Wiki Schritt 4B-2b: Laborparameter und Referenzbereiche

Stand: 2026-08-02

Status: implementiert und lokal verifiziert. Kein Supabase-Deployment, kein
Backfill und keine produktive Laborinterpretation.

## Ziel und Grenze

Die additive Migration

`supabase/migrations/20260802100000_create_kb_laboratory_contract.sql`

erweitert den medizinisch inaktiven Wissensvertrag um drei leere Tabellen:

- `kb_lab_parameter_revision_details`
- `kb_lab_reference_ranges`
- `kb_lab_finding_definition_revision_details`

Vor der Anlage prueft die Migration die exakte bestehende 56-Tabellen-Grenze.
Danach umfasst der gemeinsame Wiki-Snapshot exakt 59 Tabellen.

Der Block stellt nur die reproduzierbare Wissensstruktur bereit. Nicht enthalten
sind:

- echte Laborparameter, LOINC-Seeds oder Referenzbereiche
- Ferritin- oder andere medizinische Grenzwerte
- Patientenmesswerte oder Patientenreferenzen
- ein Capture-, Import-, Such-, Vergleichs- oder Interpretations-RPC
- Einheitenumrechnung
- Anbindung an `therapy-recommend` oder sichtbare Therapieausgaben
- Release v2 oder Aktivierung des weiterhin inaktiven Release v1

## Laborparameterrevision

`kb_lab_parameter_revision_details` bindet genau eine typisierte Detailzeile an
ein exaktes Paar aus `kb_entities` und `kb_entity_revisions`. Der Entitaetstyp
muss `lab_parameter` sein.

Die Detailzeile enthaelt:

- Vertragsversion 1
- kontrollierte Material-/Probenart
- Werteart `quantity` oder `coded`
- kanonisches Einheitensystem `ucum` oder `unitless`
- kanonischen Einheitencode
- eine quellengebundene Klassifikationsaussage

Kodierte Werte sind immer `unitless/1`. UCUM-gekennzeichnete Codes durchlaufen
einen konservativen Syntaxfilter. Dieser Filter ist kein vollstaendiger UCUM-
Parser; eine spaetere Interpretation darf deshalb weiterhin nur exakt passende
Codes verwenden.

Externe Kennungen bleiben in `kb_entity_identifiers`. Alle Kennungen der
Laborparameterentitaet, einschliesslich eines optionalen LOINC-Codes, werden
jedoch in den kanonischen Revisionspayload aufgenommen. Nach Freigabe der ersten
Parameterrevision sind diese Kennungen unveraenderlich; eine andere Zuordnung
benoetigt eine neue Entitaet statt stiller historischer Umschreibung.

## Referenzbereiche

`kb_lab_reference_ranges` bindet jeden Bereich an:

- genau eine quellengebundene Klassifikationsaussage
- eine exakte, gueltige Laborparameterrevision
- eine exakte diagnostische Methodenrevision
- optional eine exakte Laborrevision
- optional eine exakte Populationsgruppenrevision
- kontrollierten Geschlechtsbezug
- optionale Altersgrenzen zwischen 0 und 130 Jahren
- eine exakte Einheit
- einen numerischen Bereich oder eine qualitative Wertemenge

Numerische Bereiche besitzen mindestens eine Grenze. Bei zwei gleichen Grenzen
muessen beide Grenzen einschliessend sein, damit keine leere Menge entsteht.
Qualitative Bereiche verwenden eine eindeutige, sortierte und begrenzte
Codemenge sowie `unitless/1`.

Es gibt absichtlich keine fachliche Eindeutigkeitsregel ueber Parameter, Methode,
Labor, Population, Alter und Geschlecht. Widerspruechliche, aber jeweils ehrlich
belegte Referenzbereiche muessen parallel darstellbar bleiben. Ein spaeterer
Leser darf bei mehreren gleich passenden Bereichen nicht willkuerlich waehlen.

Die Referenzbereichseinheit muss nicht der kanonischen Parametereinheit
entsprechen. Der Vertrag speichert den Quellenstand, fuehrt aber keine
Umrechnung durch. Ohne exakte Einheitengleichheit oder einen spaeteren
versionierten, dimensionssicheren Umrechnungsvertrag bleibt die automatische
Interpretation gesperrt.

## Befunddefinitionen

`kb_lab_finding_definition_revision_details` gibt dem bereits vorhandenen
Entitaetstyp `lab_finding_definition` eine deterministische Bedeutung. Jede
Revision bindet:

- eine exakte Laborparameterrevision
- genau einen Referenzbereich desselben Parameters
- eine Interpretation `below_range`, `within_range`, `above_range`,
  `qualitative_in_set` oder `qualitative_outside_set`
- eine eigene quellengebundene Klassifikationsaussage

`below_range` benoetigt eine untere und `above_range` eine obere Grenze.
Numerische und qualitative Interpretationen duerfen nicht vermischt werden.

Eine Befunddefinition klassifiziert nur die Lage eines Messwerts zum exakten
Bereich. Sie ist keine Diagnose. Krankheits-, Ursachen- oder Pathogenbezug bleibt
eine getrennte, quellengebundene `may_indicate`-Relation.

## Kanonische Provenienz

Die drei Vertragsebenen besitzen reproduzierbare Payload- und Hashfunktionen.
Die Payloads frieren ein:

- exakte Entitaets- und Revisionspaare
- kanonische Schluessel und alle fachlichen Revisionsfelder
- Revisionsmetadatenhashes und gespeicherte Inhalts-Hashes
- Laborparameterkennungen
- typisierte Laborfelder
- die vollstaendigen statischen Felder der Basisassertionen
- alle Quellenbindungen, Fundstellen, Zitate und Primaerflags
- die vollstaendigen statischen Felder der gebundenen Quellenrevisionen
- beim Befund den exakten Referenzbereichspayload und dessen Hash

Reviewstatus, Zeitstempel und Akteur-IDs sind nicht Teil der fachlichen Hashes.
Dadurch bleiben die Hashes bei regulaeren Reviewuebergaengen stabil, waehrend
inhaltliche oder triggerumgehende Manipulation erkannt wird.

Die Pflichtzaehler lauten:

- `invalid_lab_parameter_revisions`
- `invalid_lab_reference_ranges`
- `invalid_lab_finding_definition_revisions`

Alle drei muessen im Wiki-Snapshot numerisch 0 sein.

## Lebenszyklus und Parallelitaet

Der transaktionsendgueltige Validator verlangt passende Entitaetstypen,
vollstaendige Details, gueltige Hashes, kompatible Reviewstatus und mindestens
eine primaere unterstuetzende oder qualifizierende Quelle mit Fundstelle.

Ab `approved` sind Parameter- und Befunddetails sowie ihre Kennungen dauerhaft
unveraenderlich. Ein Referenzbereich wird ueber seine Assertion koordiniert und
ist ab deren Freigabe unveraenderlich. Released und historische Abhaengigkeiten
werden fuer neue append-only Bereiche mit Zeilensperren statt verbotenen No-op-
Updates koordiniert. Ein gemeinsamer historischer Statusuebergang bleibt in
einer Transaktion moeglich.

Constraint-Trigger pruefen die drei Tabellen sowie Aenderungen an Assertions,
Quellenbindungen, Entitaetsrevisionen, Quellenrevisionen und
Laborparameterkennungen am Transaktionsende. Sie berechnen dabei nur den vom
jeweiligen Ereignis betroffenen Parameter-, Bereichs- und Befundabschluss; die
globalen Zaehler bleiben dem Snapshot und der Integritaetspruefung vorbehalten.
Bereichs- und Befundereignisse laufen dabei nur vorwaerts zum exakten Datensatz
und seinen Befundabhaengigkeiten, nicht rueckwaerts zu fachlich unveraenderten
Geschwisterbereichen. Kernabhaengigkeiten verwenden indexierbare Teilmengen.
Auch die erste Quellenbindung einer Klassifikationsaussage erzeugt vor einer
moeglichen ersten Laborabhaengigkeit eine geordnete Assertionsversion. Die
Sperrreihenfolge vermeidet gegenseitige Kindtabellensperren; ein echter
Zwei-Session-PostgreSQL-Test bleibt trotzdem ein Pre-Deployment-Gate.

## Rollen und RLS

- Datenbankeigner: direkter, kanonischer Schreib- und Restorepfad
- Administrator: RLS-gesteuertes Lesen der drei neuen Tabellen und regulaere
  Reviewstatus-Uebergaenge in beteiligten Kernzeilen, aber keine Aenderung ihrer
  hashgebundenen Revisions-, Assertions- oder Quellenbindungsinhalte
- `service_role`: ausschliesslich Lesen und aktueller Snapshot-RPC
- Patient beziehungsweise authentifizierter Nicht-Admin: keine sichtbaren Zeilen
- `anon`, `kb_importer`, `kb_import_runtime`: kein Zugriff

Alle Payload-, Hash-, Validator-, Sperr- und Schutzfunktionen sind fuer
Anwendungs- und Importrollen widerrufen. Es existiert kein Writer-RPC.

## Backup und Restore

Browserinventar, Edge-Inventar, Fallback und Datenbank-Snapshot umfassen exakt
dieselben 59 Wiki-Tabellen.

Importreihenfolge innerhalb des neuen Blocks:

1. `kb_lab_parameter_revision_details`
2. `kb_lab_reference_ranges`
3. `kb_lab_finding_definition_revision_details`

Die drei Tabellen werden nach Kernrevisionen, Assertions und Quellenbindungen,
aber vor klinischen Regeln, Releases und Suchprojektionen geladen. Beim Leeren
gilt die umgekehrte Reihenfolge. `kb_search_documents` bleibt der letzte Import.

Der Therapie-Eingabe-Snapshot v2 bleibt byteidentisch und exakt vier Tabellen
gross. Patientenmesswerte werden weder in den Wiki-Snapshot verschoben noch mit
Wissensreferenzbereichen ueberschrieben.

## Testabdeckung

Der fokussierte Test

`src/test/wiki-phase4b-2b-laboratory-contract.test.ts`

deckt insbesondere ab:

- exakte 56-zu-59-Grenze und drei leere Tabellen
- fehlenden Backfill und Ablehnung vorbestehender typisierter Revisionen
- numerische und qualitative synthetische Buendel
- generische LOINC-Provenienz
- widerspruechliche, getrennt belegte Bereiche
- falsche Entitaetstypen und Revisionspaare
- fehlende Methode, Quelle, Fundstelle, Parameterdetail oder Bereich
- Alters-, Geschlechts-, Einheiten-, Zahlen- und Codemengengrenzen
- unmoegliche leere Intervalle und richtungslose Befunddefinitionen
- Statuskompatibilitaet und permanente Freigabeunveraenderlichkeit
- append-only Wachstum auf released Abhaengigkeiten
- gemeinsame historische Statusuebergaenge
- triggerumgehende Parameter-, Kennungs-, Quellen-, Methoden-, Bereichs- und
  Befundmanipulation
- Owner-only Write einschliesslich beteiligter Kerninhalte, erlaubte
  Admin-Reviewuebergaenge, RLS, Rollen, Funktionsrechte und Truncate-Sperre
- Versionsperre vor der ersten Laborabhaengigkeit und ereignisbezogene
  Validierung ohne globale Vertragsscans oder Geschwisterbereichs-Fan-out
- 59-Tabellen-Export und texttreuen Owner-Restore
- byteidentischen Vier-Tabellen-Therapie-Snapshot v2
- statischen Ausschluss produktiver Laborleser, Writer und Umrechnung

## Restrisiken und Pre-Deployment-Gates

- PGlite ersetzt keinen realen PostgreSQL-Test fuer Sperren, Deadlocks und
  `REPEATABLE READ`-Serialisierung.
- Ein mehrzeiliger Import vieler Bereiche mit gemeinsamem Parameter und
  gemeinsamer Methode muss vor Deployment auf realem PostgreSQL mit
  `EXPLAIN (ANALYZE, BUFFERS)` profiliert werden.
- Der UCUM-Syntaxfilter ersetzt keinen vollstaendigen Terminologieserver.
- Patienteneingaben binden derzeit noch keine exakte Methode, Laborrevision,
  Probenart oder Wissensrevision; automatische Interpretation bleibt deshalb aus.
- Null passende Bereiche fuehren spaeter zu Review, nicht zu einem geratenen
  Universalbereich. Mehrere gleich passende Bereiche bleiben mehrdeutig.
- Patientenseitig berichtete Referenzgrenzen bleiben eigene Quellenwerte und
  duerfen nicht durch den Wissensbereich ueberschrieben werden.
- Ein echter Supabase-/PostgREST-RLS-Test, Browser-/Edge-ZIP-Export und isolierter
  Owner-Restore sind vor Deployment erforderlich.
- Release v1 friert diese neuen Detailpayloads nicht als Retrievalvertrag ein und
  bleibt deshalb weiterhin `retrieval_eligible = false` und `is_active = false`.
