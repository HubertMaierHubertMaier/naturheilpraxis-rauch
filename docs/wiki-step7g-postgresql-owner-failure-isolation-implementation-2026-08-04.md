# Wiki Schritt 7G: Begrenzter PostgreSQL-Owner-Abbruch- und Fehlerisolationsnachweis

Stand: 2026-08-04

Status: implementiert, lokal verifiziert und isoliert unter PostgreSQL 17
bestaetigt. Es gibt keine Migration, kein
Supabase-Deployment, keine echten medizinischen Daten und keine Verbindung zum
sichtbaren Therapiepfad.

## Ziel und harte Grenze

Schritt 7G erweitert ausschliesslich den nichtproduktiven PostgreSQL-17-
CI-Nachweis aus 7D bis 7F. Er prueft zwei bislang getrennt offene technische
Eigenschaften des weiterhin Owner-only geschlossenen Auditwriters:

- Ein innerhalb einer expliziten Transaktion erfolgreich erzeugter Auditlauf
  verschwindet nach `ROLLBACK` vollstaendig.
- Drei gleichzeitig gestartete Aufrufe mit syntaktisch gueltigen, aber
  veralteten Audit-Hashes koennen den einen gueltigen Aufruf weder blockieren
  noch eine zweite oder ungueltige Zeile erzeugen.

7G fuegt weder Datenbankschema noch Anwendungscode, Writerrechte oder einen
produktiven Aufrufpfad hinzu. Der gepruefte Writer bleibt fuer alle
Anwendungsrollen geschlossen.

## Eigene synthetische Zieldatenbank

Der bestehende 7F-Dump schliesst ausschliesslich die Daten von
`public.therapy_retrieval_audit_runs` aus. Nach dem unveraenderten 7F-Restore
wird derselbe auf 64 MiB begrenzte Custom-Dump ein zweites Mal transaktional in
eine frische `template0`-Datenbank restauriert:

`retrieval_failure_isolation`

Schema, Trigger, Funktionen, Rollenvertrag und alle synthetischen Eingabe- und
Wissensfixtures bleiben enthalten. Der initiale Auditbestand und der
Integritaetsfehlerzaehler muessen beide null sein. Es gibt kein `DELETE`,
`TRUNCATE` und keine Triggerumgehung. Datenbank und Dump bleiben ausschliesslich
im ephemeren PostgreSQL-17-Servicecontainer und werden nicht als Artifact
gespeichert.

## Transaktionsabbruch

Ein einzelner Owner-Testaufrufer startet eine explizite Transaktion, ruft den
unveraenderten 7B-Writer mit dem exakten positiven 7A-Vertrag auf und muss
innerhalb der Transaktion genau eine gueltige Zeile sehen. Anschliessend wird
die gesamte Transaktion bewusst zurueckgerollt.

Ein separater Inspektor muss danach erneut exakt `0` Auditzeilen und `0`
ungueltige Zeilen sehen. Die bereits empfangene positive Funktionsantwort ist
damit nachweislich keine vom Transaktionsabschluss unabhaengige Persistenz- oder
Aktivierungszusage.

## Gemischte harte Nebenlaeufigkeitsbarriere

Nach dem Rollback startet die weiterhin leere Zieldatenbank vier voneinander
getrennte Owner-Testaufrufer. Ein Inspektor haelt dieselbe Art exklusiver
PostgreSQL-Advisory-Startbarriere wie in 7F. Alle vier Aufrufer warten innerhalb
ihres Persistenzstatements nachweislich im kompatiblen Shared-Modus.

Erst nach exakt vier sichtbaren Warteanforderungen wird die Barriere
freigegeben:

- ein Aufrufer verwendet den exakten positiven Audit-Ergebnishash
- drei Aufrufer verwenden drei verschiedene syntaktisch gueltige, aber
  veraltete SHA-256-Erwartungen

Der gueltige Aufruf muss genau
`RETRIEVAL_AUDIT_PERSISTED_INACTIVE` liefern. Alle drei veralteten Aufrufe
muessen mit der bestehenden fail-closed Meldung zum exakten 7A-Ergebnis
abbrechen. Ein blosses schnelles Nacheinander kann diesen Vertrag nicht
erfuellen.

## Ressourcen- und Abschlussgrenzen

Der Nachweis besitzt feste Obergrenzen:

- vier gemischte Aufrufer
- genau drei veraltete Erwartungen
- insgesamt fuenf gleichzeitige Zielsitzungen waehrend der Mischprobe
- fuenf Sekunden zum Erreichen der Startbarriere
- `statement_timeout = 30s`
- `lock_timeout = 10s`
- `idle_in_transaction_session_timeout = 30s`
- unveraenderte Workflowgrenze von 15 Minuten fuer die gesamte Gruppe

