# Wiki Schritt 5A: Homoeopathischer Repertoriumsvertrag

Stand: 2026-08-02

Status: implementiert und lokal verifiziert. Kein Supabase-Deployment, kein
Backfill, kein Repertoriumsimport und keine medizinische Nutzung.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260802110000_create_kb_homeopathic_repertory_contract.sql`

erweitert den medizinisch inaktiven Wissensvertrag von exakt 59 auf exakt 65
Wiki-Tabellen. Vor jeder Aenderung prueft sie die vollstaendige 59-Tabellen-
Ausgangsgrenze und das Vorhandensein der benoetigten 4B-Funktionen.

Sie legt genau zwei kontrollierte Typzeilen an:

- `homeopathic_repertory`
- `homeopathic_remedy`

Sie legt genau sechs leere Inhaltstabellen an:

- `kb_homeopathic_repertory_revision_details`
- `kb_homeopathic_rubrics`
- `kb_homeopathic_rubric_revisions`
- `kb_homeopathic_grade_definitions`
- `kb_homeopathic_repertory_remedies`
- `kb_homeopathic_rubric_remedy_assignments`

Nicht Bestandteil von Schritt 5A sind:

- echte Repertorien, Rubriken, Grade, Mittel oder Zuordnungen
- lizenzierter oder urheberrechtlich ungeklaerter Inhalt
- ein Importer, Parser, Kandidatenvertrag oder Promotionpfad
- Repertorisation, Gewichtung, Ranking oder Ergebnisanzeige
- repertoriumsuebergreifend normalisierte Grade
- ein Runtime-Reader, Writer oder Repertoriums-RPC
- Patienten-, Nutzer-, Sitzungs-, Anamnese- oder Therapieverknuepfungen
- Release-Aktivierung, Release-v2-Inhalt oder Aenderung von Release v1
- Anbindung an `therapy-recommend` oder eine sichtbare Therapieausgabe

## Exakte Repertoriumsrevision

`kb_homeopathic_repertory_revision_details` bindet genau eine
`homeopathic_repertory`-Revision an:

- die exakte Repertoriums-Entitaet und Revision
- die exakte Quellen-Entitaet und Quellenrevision
- einen ausreichenden Rechtezustand `own_content`, `licensed` oder
  `public_domain`; `unknown` und `quoted` werden fail-closed abgelehnt
- den quelleneigenen Repertoriumscode
- die Quellsprache
- eine exakte Fundstelle innerhalb der Quelle
- Vertragsversion 1

Das Entitaets-/Revisionspaar und das Quellen-/Revisionspaar verwenden
zusammengesetzte, deferrable Fremdschluessel. Derselbe normalisierte
Repertoriumscode darf innerhalb derselben Quellenrevision nur einmal gebunden
werden.

Der kanonische Repertoriumspayload umfasst den stabilen Entitaetsschluessel,
alle fachlichen Felder der Entitaetsrevision, einen Metadatenhash, alle
statischen Felder der Quellenrevision und die vollstaendige Quellenbindung. Der
SHA-256 wird in `kb_entity_revisions.content_hash` gespeichert. Reviewstatus,
Zeitstempel und Akteur-IDs gehoeren nicht zum fachlichen Hash.

## Stabile Rubriken und revisionslokale Hierarchie

`kb_homeopathic_rubrics` enthaelt nur die stabile Rubrikidentitaet:

- UUID
- Repertoriums-Entitaet
- nativen Quellencode

Der native Code ist bytegenau gespeichert, nach NFC-, Leerraum- und
Kleinschreibungsnormalisierung aber innerhalb des Repertoriums eindeutig. UUID,
Repertoriumsbindung und Code sind nach Anlage unveraenderlich.

`kb_homeopathic_rubric_revisions` enthaelt pro exakter
Repertoriumsrevision:

- Rubriktext
- kontrollierte Domaene
- optional eine Elternrubrik derselben Repertoriumsrevision
- lueckenlose Geschwisterposition ab 1
- exakte Quellenfundstelle
- kanonischen Inhalts-Hash

Zulaessige Domaenen sind `general`, `mind`, `modality`, `location`,
`sensation`, `concomitant` und `other_source_native`. Zusammengesetzte
Fremdschluessel verhindern Eltern aus anderen Repertorien oder Revisionen. Ein
rekursiver transaktionsendgueltiger Validator verhindert direkte und indirekte
Zyklen. Jede Geschwistergruppe muss eindeutig und ohne Luecke von 1 bis zur
Gruppengroesse geordnet sein.

Der Rubrikhash bindet auch die stabile Elternidentitaet, deren gespeicherten
Rubrikhash, die exakte Repertoriumsrevision und ihre Quelle. Eine spaetere
Aenderung an Quelle, Hierarchie oder Elterninhalt kann deshalb nicht unbemerkt
unter einem alten Kindhash bestehen bleiben.

## Source-native Grade

`kb_homeopathic_grade_definitions` speichert ausschliesslich die Skala der
konkreten Repertoriumsrevision:

- Quellencode
- Quellenbezeichnung
- quelleneigene Reihenfolge
- Quellenfundstelle
- kanonischen Hash

Codes sind normalisiert eindeutig. Die Reihenfolge beginnt bei 1 und ist ohne
Luecke. `grade_order` ist nur die Reihenfolge der Originalquelle; sie ist kein
repertoriumsuebergreifender Wert, Wirksamkeitsscore oder medizinisches Ranking.
Der Vertrag besitzt absichtlich keine Spalte fuer einen normalisierten Grad.

## Potenzneutrale Mittelidentitaet

`kb_homeopathic_repertory_remedies` bindet den quelleneigenen Mittelcode,
Quellennamen, eine begrenzte kanonische Aliasliste und eine Fundstelle an genau
eine Revision einer `homeopathic_remedy`-Entitaet.

Innerhalb einer Repertoriumsrevision darf dieselbe Mittelentitaet nur einmal
vorkommen. Codes und Aliasse bilden gemeinsam einen normalisierten source-local
Namensraum; kein solcher Identifikationsbegriff darf mehrdeutig auf zwei Mittel
oder doppelt auf dasselbe Mittel zeigen. Der Quellename bleibt separat exakt und
hashgebunden, muss aber nicht kuenstlich eindeutig sein.

`homeopathic_remedy` ist absichtlich potenzneutral. Eine gebundene
Mittelrevision darf keine Zeile in `kb_homeopathic_revision_details` besitzen.
Diese vorhandene therapeutische Detailtabelle bleibt potenztragenden
Zubereitungen vorbehalten. Schritt 5A fuehrt keine Potenz-, Darreichungs-,
Produkt- oder Dosierungsfelder ein.

Der Mittelhash bindet die vollstaendige source-native Benennung, Fundstelle,
exakte Mittelentitaet und Mittelrevision sowie die exakte Repertoriums- und
Quellenrevision.

## Exakte Rubrik-Mittel-Grad-Zuordnung

`kb_homeopathic_rubric_remedy_assignments` verbindet ausschliesslich Zeilen
derselben Repertoriumsrevision:

- eine exakte Rubrikrevision
- eine exakte source-local Mittelzuordnung
- eine exakte source-local Graddefinition
- eine exakte Fundstelle
- einen kanonischen Hash

Zusammengesetzte Fremdschluessel erzwingen dieselbe Repertoriums-Entitaet und
Revision auf allen vier Ebenen. Pro Rubrikrevision und Mittelzuordnung existiert
hoechstens eine Assignment-Zeile. Es gibt keine Gewichtung, keinen Score und
keine Rangspalte.

Der Assignmenthash bindet die vollstaendigen kanonischen Payloads und
gespeicherten Hashes von Rubrik, Mittel und Grad. Triggerumgehende Aenderungen an
jeder vorgelagerten Ebene werden dadurch bis zum Assignment sichtbar.

## Validierung und Manipulationserkennung

Der gemeinsame Wiki-Snapshot verlangt zusaetzlich genau diese Nullzaehler:

- `invalid_homeopathic_repertory_revisions`
- `invalid_homeopathic_rubrics`
- `invalid_homeopathic_grade_definitions`
- `invalid_homeopathic_repertory_remedies`
- `invalid_homeopathic_rubric_remedy_assignments`

Die Zaehler pruefen auch dann fail-closed, wenn Owner-Trigger fuer einen exakten
Restore umgangen wurden. Sie erkennen insbesondere:

- fehlende oder falsch typisierte Repertoriumsdetails
- Repertoriums-Entitaeten ohne Revision sowie importierte, geparste oder
  KI-erzeugte Repertoriums- und Mittelrevisionen
- falsche Quellen- oder Revisionspaare
- unbekannte oder nur zitierte Rechtezustaende der gebundenen Repertoriumsquelle
- verwaiste stabile Rubriken
- Zyklen und nicht lueckenlose Geschwisterpositionen
- nicht lueckenlose Gradfolgen
- uneindeutige source-local Codes und Aliasse
- potenztragende statt potenzneutrale Mittelrevisionen
- repertoriumsuebergreifende Beziehungen
- veraltete oder manipulierte Hashes und Fundstellen
- unvollstaendige Repertoriumsbuendel

Der deferrable Constraint-Validator prueft nur den vom Ereignis betroffenen
Repertoriumsabschluss. Die globalen Zaehler bleiben Snapshot- und
Integritaetspruefungen vorbehalten.

## Lebenszyklus, Sperren und Unveraenderlichkeit

Direkte Writes auf alle sechs Tabellen sind ausschliesslich dem
Datenbankeigner erlaubt. Jeder Write sperrt Abhaengigkeitsrevisionen in
sortierter UUID-Reihenfolge, versioniert die betroffenen Entity- und
Quelleneltern und erzeugt eine echte Zeilenversion der koordinierenden
Repertoriumsrevision. Aenderungen an gebundenen Quellen- oder Mittelrevisionen
koordinieren dieselben Repertoriumsrevisionen.

Eine explizite Selbstkoordinationssperre verhindert Rekursion, falls eine
ungueltige Transaktion vor der deferred Typpruefung versucht, eine
Repertoriumsrevision als eigenes Mittel zu binden.

Ab `approved` sind der komplette Repertoriumsinhalt, stabile Rubriken und alle
Zuordnungen dauerhaft unveraenderlich. Dasselbe gilt fuer `released`,
`superseded` und `withdrawn`. Eine freigegebene Repertoriumsrevision darf nicht
auf `draft` zurueckgesetzt werden. Abhaengige Quellen- und Mittelrevisionen
muessen zum Lebenszyklus der Repertoriumsrevision passen.

Alle sechs Tabellen besitzen eine explizite Truncate-Sperre. Der Restore nutzt
deshalb ausschliesslich den dokumentierten Owner-Pfad mit temporaer
deaktivierten User-Triggern und `DELETE` in umgekehrter FK-Reihenfolge.

## Rollen und Funktionen

- Datenbankeigner: kanonischer Schreib- und Restorepfad
- Administrator: RLS-gesteuertes Lesen, keine Inhaltswrites
- `service_role`: Lesen und aktueller Wiki-Snapshot-RPC, keine Inhaltswrites
- authentifizierter Nicht-Admin: keine sichtbaren Zeilen
- `anon`, `kb_importer`, `kb_import_runtime`: kein Tabellenzugriff

Alle Normalisierungs-, Payload-, Hash-, Validierungs-, Sperr- und
Schutzfunktionen sind fuer Anwendungs- und Importrollen widerrufen. Nur
`service_role` darf den aktuellen `kb_export_wiki_snapshot()` ausfuehren. Es
existiert kein Writer- oder Reader-RPC fuer Repertoriumsinhalte.

Da die aeltere generische Entitaetskandidaten-Promotion ihre Zieltypen dynamisch
aus `kb_entity_types` liest, schuetzt ein zusaetzlicher Core-Trigger beide neuen
Typen. Entitaetsanlage, fachliche Aenderung und Loeschung sind Owner-only;
statusbezogene Revisionspruefungen duerfen weiterhin nur den bereits
kontrollierten Reviewworkflow durchlaufen. Entitaeten und Revisionen mit
`import`-, `parser`- oder `ai`-Herkunft werden abgelehnt. Damit kann der
bestehende Security-Definer-Promotionspfad die neuen Typcodes nicht versehentlich
als Step-5A-Runtime-Importer verwenden. Ein exakter Owner-Restore bleibt mit
deaktivierten User-Triggern moeglich.

## Backup und Restore

Browserinventar, Edge-Inventar, OpenAPI-Ergaenzung, Fallback und Datenbank-RPC
umfassen exakt dieselben 65 Wiki-Tabellen.

Importreihenfolge des neuen Blocks:

1. `kb_homeopathic_repertory_revision_details`
2. `kb_homeopathic_rubrics`
3. `kb_homeopathic_rubric_revisions`
4. `kb_homeopathic_grade_definitions`
5. `kb_homeopathic_repertory_remedies`
6. `kb_homeopathic_rubric_remedy_assignments`

Beim Leeren gilt die umgekehrte Reihenfolge. Der Block wird nach Kern-,
therapeutischen und Labordetails, aber vor klinischen Regeln geladen.
`kb_search_documents` bleibt der letzte Import.

Der Therapie-Eingabe-Snapshot v2 bleibt byteidentisch und exakt vier Tabellen
gross. Der fokussierte Restore-Test vergleicht seinen vollstaendigen Text vor
und nach einem 65-Tabellen-Wiki-Restore.

## Testabdeckung

Der fokussierte Test

`src/test/wiki-step5a-homeopathic-repertory-contract.test.ts`

deckt insbesondere ab:

- exakte 59-zu-65-Grenze, sechs leere Tabellen und zwei Typzeilen
- gueltiges vollstaendig synthetisches, nichtmedizinisches Buendel
- exakte Quellen-, Entitaets- und Revisionspaare
- ausreichende Quellenrechte und Ablehnung von `unknown`/`quoted`
- native Rubrikdomaenen, stabile Codes, Hierarchie und Fundstellen
- Zyklus- und Lueckenabwehr fuer Rubriken und Grade
- normalisierte Code-, Namens- und Alias-Eindeutigkeit
- potenzneutrale Mittelrevisionen und falsche Zieltypen
- alle kanonischen Payloads, Hashes und Nullzaehler
- Manipulation nach Triggerumgehung auf Quelle, Rubrik und Assignment
- Owner-only Write, Admin-/Service-Read, RLS und Funktionsrechte
- Freigabeunveraenderlichkeit und Truncate-Sperren
- texttreuen 65-Tabellen-Owner-Restore
- byteidentischen Vier-Tabellen-Therapie-Snapshot v2
- statischen Ausschluss von Runtime-Readern, Writern, Importern und Therapiepfad

## Abschlussreview und Verifikation

Ein separates Abschlussreview fand drei vor dem Abschluss geschlossene
Zugriffs- und Restore-Luecken:

- Bestehende Core-Grants haetten einem Admin eine fachliche Aenderung an einer
  neuen Typentitaet oder eine ungebundene `homeopathic_remedy`-Revision erlaubt.
  Core-Entitaetswrites und fachliche Revisionswrites sind deshalb nun
  Owner-only; reine Statuspruefungen bleiben im kontrollierten Reviewworkflow.
- Triggerumgehende `import`-, `parser`- oder `ai`-Herkunft sowie eine
  Repertoriums-Entitaet ohne Revision haetten vor der Korrektur nicht jeden
  Nullzaehler erhoeht. Die semantischen Validatoren und Restore-Zaehlung lehnen
  diese Zustaende nun fail-closed ab.
- Die exakte Quellenrevision war vollstaendig hashgebunden, aber ein
  Rechtezustand `unknown` oder `quoted` waere noch akzeptiert worden. Der
  Basisvalidator verlangt nun `own_content`, `licensed` oder `public_domain`;
  ein eigener Negativtest prueft das transaktionsendgueltig.

Abschlussstand nach den Korrekturen:

- fokussierter Step-5A-Test: 11/11 Tests
- Schema- und Snapshot-Suiten: 51/51 Tests
- historische 4B-Regel-, Such- und Laborsuiten: 37/37 Tests
- vollstaendiger Projektlauf: 45/45 Dateien, 496/496 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf ohne Fehler
- Deno-Check der Backup-Edge-Function ohne Fehler und ohne Lockdatei
- Produktionsbuild erfolgreich; nur bestehende Browserslist-, Dependency-`eval`-
  und Chunkgroessenwarnungen
- finales Review ohne verbleibenden P0/P1-Befund

## Restrisiken und Pre-Deployment-Gates

- PGlite ersetzt keinen realen PostgreSQL-Test fuer Locks, Deadlocks,
  `REPEATABLE READ` und grosse deferrable Transaktionen.
- Ein lizenzierter Grossimport muss vor Deployment mit realistischen Rubrik-,
  Alias- und Assignmentmengen auf PostgreSQL profiliert werden.
- Dabei ist insbesondere zu messen, ob die pro geaenderter Zeile ausgeloesten
  deferred Abschlusspruefungen bei grossen Batchtransaktionen dedupliziert oder
  durch einen separat abgenommenen Bulkvertrag ersetzt werden muessen. Der
  aktuelle schema-only Block enthaelt absichtlich noch keinen Grossimportpfad.
- Die normalisierte Alias-Kollisionspruefung benoetigt bei sehr grossen
  source-local Mittellisten gegebenenfalls einen spaeteren, separat migrierten
  Indexvertrag. Sie darf nicht aus Performancegruenden abgeschaltet werden.
- Ein echter Supabase-/PostgREST-RLS-Test, Browser-/Edge-ZIP-Export und
  isolierter Owner-Restore sind vor Deployment erforderlich.
- Rechte und Lizenz jeder konkreten Repertoriumsquelle muessen vor einem Import
  dokumentiert und fachlich freigegeben werden.
- Repertoriumscodes und Grade sind source-native. Ein spaeterer Reader darf sie
  weder still zusammenfuehren noch in eine erfundene universelle Skala
  umrechnen.
- Release v1 friert diese Tabellen nicht als Retrievalvertrag ein und bleibt
  deshalb weiterhin `retrieval_eligible = false` und `is_active = false`.
