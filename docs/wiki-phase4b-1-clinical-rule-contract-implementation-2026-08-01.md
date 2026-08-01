# Wiki Schritt 4B-1: Klinischer Regelvertrag

Stand: 2026-08-01

Status: lokal implementiert und verifiziert. Es gibt kein Supabase-Deployment
und keinen Backfill.

## Ziel und harte Grenze

Die Migration

`supabase/migrations/20260801100000_create_kb_clinical_rule_contract.sql`

erweitert den medizinisch inaktiven Wissensvertrag um genau drei leere Tabellen:

1. `kb_dosage_rules`
2. `kb_safety_rules`
3. `kb_safety_rule_conditions`

Vor der Anlage prueft die Migration die exakte bestehende 52-Tabellen-Grenze.
Danach umfasst der gemeinsame Wiki-Snapshot exakt 55 Tabellen. Die Migration
enthaelt keine Regelzeile, keinen Seed, keinen Backfill, keine
Kandidatenpromotion und keinen Writer-RPC.

Nicht Bestandteil von 4B-1 sind:

- Suchprojektion oder Embeddings
- Labortabellen oder automatische Laborinterpretation
- ein Release-v2-Vertrag
- Aktivierung oder Retrieval-Faehigkeit von Release v1
- Verbindung zu Therapieempfehlung, Patientenworkflow oder sichtbarer Ausgabe
- produktive Auswertung der Bedingungen

`kb_releases.contract_version = 1` bleibt unveraendert. Die bestehenden Checks
erzwingen weiterhin fuer jede v1-Zeile `retrieval_eligible = false` und
`is_active = false`.

## Dosierungsregeln

Jede `kb_dosage_rules`-Zeile bindet genau eine vorhandene `dosage`-Assertion.
Die Assertion bleibt die redaktionelle und quellengebundene Wissensaussage; die
Regelzeile enthaelt nur den deterministischen strukturierten Vertrag.

Gebunden werden:

- genau eine Subject-Entity mit ihrer exakten Revision
- optional eine Indikations-Entity mit ihrer exakten Revision
- optional eine Populations-Entity mit ihrer exakten Revision
- die ueber `kb_assertion_sources` gebundenen exakten Quellenrevisionen

Zulaessige Subjects sind bewusst nur `preparation` und `product_variant`.
Indikationen sind auf `symptom`, `disease` und `lab_finding_definition`
begrenzt; Populationen muessen `population_group` sein. Zusammengesetzte
Fremdschluessel verhindern, dass eine Revision mit der falschen Entity-ID
kombiniert wird.

Die Dosis besitzt positive Unter- und Obergrenzen. Obergrenzen und explizite
Wertebereiche schliessen `NaN` sowie technisch unbegrenzte Operanden aus. Die
Einheit wird als kontrolliertes `ucum`- oder `local_v1`-Paar gespeichert.
Frequenz und Dauer besitzen positive strukturierte Bereiche und kontrollierte
Perioden beziehungsweise Einheiten. Timing und Administrationsroute sind feste
Vokabulare. Bei einer `preparation` muss die Route in der exakten
`kb_preparation_revision_details`-Revision enthalten sein; bei einer
`product_variant` wird die Route aus der exakt gebundenen Zubereitungsrevision
geprueft.

Es gibt keine freie Dosierungs-, Anwendungs- oder Metadaten-JSON.

## Sicherheitsregeln

Jede `kb_safety_rules`-Zeile bindet genau eine vorhandene `safety`-Assertion und
eine exakte therapeutische Subject-Revision. Nur `interaction` darf und muss eine
zweite exakte Entity-Revision besitzen. Andere Safety-Kontexte werden ueber die
typisierten Bedingungen ausgedrueckt, nicht ueber eine mehrdeutige Related-ID.

`rule_type` und `severity` verwenden exakt die bereits in
`kb_safety_candidates` kontrollierten Werte. Der maschinenwirksame Effekt ist
nicht frei waehlbar, sondern durch einen Check vollstaendig aus dem Schweregrad
abgeleitet:

