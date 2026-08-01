# Wiki Phase 3.5: Knowledge-Release-Vertrag

Stand: 2026-08-01

Status: Schritt 4A ist lokal implementiert und verifiziert. Es gibt kein
Supabase-Deployment, keinen Backfill, keinen Commit und keinen Push.

## Ziel und Grenze

Die Migration

`supabase/migrations/20260801090000_create_kb_release_contract.sql`

definiert einen strikt schema-only und medizinisch inaktiven Vertrag fuer
zukuenftige, reproduzierbare Wissensstaende. Sie fuegt genau zwei Tabellen hinzu:

1. `kb_releases`
2. `kb_release_items`

Die Migration erzeugt keine Release-Datensaetze. Sie enthaelt keinen Import,
keinen Backfill, keinen Schreib-RPC, keinen Live-Writer und keine Verbindung zu
Retrieval, Therapieempfehlung, Patientenworkflow oder sichtbarer Ausgabe.

Vor dem Anlegen der Tabellen wird die exakte bestehende 50-Tabellen-Wiki-Grenze
geprueft. Nach erfolgreicher Migration umfasst der gemeinsame Wiki-Vertrag
exakt 52 Tabellen.

## Release-Zustand

`kb_releases` kennt nur:

- `build`: direkte Zusammenstellung innerhalb der Datenbankeigner-Grenze
- `sealed`: unveraenderlicher historischer Wissensstand

Release-Vertrag und Manifestversion sind fest auf v1 begrenzt. Die
Datenklassifikation ist fest `general_knowledge`.

Weil Dosierungs- und Sicherheitsregelmodelle noch fehlen, gelten zwei harte
Checks:

- `retrieval_eligible` ist immer `false`
- `is_active` ist immer `false`

Damit kann ein v1-Release weder versehentlich aktiviert noch als Grundlage fuer
produktives Retrieval markiert werden. Eine Aktivierungsfunktion existiert
nicht.

## Typisierte Items

Ein `kb_release_items`-Datensatz bindet genau eine der folgenden Referenzen:

- `entity_id` und `entity_revision_id`
- `article_id` und `article_revision_id`
- `assertion_id`
- `source_id` und `source_revision_id`

Paarigkeitschecks, zusammengesetzte Fremdschluessel und eine arithmetische
Exactly-one-Regel erzwingen eine und nur eine Referenzgruppe. `item_kind` muss
mit dieser Gruppe uebereinstimmen. Partielle eindeutige Indizes verhindern, dass
dieselbe Wissensrevision doppelt gebunden wird. Fuer Entity-Items gilt strenger:
Pro Release darf jede `entity_id` nur einmal vorkommen. Damit koennen Artikel-,
Relations- und therapeutische Abhaengigkeiten nicht mehrdeutig auf zwei
gleichzeitig freigegebene Revisionen derselben Entitaet zeigen.

Es gibt keine freie Tabellen-/Objekttyp-Spalte und keine untypisierte EAV-ID.

## Kanonische Manifeste

Jedes Item besitzt ein kanonisches `item_manifest` v1 und einen SHA-256-Hash.
Das Release besitzt ein geordnetes `release_manifest`, das alle Item-IDs,
Reihenfolgen, typisierten Referenzen, Item-Manifeste und Item-Hashes bindet.

Die kanonische JSONB-Funktion ordnet Objektschluessel deterministisch und
normalisiert Zahlen. Mengenartige Daten werden bereits beim Aufbau in stabiler
Reihenfolge aggregiert. Zeitpunkte werden als Epochentext eingefroren. Der
Wiki-Snapshot setzt ausserdem innerhalb der Exportfunktion die Zeitzone fest auf
UTC und sortiert JSON-Zeilen mit `COLLATE "C"`, damit Darstellung und
Tabellenhashes nicht von Sitzungszeitzone oder Datenbanklocale abhaengen.

Entity-Items frieren insbesondere ein:

- Entitaetstyp und kanonischen Schluessel
- exakte Revision, Inhalts-Hash und redaktionellen Inhalt
- alle damaligen Namen in kanonischer Reihenfolge
- alle damaligen Identifikatoren in kanonischer Reihenfolge
- kanonischen therapeutischen Revisionshash
- exakte Revisions- und Assertion-Abhaengigkeiten