Nach Abschluss muss die Zieldatenbank exakt eine Auditzeile mit einem
Audit-Ergebnishash, gueltigem Zeilenvertrag und null Integritaetsfehlern
enthalten. Es duerfen keine ungewahrten 7G-Sperren verbleiben.

Der vollstaendige 7C-Preflight muss weiterhin
`AUDIT_RETENTION_RESTORE_TECHNICAL_PREFLIGHT_READY_INACTIVE` liefern. Snapshot,
append-only Vertrag, Restore-Fremdschluessel und Zugriff muessen positiv sein.
Gleichzeitig bleiben insbesondere folgende Felder `false`:

- `retention_policy_approved`
- `retention_deletion_allowed`
- `operational_restore_drill_completed`
- `real_postgres_validation_completed`
- `audit_persistence_allowed`
- `replay_execution_allowed`
- `shadow_execution_allowed`
- `ai_use_allowed`
- `plan_selection_allowed`
- `dosage_evaluation_allowed`
- `dosage_display_allowed`
- `medical_use_allowed`
- `activation_allowed`

## Lokale Verifikation

Vor dem PostgreSQL-Lauf bestehen:

- JavaScript-Syntaxpruefung des 7G-Skripts
- statischer PostgreSQL-/Workflowvertrag mit 6/6 Tests
- uebrige Projektsuite mit 49/49 Dateien und 523/523 Tests
- Repository-Secret-Policy mit 2/2 Tests
- beide TypeScript-Projekte ohne Fehler
- gezieltes ESLint fuer das neue Skript und den erweiterten Vertrag ohne Fehler
- erfolgreicher Produktionsbuild; nur die bereits bekannten Browserslist-,
  Bluebird-`eval`- und Chunkgroessenhinweise
- `git diff --check` ohne Whitespacefehler; nur die bekannten
  LF-zu-CRLF-Arbeitskopiehinweise

Der Workflow legt die Node-20-Basis fest.

## PostgreSQL-17-Ergebnis

Der finale Workflow lief fuer Commit
`baf7ca008bb75815128b94c79eb34a7ab53de72c` erfolgreich:

<https://github.com/HubertMaierHubertMaier/naturheilpraxis-rauch/actions/runs/30921506249>

Alle sechs PostgreSQL-17-Gruppen meldeten `success`. Gruppe 5 bestand zusaetzlich
zum unveraenderten Auditpersistenzvertrag:

- den vollstaendigen ephemeren Dump-/Restore- und Hashvergleich
- die bestehende 7F-Nebenlaeufigkeitsprobe
- den eigenen Schritt `Verify bounded synthetic owner failure isolation`

Die maschinenlesbare 7G-Zusammenfassung bestaetigt:

- `rollback_insert_results = 1`
- `rows_after_rollback = 0`
- `mixed_callers = 4`
- `barrier_waiters = 4`
- `bounded_sessions = 5`
- `inserted_results = 1`
- `rejected_stale_results = 3`
- `audit_rows = 1`
- `invalid_audit_rows = 0`
- `waiting_locks = 0`
- `max_duration_ms = 10936`
- `operational_or_medical_approval = false`

Der anschliessende 7C-Preflight blieb technisch bereit und inaktiv. Der
Servicecontainer samt Dumps und allen ephemeren synthetischen Datenbanken wurde
danach verworfen.

## Unveraenderte Produktgrenzen und Restrisiken

- Es werden nur versionierte synthetische Fixtures verwendet.
- Es gibt keine Verbindung zu einem Supabase-Projekt oder einer externen
  Datenbank und keine GitHub-Secrets.
- Es gibt keine Aufbewahrungs-, Loesch-, Replay- oder Schattenfreigabe.
- KI, Planwahl, Dosierungsanzeige, medizinische und produktive Nutzung sowie
  Aktivierung bleiben ausgeschlossen.
- Vier gemischte Aufrufe sind kein Last-, Langzeit- oder Kapazitaetstest.
- Ein Rollback im selben ephemeren Cluster ist kein operativer Restore- oder
  Notfallwiederanlaufnachweis.
- Datenschutz-, Betriebs-, Rechts- und medizinische Abnahmen bleiben offen.

Ein erfolgreicher 7G-Lauf beweist nur die begrenzte Transaktions- und
Fehlerisolation des weiterhin inaktiven Owner-Writers.