| Severity | Effect |
|---|---|
| `information` | `allow_with_notice` |
| `caution` | `review_only` |
| `require_review` | `review_only` |
| `avoid` | `exclude` |

`notice_text` ist nur die nichtleere, gehashte menschliche Erlaeuterung. Er ist
kein auswertbares Predicate.

## AND-Bedingungen

`kb_safety_rule_conditions` kennt nur:

- `always`
- `entity_present`
- `fact_present`
- `fact_missing`
- `coded_value_in`
- `quantity_compare`

Es gibt weder Gruppen noch OR-/NOT-Operatoren. Mehrere Zeilen einer Regel sind
per Definition eine geordnete AND-Menge. `condition_order` muss lueckenlos bei 1
beginnen.

Jeder Typ besitzt eine Exactly-one-Form:

- `always`: kein Operand
- `entity_present`: genau ein exaktes Entity-/Revisionspaar
- `fact_present` und `fact_missing`: genau `fact_type` und `fact_key`
- `coded_value_in`: Faktpaar, kontrolliertes Codesystem und eine nichtleere,
  sortierte, duplikatfreie Codeliste
- `quantity_compare`: Faktpaar, Comparator, begrenzter numerischer Wert sowie
  kontrolliertes Einheitssystem und Einheit

Sobald `always` vorkommt, muss es die einzige Bedingung der Regel sein. Ein
Safety-Vertrag ohne Bedingung ist unvollstaendig. `fact_key` darf keine
Patienten-, Nutzer-, Sitzungs-, Pseudonym- oder Anamnese-ID-Domaene benennen.
Die Tabellen besitzen keine entsprechende ID-Spalte und keine JSON-Spalte.

## Quellen und Reviewstatus

Die Regeln duplizieren keinen eigenen Reviewakteur. Ihr Status ist der bereits
vorhandene Reviewstatus der exakt gebundenen Assertion. Dadurch gibt es keine
zweite, divergierende Freigabewahrheit und keine neue Nutzer-ID.

Jede Regelassertion benoetigt mindestens eine primaere Quelle mit Rolle
`supports` oder `qualifies` und nichtleerer Fundstelle. Alle gebundenen
Quellenrevisionen muessen zum Assertionstatus passen:

- vor `approved`: nicht historisch
- bei `approved`: `approved` oder `released`
- bei `released`: exakt `released`
- historisch: `released`, `superseded` oder `withdrawn`

Dieselbe Statusmatrix gilt fuer Subject-, Indikations-, Populations-, Related-
und Condition-Entity-Revisionen. Therapeutische Subjects muessen zusaetzlich den
bestehenden vollstaendigen therapeutischen Revisionsvertrag erfuellen.

## Kanonischer Inhalts-Hash

`rule_content_hash` ist der SHA-256 eines mit den bestehenden 4A-Konventionen
kanonisierten JSONB-Payloads. Zahlen werden normalisiert und Objektschluessel
deterministisch geordnet.

Der Dosierungs-Payload bindet:

- Assertion-Key, Version, Claim, Evidenz, Gueltigkeit, Kernhash und Metadatenhash
- alle Quellenbindungen einschliesslich Rolle, Fundstelle, Zitat und Primaerflag
- exakte Subject-, Indikations- und Populationsrevision samt Entity-Typ, Key,
  Revisionsnummer und Inhalts-Hash
- alle Dosis-, Frequenz-, Dauer-, Timing- und Routefelder

Der Safety-Payload bindet zusaetzlich Regeltyp, Schweregrad, Effekt,
Hinweistext und jede Bedingung in kanonischer Reihenfolge. Entity-Bedingungen
binden ebenfalls die exakte Revisionsidentitaet und deren Inhalts-Hash.

Der Hash laesst weder Erstellungszeit noch Akteur-IDs einfliessen. Die Tabellen
besitzen keine Patienten-, Nutzer-, Sitzungs-, Anamnese- oder Pseudonym-IDs.