Spaetere Aenderungen an lebenden Namen oder Identifikatoren schreiben das
versiegelte Manifest nicht um und machen den historischen Release nicht zu einem
anderen Wissensstand. Alle anderen eingefrorenen Revisionsinhalte werden weiter
gegen das Kernwissen validiert. Zulaessige spaetere Statuswechsel auf
`superseded` oder `withdrawn` veraendern den historischen Manifeststatus
`released` nicht.

Die Projektionen enthalten keine Akteurspalten und keine freie Release-Metadaten-
JSON-Struktur. Patienten-, Benutzer-, Sitzungs-, Anamnese- oder Pseudonym-IDs
haben weder Spalten noch Fremdschluessel in diesem Vertrag.

Revisions-Metadaten werden nicht in das Manifest kopiert. Ihr kanonischer
SHA-256-Hash wird jedoch gebunden, damit auch eine reine Metadatenmanipulation
erkannt wird, ohne darin enthaltene technische oder Akteur-IDs zu duplizieren.

## Seal-Invarianten

Der verzoegerte Seal-Trigger akzeptiert den Uebergang nur, wenn alle Items zum
Transaktionsende exakt `released` sind und der gesamte Graph geschlossen ist.

Fuer jede Assertion gilt:

- mindestens eine primaere Quelle mit Rolle `supports` oder `qualifies`
- nichtleere Fundstelle
- jede solche exakte Quellenrevision ist selbst Release-Item und `released`
- bei `entity_relation` existiert die konkrete `kb_entity_relations`-Kante
- beide Relationsendpunkte besitzen je ein exaktes freigegebenes Entity-Item
- Relation und Assertion-Kind stimmen genau ueberein; Nicht-Relationsaussagen
  duerfen auch nach einem triggerumgehenden Owner-Restore keine Graphkante tragen
- Relationstyp, freigegebene Typdomain und kanonische Reihenfolge symmetrischer
  Relationen werden beim Seal und im Integritaetszaehler erneut geprueft; die
  Reihenfolge nutzt den nativen, kollationsunabhaengigen UUID-Vergleich

Fuer jede Artikelrevision gilt:

- jede Zeile aus `kb_article_entities` ist durch eine exakte freigegebene
  Entity-Revision im Release abgedeckt

Fuer therapeutische Entity-Revisionen gilt:

- `kb_therapeutic_revision_is_valid(...)` muss erfolgreich sein
- Produkt-, Zubereitungs- und Komponentenrevisionen sind exakt enthalten
- Basisassertionen aller fuenf Detailtabellen und aller Komponenten sind
  enthalten
- dieselben Regeln werden auf jedes enthaltene Abhaengigkeits-Item erneut
  angewandt; damit ist die Closure transitiv

Ein Release ohne Items, mit Draft-/Approved-Objekten, fehlender Primaerquelle,
fehlendem Relationsendpunkt, fehlender therapeutischer Abhaengigkeit oder
abweichendem Manifest schlaegt geschlossen fehl.

## Owner-only Build und Append-only

Es gibt bewusst keine aufrufbare Schreibschnittstelle. Der spaetere kontrollierte
Build muss als Tabellenbesitzer in einer Transaktion erfolgen:

1. Build-Release mit seinem kanonischen leeren Manifest anlegen.
2. Typisierte Items mit den read-only Manifest-/Hashfunktionen anlegen.
3. Release-Manifest aus der finalen geordneten Item-Menge berechnen.
4. In demselben Owner-Kontext auf `sealed` setzen und `sealed_at` setzen.
5. Verzoegerte Constraints vor dem Commit sofort pruefen.

Die Manifestfunktionen schreiben keine Daten und sind fuer Anwendungsrollen
nicht ausfuehrbar. Direkte Tabellenwrites sind nur dem Datenbankeigner moeglich.

Nach dem Seal werden alle Release-Updates und alle Item-Updates abgelehnt.
Deletes und Truncates sind fuer Build- und Seal-Zeilen gesperrt. Jeder Item-Write
erzeugt bewusst eine neue Parent-Zeilenversion. Dadurch sieht ein konkurrierender
Seal entweder das Item oder bricht mit einem Serialisierungsfehler ab; auch ein
bereits gestarteter `REPEATABLE READ`-Snapshot kann kein Item still aus dem
Release-Manifest auslassen.

## Integritaetszaehler

`kb_invalid_knowledge_release_count()` prueft jeden versiegelten Release erneut:

- Release- und Item-Hashkette
- exakte kanonische Manifeststruktur
- Wissensobjekt und historischen Reviewstatus
- therapeutische Hash- und Closure-Regeln
- Assertionsquellen und Relationsabdeckung
- Artikelabhaengigkeiten
- verwaiste Items

Der Wiki-Snapshot liefert das Ergebnis als `invalid_knowledge_releases`. Edge
und Browser akzeptieren den Snapshot nur bei exakt `0`. Der RPC liefert fuer jede
Tabelle zusaetzlich den exakt gehashten JSON-Text in `serialized_tables`. Edge und
Browser berechnen dessen SHA-256 selbst und vergleichen ihn mit dem Manifest;
eine Inhaltsaenderung bei gleicher Zeilenzahl und formal gueltigem Hash wird
abgelehnt. Ein weiterer Test manipuliert ein Item bei deaktiviertem User-Trigger
und berechnet sogar seinen lokalen Hash neu; die uebergeordnete Manifestkette und
der semantische Validator erkennen die Abweichung weiterhin.

Wie bei jedem rein datenbankinternen Hashvertrag bleibt der Datenbankeigner die
Vertrauensgrenze. Eine absichtliche vollstaendige Neuschreibung aller Inhalte und
Hashes durch einen privilegierten Eigner kann nur durch den extern aufbewahrten
Snapshot-/Backup-Hashvergleich nachgewiesen werden.

## Rollen und RLS

- Administrator: RLS-gesteuertes `SELECT`, keine direkte Mutation
- Patient beziehungsweise authentifizierter Nicht-Admin: null sichtbare Zeilen
- `anon`: kein Zugriff
- `service_role`: `SELECT` und bestehender Wiki-Snapshot-RPC, keine Mutation
- `kb_importer`: kein Zugriff
- `kb_import_runtime`: kein Zugriff

Alle Hilfs-, Trigger- und Validatorfunktionen sind fuer diese Rollen widerrufen.
Nur `kb_export_wiki_snapshot()` bleibt fuer `service_role` ausfuehrbar.

## Backup und Restore

Folgende Flaechen enthalten jetzt dieselben 52 Wiki-Tabellen:

- Browserinventar in `src/lib/backupAreas.ts`
- Edge-Inventar, Fallback und OpenAPI-Ergaenzung
- Datenbank-Snapshot und Snapshotmanifest
- Teilbackup- und Vollbackup-Restoreanleitung

Das Wiki-Teilbackup wird nicht nur am Edge, sondern vor dem ZIP-Aufbau nochmals
im Browser fail-closed validiert: exakte Tabellen- und Manifestmenge,
Zeilenzahlen, der SHA-256 des unveraenderten serialisierten Tabelleninhalts und
alle acht Nullzaehler sind Pflicht. Der exakte Text wird ohne
`JSON.parse`/`JSON.stringify`-Rundreise in das Backup geschrieben. Das
Therapie-Teilbackup fordert den Wiki-Snapshot nicht mehr allein wegen der dort
zusaetzlich enthaltenen Produkttabelle an; ein ungueltiger Knowledge-Release
blockiert damit weiterhin Wiki- und Vollbackup, aber nicht den eigenstaendigen
Therapie-Input-Snapshot v2.
Da der Wiki-Bereich keine Storage-Buckets besitzt, lehnt der Browser fuer dieses
Teilbackup ausserdem jedes unerwartete Storage-Objekt ab, bevor signierte URLs
geladen oder in das ZIP aufgenommen werden.

Beim Owner-Restore werden zuerst die drei `current_revision_id`-Zeiger geloest.
Anschliessend werden die 52 Wiki-Tabellen mit `DELETE` in umgekehrter
Fremdschluesselreihenfolge geleert, `kb_release_items` vor `kb_releases`.
`TRUNCATE` ist hier unzulaessig, weil `therapy_input_facts.kb_entity_id` die
Wiki-Entitaeten ausserhalb des 52-Tabellen-Snapshots ueber einen
`NO ACTION DEFERRABLE`-Fremdschluessel referenzieren kann. Die Therapie-Fakten bleiben
unangetastet; dieselben Entity-UUIDs werden vor `SET CONSTRAINTS ALL IMMEDIATE`
wieder eingespielt. Beim Import wird `kb_releases` erst nach den Kernobjekten geladen;
`kb_release_items` folgt zuletzt nach Entity-, Artikel-, Assertion-, Quellen- und
therapeutischen Abhaengigkeiten. Danach muessen alle Trigger wieder aktiv sein,
`SET CONSTRAINTS ALL IMMEDIATE` erfolgreich sein, alle acht fail-closed
Wiki-Zaehler 0 liefern und alle 52 Tabellenhashes exakt dem Backup entsprechen.
Dieselben Schritte einschliesslich des vorherigen Nullsetzens aller drei
`current_revision_id`-Zeiger stehen sowohl in der Teilbackup- als auch in der
Vollbackup-Restoreanleitung.

