# Wiki Schritt 7B: Inaktive append-only Retrieval-Audit-Persistenz

Stand: 2026-08-04

Status: lokal implementiert und synthetisch verifiziert. Es gibt kein
Supabase-Deployment, keine echten medizinischen Daten, keinen Replaylauf, keinen
Schattenbetrieb und keine Anbindung an den sichtbaren Therapiepfad.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260804160000_create_therapy_retrieval_audit_persistence.sql`

persistiert ausschliesslich ein durch Schritt 7A erneut berechnetes und durch
seinen exakten erwarteten Resultathash gebundenes Audit-Envelope. Sie erzeugt:

- eine append-only Tabelle `therapy_retrieval_audit_runs`
- zwei reine Integritaetsfunktionen und einen Integritaetszaehler
- drei Triggerfunktionen fuer Writer-Gate, Unveraenderlichkeit und Validierung
- eine geschlossene idempotente Owner-Schreibfunktion
- den neuen geschuetzten Therapie-Snapshot v3
- vier Trigger, zwei Indizes, eine Admin-Lesepolicy und minimale Rechte

Die Migration aendert weder den Vier-Tabellen-Snapshot v2 noch den
67-Tabellen-Wiki-Snapshot. Sie erzeugt keinen Runtime-RPC, keine Queue, keinen
Scheduler und keine Verbindung zu `therapy-recommend`.

## Persistierte Zeile

Jede Zeile enthaelt:

- eine zufaellige Auditlauf-ID
- feste Vertragsversion 1
- feste Datenklassifikation `pseudonymized_health_data`
- festen Status `RETRIEVAL_AUDIT_PERSISTED_INACTIVE`
- Therapie-Eingaberevision und Knowledge-Release
- Repertoriums-Entity und Repertoriumsrevision
- das vollstaendige unveraenderte 7A-Resultat
- 7A-Resultat-, Audit-Envelope- und Dosierungsregel-Resultathash
- Persistenzzeitpunkt und stabile Owner-angegebene Akteur-ID
- einen kanonischen Hash ueber alle fachlichen und Persistenzfelder

Der 7A-Inhalt bleibt auf 8 MiB begrenzt. Der 7A-Resultathash ist eindeutig, so
dass dasselbe deterministische Envelope nur einmal gespeichert werden kann.
Die Persistenzmetadaten sind kein Bestandteil des 7A-Hashes, werden aber durch
den separaten Zeilenhash gebunden.

## Exakte 7A-Bindung und idempotenter Writer

`therapy_retrieval_v2_persist_audit_envelope_v1(...)` akzeptiert kein frei
geliefertes Audit-JSON. Die Owner-Funktion nimmt dieselben gebundenen Eingaben
und Stufenerwartungen wie 7A sowie den erwarteten 7A-Resultathash und eine
Persistenzakteur-ID entgegen. Sie:

1. berechnet 7A serverseitig erneut
2. verlangt `RETRIEVAL_AUDIT_ENVELOPE_READY_INACTIVE`
3. verlangt den exakten erwarteten und intern reproduzierten 7A-Resultathash
4. reproduziert den Audit-Envelope-Hash
5. erzeugt ID, Transaktionszeitpunkt und Zeilenhash serverseitig
6. schreibt nur durch ein transaktionslokales Trigger-Gate
7. validiert die gespeicherte Zeile erneut

Ein bereits vorhandenes gueltiges 7A-Resultat erzeugt keine zweite Zeile. Der
Writer liefert dann `RETRIEVAL_AUDIT_ALREADY_PERSISTED_INACTIVE`; beim ersten
Schreiben liefert er `RETRIEVAL_AUDIT_PERSISTED_INACTIVE`. Beide Antworten
enthalten einen eigenen kanonischen Resultathash und setzen:

- `medical_use_allowed = false`
- `productive_candidate_use_allowed = false`
- `dosage_evaluation_allowed = false`
- `dosage_display_allowed = false`
- `audit_persistence_allowed = false`
- `replay_execution_allowed = false`
- `shadow_execution_allowed = false`
- `ai_use_allowed = false`
- `plan_selection_allowed = false`
- `activation_allowed = false`
- `audit_persistence_complete = true`

`audit_persistence_complete` beschreibt nur den abgeschlossenen append-only
Schreibvorgang. Es ist keine Berechtigung fuer einen weiteren Lauf oder eine
fachliche Nutzung.

## Zeilenintegritaet

`therapy_retrieval_v2_audit_run_is_valid_v1(...)` prueft unter einer
fail-closed Ausnahmebehandlung:

- feste Vertragsversion, Klassifikation und Persistenzstatus
- Objektform und Groessengrenze des 7A-Resultats
- den positiven inaktiven 7A-Status und alle zehn Sperrfelder
- das explizit fertige, weiterhin inaktive Envelope
- Abwesenheit freier Quellenfundstellen, konkreter Dosierung, KI-Ausfuehrung
  und Planpositionen
- den kanonischen 7A-Resultathash
- den inneren und aeusseren Audit-Envelope-Hash
- den gebundenen Dosierungsregel-Resultathash
- alle vier Stufenidentitaeten
- das weiterhin gueltige Therapie-Eingabemanifest
- das weiterhin versiegelte und inaktive Knowledge-Release samt Manifest
- die exakte Repertoriumsrevision innerhalb dieses Releases
- den kanonischen Zeilenhash einschliesslich Persistenzmetadaten

`therapy_retrieval_v2_invalid_audit_run_count_v1()` zaehlt jede Zeile, die diese
Pruefung nicht mehr besteht. Der Zaehler ist Bestandteil des Snapshot-v3-
Vertrags und muss fuer jeden Backup- oder Restore-Abschluss null sein.

## Append-only Schutz

Die Tabelle besitzt vier komplementaere Trigger:

- Ein `BEFORE INSERT`-Gate akzeptiert nur den transaktionslokalen Marker der
  geschlossenen Owner-Schreibfunktion.
- Ein `BEFORE UPDATE OR DELETE`-Trigger verwirft jede Mutation.
- Ein `BEFORE TRUNCATE`-Trigger verwirft das Leeren der Tabelle.
- Ein aufgeschobener Constraint-Trigger validiert jede neu geschriebene Zeile
  noch innerhalb ihrer Transaktion.

Die direkte Wiederherstellung ist deshalb nur als Datenbankeigner in einer
einzigen kontrollierten Transaktion moeglich. Eine Anwendungs- oder
Service-Rolle kann das Trigger-Gate nicht als Schreibschnittstelle verwenden.

## RLS und Funktionsrechte

RLS ist aktiv. `authenticated` besitzt nur Tabellen-`SELECT`; die Policy zeigt
Zeilen ausschliesslich einem durch `has_role(..., 'admin')` bestaetigten Admin.
`service_role` besitzt nur `SELECT` fuer den geschuetzten Backup-Pfad. `anon`,
`kb_importer` und `kb_import_runtime` besitzen keinen Tabellenzugriff.

Alle acht neuen Funktionen werden zunaechst fuer `PUBLIC`, `anon`,
`authenticated`, `service_role`, `kb_importer` und `kb_import_runtime`
gesperrt. Nur `therapy_input_export_snapshot_v3()` wird danach fuer
`service_role` freigegeben. Der Persistenzwriter bleibt ausschliesslich beim
Datenbankeigner.

Die Owner-Funktion verwendet `SECURITY DEFINER` mit festem `search_path`. Die
reinen Hash-, Integritaets- und Triggerfunktionen bleiben geschlossen und
koennen nicht als Anwendungs-RPC missbraucht werden.

## Geschuetzter Therapie-Snapshot v3

`therapy_input_export_snapshot_v3()` bettet den unveraenderten Snapshot v2 ein
und ergaenzt genau `therapy_retrieval_audit_runs`. Der neue Vertrag umfasst:

- `therapy_input_revisions`
- `therapy_input_sources`
- `therapy_input_facts`
- `therapy_input_fact_sources`
- `therapy_retrieval_audit_runs`

Jede Tabelle bleibt als exakter JSON-Text mit Zeilenzahl und SHA-256 gebunden.
Die Validierung umfasst `invalid_revision_count`, `invalid_fact_count` und
`invalid_audit_run_count`; alle drei Werte muessen null sein. Snapshot v2 bleibt
byteidentisch und kann durch 7B nicht rueckwirkend umgedeutet werden.

Frontend- und Edge-Validatoren akzeptieren fuer neue Therapie-Backups nur die
exakte Version 3, genau diese fuenf Tabellen, genau diese drei Nullzaehler und
korrekte Hashes der unveraenderten Tabellenstrings. Unbekannte Therapie- oder
Audit-Tabellen werden abgewiesen.

## Backup und Restore

`backup-export` ruft fuer Voll- und IAA-/ICD10-Teilbackups den geschuetzten
Snapshot v3 auf. Die fuenf Tabellen werden nicht ueber normale paginierte
REST-Abfragen neu serialisiert, sondern mit ihrem exakten Snapshot-Text in das
ZIP geschrieben. Manifest, Version und Integritaetszaehler werden mitgesichert.

Der verbindliche Restore lautet:

1. kompatiblen Wiki-Snapshot mit allen referenzierten Entitaeten herstellen
2. als Datenbankeigner eine einzelne Transaktion beginnen
3. `SET CONSTRAINTS ALL IMMEDIATE` ausfuehren
4. auf allen fuenf Tabellen `DISABLE TRIGGER USER` setzen
5. erst danach `SET CONSTRAINTS ALL DEFERRED` ausfuehren
6. Auditlaeufe, Faktenquellen, Fakten, Eingabequellen und Revisionen loeschen
7. in umgekehrter Reihenfolge aus den unveraenderten JSON-Texten importieren
8. `SET CONSTRAINTS ALL IMMEDIATE` ausfuehren und Trigger wieder aktivieren
9. Snapshot v3 erneut exportieren
10. nur bei drei Nullzaehlern und exakt gleichen Zeilenzahlen und Hashes committen

Der Import verwendet als Owner parameterisiertes
`jsonb_populate_recordset(NULL::public.<tabelle>, $1::jsonb)`. JavaScript,
tabellenweiser Autocommit, eine Restore-Edge-Function oder voruebergehende
Schreibrechte fuer Anwendungsrollen sind ausgeschlossen. Das verhindert
Rundung grosser JSON-Zahlen und unvollstaendige Zwischenstaende.

## Synthetische Nachweise

`src/test/therapy-retrieval-v2-preflight.test.ts` prueft:

- genau eine neue Tabelle, acht Funktionen und keine Aenderung alter Snapshots
- exakte 7A-Neuberechnung und Erwartungsbindung
- idempotente Ein-Zeilen-Persistenz
- Ablehnung veralteter Erwartungen und unvollstaendiger Persistenzidentitaet
- Ablehnung direkter Inserts, Updates, Deletes und Truncates
- Erkennung triggerumgehender Zeilenmanipulation
- verlustfreien Owner-Restore mit identischem Snapshot-v3-Text
- Nullzaehler und SHA-256-Manifest vor und nach Persistenz
- Admin-RLS, Service-Backup-Leserecht und fehlende DML-Rechte
- fehlende Ausfuehrungsrechte fuer Writer und interne Integritaetsfunktionen

Die Backup- und Transporttests pruefen ausserdem den exakten Fuenf-Tabellen-
Vertrag, fehlende oder zusaetzliche Tabellen, alle drei Nullzaehler,
Zeilenzahlen, SHA-256-Abweichungen und die unveraenderte Serialisierung.

Abschlussstand:

- fokussierter Schritt-6A-bis-7B-Vertrag in fuenf disjunkten
  Hintergrundgruppen: 10 + 15 + 14 + 6 + 7 = 52/52 Tests
- zusammenhaengende Eingabe-, Release-, Regel-, Such-, Repertoriums- und
  Retrievalregression: 7/7 Dateien, 139/139 Tests
- vollstaendiger Projektlauf aus den gruppierten Retrievalvertraegen und dem
  uebrigen Projektbestand: 50/50 Dateien, 575/575 Tests
- Snapshot-v3-Backup- und Transportnachweis: 2/2 Dateien, 24/24 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf fuer alle geaenderten TypeScript-Dateien ohne Fehler
- Repository-Secret-Policy ohne Befund
- Produktionsbuild erfolgreich; nur die bekannten Browserslist-,
  Dependency-`eval`- und Chunkgroessenwarnungen
- `git diff --check` ohne Whitespacefehler; nur der bekannte
  LF-zu-CRLF-Arbeitskopiehinweis
- strukturierte P0/P1-Gegenpruefung: `APPROVE`; die dabei zuerst gefundene
  Wiki-Restore-Abhaengigkeit bestehender Auditzeilen wurde vor der Freigabe in
  beiden Restore-Anleitungen und ihrem Vertragstest geschlossen

Der ungefilterte historische Repository-Lint ist kein Abschlussgate dieses
Blocks: Er meldet weiterhin 397 bereits bestehende Fehler ausserhalb der
geaenderten Dateien. Keine neue Lintabweichung stammt aus 7B.

## Bewusste Restrisiken und naechste Gates

- Die Nachweise verwenden PGlite mit einer Sitzung. Reale PostgreSQL-
  Nebenlaeufigkeit, Queryplaene, Locks und Hoechstlast sind vor einem Deployment
  separat zu profilieren.
- Es gibt noch keine fachlich und datenschutzrechtlich abgenommene
  Aufbewahrungs- oder Loeschregel fuer die append-only Auditzeilen.
- Ein operativer verschluesselter Backup- und Restore-Drill auf einer isolierten
  PostgreSQL-Instanz steht aus.
- Es existieren keine echten medizinischen Regeln oder Patientendaten und keine
  medizinische Fachabnahme.
- Replay, Schattenvergleich, KI, Planwahl, Dosierungsanzeige, sichtbare
  Therapieausgabe und Aktivierung bleiben technisch und vertraglich abwesend.

Ein weiterer additiver Block darf diese Persistenz erst nach separater
Datenschutz-, Aufbewahrungs-, Real-PostgreSQL- und Restore-Abnahme verwenden.
Die Existenz einer gueltigen Auditzeile ist ausdruecklich keine
Aktivierungsfreigabe.