## Transaktionsendgueltige Vollstaendigkeit

Verzoegerte Constraint-Trigger pruefen am Transaktionsende:

- jede `dosage`-Assertion besitzt genau eine gueltige Dosierungsregel
- jede `safety`-Assertion besitzt genau eine gueltige Sicherheitsregel
- Assertion-Kind und Regeltabelle stimmen ueberein
- alle Entity-/Revisionspaare, Typen, Routen und Status sind gueltig
- Quellenclosure und Fundstellen sind vollstaendig
- Safety-Bedingungen sind lueckenlos, formgueltig und `always`-exklusiv
- gespeicherter und neu berechneter kanonischer Hash stimmen exakt ueberein

Dadurch darf ein Owner die Assertion, ihre Quelle, die Regel und ihre
Bedingungen in beliebiger sinnvoller Reihenfolge innerhalb derselben Transaktion
aufbauen. Ein partieller Zustand kann nicht committen. Die Abschlusspruefung
vertraut auf keinen sitzungs- oder nutzersteuerbaren Marker und bleibt auch bei
bereits auf `IMMEDIATE` gesetzten Constraints fail-closed.

Die Snapshotzaehler `invalid_dosage_rules` und `invalid_safety_rules` wiederholen
dieselbe Pruefung fail-closed und erkennen auch triggerumgehende Restore- oder
Owner-Manipulationen.

## Unveraenderlichkeit und Nebenlaeufigkeit

Direkte DML auf den drei Tabellen prueft zusaetzlich zur Rechtevergabe den
tatsaechlichen Tabellenbesitzer. Ab `approved` sind Regel und Bedingungen
unveraenderlich. Quellenbindungen werden dann ebenfalls gesperrt. Eine
Regelassertion kann nach `approved` nicht mehr auf `draft` zurueckgesetzt werden;
nur die bestehenden inhaltsschonenden Statusuebergaenge bleiben moeglich.

Regel-, Bedingungs- und Quellenwrites sperren in stabiler Reihenfolge die
betroffenen Quellen- und Entity-Revisionen. Fuer jede neue oder umgebundene
Revisionskante erzeugen sie zusaetzlich eine echte Zeilenversion der stabilen
`kb_entities`- beziehungsweise `kb_sources`-Elternzeile. Anschliessend erzeugen
sie durch ein wertgleiches Update eine neue Version der Regelassertion. Direkte
Aenderungen an Entity-/Quellenrevisionen und therapeutischen Details versionieren
dieselben Elternzeilen und alle bereits sichtbaren, noch nicht historischen
Regelassertionen. Dadurch wird auch die Phantomreihenfolge abgedeckt, in der ein
aelterer Snapshot eine gerade neu eingefuegte Kante noch nicht sehen kann.
Anders als eine reine `FOR UPDATE`-Sperre zwingen diese Zeilenversionen einen
bereits gestarteten `REPEATABLE READ`-Writer zum Serialisierungsabbruch. Safety-
Bedingungen sperren zusaetzlich ihre Parent-Regel. Sechs nach Revisions-ID
fuehrende Indizes halten die Rueckwaertssuche waehrend dieser Sperrphase
begrenzt. Ein paralleler Build beziehungsweise eine parallele Freigabe sieht
dadurch den anderen Write oder endet mit einem Serialisierungs-/Deadlock-Retry;
beide Transaktionen koennen keinen gemeinsam ungueltigen Endzustand committen.

PGlite stellt lokal nur eine Datenbanksession bereit. Deshalb ist folgender Test
mit zwei echten PostgreSQL-Sessions verbindliches Pre-Deployment-Gate:

1. Session A startet `REPEATABLE READ`, liest eine Draft-Regel und bereitet die
   Freigabe vor.
2. Session B fuegt parallel eine Safety-Bedingung beziehungsweise eine neue
   primaere Quellenbindung ein und aktualisiert den kanonischen Regelhash.