Die Migrationen und Definitionen der Therapie-Input-Snapshots v1 und v2 wurden
nicht geaendert. Snapshot v2 bleibt exakt auf
`therapy_input_revisions`, `therapy_input_sources`, `therapy_input_facts` und
`therapy_input_fact_sources` begrenzt. Der Restore-Test haelt eine gueltige
Therapie-Faktzeile mit `kb_entity_id` waehrend des vollstaendigen Wiki-Loeschens
und -Reimports aufrecht und weist einen byteidentischen Snapshot v2 davor und
danach nach.

## Verifikation

Der fokussierte PGlite-Test

`src/test/wiki-phase3-5-knowledge-release-contract.test.ts`

deckt ab:

- exakte 50-zu-52-Tabellengrenze und leere Migration
- Exactly-one-Referenzen und permanente v1-Inaktivitaet
- hoechstens eine exakte Revision je Entitaet und Release
- transitive therapeutische Closure
- primaere Quellen und Relationsendpunkte
- leere Primaerfundstellen sowie inaktive Relationstypen, unfreigegebene
  Typdomains und falsch geordnete symmetrische Kanten nach Triggerumgehung
- Artikel-Entity-Abhaengigkeiten
- eingefrorene Namen und Identifikatoren
- Append-only, Delete-/Truncate-Sperre und Manipulationserkennung
- zeitzonenunabhaengige Snapshotbytes und -hashes
- Admin-, Patienten-, Service-, Anonym- und beide Importrollen sowie entzogene
  Hilfsfunktionsrechte
- exakte, duplikatfreie 52-Tabellen-Inventare in Datenbank, Edge und Browser
- Export und transaktionalen Restore aller 52 Tabellen bei bestehendem externen
  Therapie-Fremdschluessel
- unveraenderte Vier-Tabellen-Grenze des Therapie-Input-Snapshots v2
- Browser-Ablehnung unvollstaendiger, inkonsistenter oder inhaltlich nicht zum
  SHA-256 passender HTTP-200-Wiki-Payloads

Abschlussgates am 01.08.2026:

- 39/39 direkte Release- und Wiki-Backup-Tests
- 54/54 fokussierte Tests einschliesslich der Phase-1-Quervertraege
- 436/436 Tests in der vollstaendigen Projektsuite
- `npm exec -- tsc -p tsconfig.app.json --noEmit` ohne Fehler
- `npm exec -- tsc -p tsconfig.node.json --noEmit` ohne Fehler
- `npx -y deno check supabase/functions/backup-export/index.ts` ohne Fehler
- gezielter ESLint-Lauf der geaenderten TypeScript-Dateien ohne Fehler
- der repositoryweite ESLint-Lauf bleibt mit 397 bereits ausserhalb von 4A
  verteilten Altfehlern rot; keine davon liegt in den geaenderten 4A-Dateien
- Produktionsbuild erfolgreich; nur die bekannten Hinweise zu Browserslist,
  Bluebird-`eval` und grossen Chunks

Die lokale PGlite-Testdatenbank arbeitet technisch nur mit einer Verbindung.
Der konkurrierende `REPEATABLE READ`-Ablauf ist deshalb strukturell ueber die
erzwungene Parent-Zeilenversion abgesichert, kann lokal aber erst mit zwei echten
PostgreSQL-Sessions verhaltensbasiert nachgestellt werden. Docker, `psql` und ein
Remote-Datenbankzugang stehen in dieser Arbeitsumgebung nicht zur Verfuegung.

## Bewusste Grenzen

- keine Release-Datensaetze und kein Backfill
- kein Schreib-RPC und kein Live-Writer
- keine Dosierungs- oder Sicherheitsregeltabellen
- kein aktives oder retrieval-faehiges Release v1
- keine Search-Projektion oder Embeddings
- keine produktive Therapie-, Patienten- oder Retrievalnutzung
- kein Deployment, Commit oder Push