3. Session A und B versuchen in beiden Commit-Reihenfolgen zu committen.
4. Genau einer der Writes wird vollstaendig sichtbar oder eine Session muss mit
   `40001` beziehungsweise erkanntem Deadlock wiederholt werden; kein Snapshot
   darf danach einen Invalid-Zaehler ungleich 0 liefern.
5. Dasselbe wird fuer eine parallele Subject-Revisions-/Routenaenderung und fuer
   eine Quellenrevisions-Statusaenderung wiederholt.
6. Nach jedem Ablauf muessen beide Invalid-Zaehler 0 und alle User-Trigger aktiv
   sein.

Ohne dieses echte Mehrsession-Gate darf die Migration nicht ausgerollt werden.

## Rollen, RLS und Truncate

- Datenbankeigner: direkte, transaktionale DML fuer Aufbau und Owner-Restore
- Administrator: RLS-gesteuertes `SELECT`, keine DML
- authentifizierter Nicht-Admin: null sichtbare Zeilen
- `service_role`: `SELECT` und gemeinsamer Snapshot-RPC, keine DML
- `anon`: kein Zugriff
- `kb_importer`: kein Zugriff
- `kb_import_runtime`: kein Zugriff

Alle Payload-, Hash-, Integritaets- und Triggerfunktionen sind fuer
Anwendungsrollen widerrufen. Alle drei Tabellen besitzen eine explizite
`BEFORE TRUNCATE`-Sperre. Ein Restore darf sie nur als Datenbankeigner innerhalb
des dokumentierten Gesamttransaktionsvertrags mit pausierten User-Triggern
reimportieren.

## Backup und Restore

Browserinventar, Edge-Inventar, Fallback, OpenAPI-Ergaenzung und Datenbank-RPC
enthalten exakt dieselben 55 Wiki-Tabellen. Der RPC liefert pro Tabelle:

- die JSONB-Zeilen
- den exakten serialisierten JSON-Text
- Zeilenzahl und SHA-256 dieses exakten Texts

Edge und Browser lehnen fehlende, zusaetzliche, neu serialisierte oder falsch
gehashte Tabellen ab. Beide neuen Invalid-Zaehler muessen exakt numerisch 0 sein.

Beim Owner-Restore folgen `kb_dosage_rules` und `kb_safety_rules` auf
Assertionsquellen und therapeutische Details. `kb_safety_rule_conditions` folgt
ihren Parent-Regeln. Beim Leeren gilt die umgekehrte Reihenfolge. Release v1 wird
nicht mit den Regeln verknuepft; `kb_releases` und `kb_release_items` behalten
ihre 4A-Reihenfolge.

`therapy_input_facts.kb_entity_id` bleibt als externe `NO ACTION DEFERRABLE`-FK
bestehen. Deshalb wird der Wiki-Bestand weiterhin nie mit `TRUNCATE` oder
fachfremdem `CASCADE` geleert. Der PGlite-Restore-Test haelt eine reale externe
Entity-Referenz, reimportiert alle 55 Wiki-Tabellen und weist danach ein exakt
gleiches Wiki-Manifest nach.

Der Therapie-Input-Snapshot v2 wurde weder in Migration noch Validator oder
Inventar geaendert. Er umfasst weiterhin exakt vier Tabellen. Sein gesamter
serialisierter Rueckgabestring ist vor und nach dem 55-Tabellen-Wiki-Restore
byteidentisch.

## Testabdeckung

Der fokussierte Test

`src/test/wiki-phase4b-1-clinical-rule-contract.test.ts`

deckt ab:

- exakte 52-zu-55-Grenze und drei leere Tabellen
- keine Seeds, Writer, produktive Leser oder Therapiepfadreferenzen
- Assertion-Kinds, exakte Revisionspaare und zulaessige Entity-Typen
- primaere Quellen, Fundstellen und Statusclosure
- positive Dosisbereiche und kontrollierte Dosisfelder
- deterministische Safety-Effekte
- Exactly-one-Bedingungsformen, AND-Reihenfolge und `always`-Exklusivitaet
- kanonische Vollhashes und triggerumgehende Manipulationserkennung
- Unveraenderlichkeit ab `approved`
- echte Entity-, Quellen- und Assertion-Zeilenversionen fuer bekannte und neue
  konkurrierende Abhaengigkeitskanten
- fail-closed Verhalten bei bereits auf `IMMEDIATE` gesetzten Constraints
- nach Revisions-ID fuehrende Indizes fuer alle Regel-Rueckwaertssuchen
- Owner-only DML, RLS-/Rollenmatrix und Truncate-Sperren
- exakte, duplikatfreie Browser-/Edge-/Fallback-/RPC-Inventare
- serialisierte Tabellenhashvalidierung
- Owner-Restore aller 55 Tabellen mit externer Entity-FK
- byteidentischen Vier-Tabellen-Snapshot v2
- historische Isolation der 4A-Grenze von 50 auf 52

## Verifikation

Abschlussgates am 01.08.2026:

- 12/12 direkte 4B-1-PGlite- und statische Vertragstests
- 73/73 fokussierte Regel-, Release-, Snapshot- und Backup-Vertragstests
- 448/448 Tests in der vollstaendigen Projektsuite
- `npm exec -- tsc -p tsconfig.app.json --noEmit` ohne Fehler
- `npm exec -- tsc -p tsconfig.node.json --noEmit` ohne Fehler
- gezielter ESLint-Lauf aller geaenderten TypeScript-/TSX-Dateien ohne Fehler
- `npx -y deno check supabase/functions/backup-export/index.ts` ohne Fehler
- Produktionsbuild erfolgreich; nur die bekannten Browserslist-, Bluebird- und
  Chunkgroessenhinweise
- `git diff --check` sowie separate Checks der drei neuen, noch ungetrackten
  Dateien ohne Whitespace-Fehler; nur die bekannten Windows-LF/CRLF-Warnungen
- unabhaengiges Abschlussreview nach Behebung der MVCC-Befunde: `APPROVE`, keine
  P0-/P1-Befunde

Docker, `psql` und Supabase-CLI sind in der lokalen Arbeitsumgebung nicht
installiert. Der oben dokumentierte echte Mehrsessionstest konnte deshalb nicht
lokal ausgefuehrt werden und bleibt ein ausdrueckliches Pre-Deployment-Gate.

## Bewusste Restrisiken

- Der Datenbankeigner bleibt die Vertrauensgrenze. Eine absichtliche konsistente
  Neuschreibung von Inhalt und allen Hashes kann nur mit dem extern aufbewahrten
  Snapshotmanifest erkannt werden.
- Das echte Zwei-Session-Verhalten ist lokal nicht ausfuehrbar und bleibt ein
  verbindliches Pre-Deployment-Gate.
- Die verzoegerten Row-Events wiederholen derzeit die beiden globalen
  Integritaetszaehler. Vor einem groesseren Regel-Backfill muss dieses Verhalten
  auf echtem PostgreSQL profiliert und gegebenenfalls durch einen nicht vom
  Aufrufer manipulierbaren Transaktions-Queue-Vertrag ersetzt werden.
- Die koordinierenden Parent-Updates erzeugen absichtlich neue Zeilenversionen
  und aktivieren dadurch die vorhandenen `updated_at`-Trigger von `kb_entities`
  und `kb_sources`. Diese nachvollziehbare Aenderungsaktivitaet kann bei grossen
  Regelimporten Change-Feed- und Zeitstempelrauschen erzeugen.
- Es existieren noch keine medizinisch geprueften Regeln. Der Vertrag beweist nur
  Struktur, Herkunft, Reviewclosure und Reproduzierbarkeit.
- Search-Projektion, Labormodell und produktives Retrieval bleiben fuer 4B-2 und
  spaetere Schritte gesperrt.
