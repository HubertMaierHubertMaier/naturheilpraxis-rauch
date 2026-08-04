# Wiki Schritt 7F: Begrenzter PostgreSQL-Owner-Nebenlaeufigkeitsnachweis

Stand: 2026-08-04

Status: implementiert und lokal verifiziert. Der isolierte PostgreSQL-17-Lauf
steht noch aus. Es gibt kein Supabase-Deployment, keine echten medizinischen
Daten und keine Verbindung zum sichtbaren Therapiepfad.

## Ziel und harte Grenze

Schritt 7F erweitert ausschliesslich den nichtproduktiven PostgreSQL-17-
CI-Nachweis aus 7D und 7E. Er prueft, ob vier tatsaechlich gleichzeitig
gestartete Owner-Aufrufe fuer denselben exakten Auditvertrag:

- genau eine neue append-only Auditzeile erzeugen
- genau ein Ergebnis `RETRIEVAL_AUDIT_PERSISTED_INACTIVE` liefern
- drei Ergebnisse `RETRIEVAL_AUDIT_ALREADY_PERSISTED_INACTIVE` liefern
- dieselbe Audit-ID, denselben Audit-Ergebnishash und denselben Zeilenhash sehen
- nach Abschluss keine ungewahrten Sperren hinterlassen

7F fuegt weder eine Migration noch Anwendungscode oder einen produktiven
Writer hinzu. Der gepruefte Writer bleibt Owner-only und fuer alle
Anwendungsrollen geschlossen.

## Zwei getrennte synthetische Restores

Die bestehende 7E-Probe stellt zuerst den vollstaendigen synthetischen Bestand
byte- und vertragsgetreu in `retrieval_restore` wieder her. Diese Datenbank
enthaelt genau eine gueltige Auditfixture und dient 7F nur dazu, die bereits
geprueften IDs und Hasherwartungen zu lesen.

Fuer den konkurrierenden Erstinsert erstellt der Workflow danach einen zweiten
begrenzten Custom-Dump. Er schliesst ausschliesslich die Daten der Tabelle

`public.therapy_retrieval_audit_runs`

aus, behaelt aber Schema, Funktionen, Trigger, Rollenvertrag und alle
synthetischen Eingabe- und Wissensfixtures bei. Der Dump:

- stammt nur aus `retrieval_contract` im lokalen `postgres:17`-Service
- liegt nur unter `/tmp` im Wegwerfcontainer
- muss groesser als null und hoechstens 64 MiB gross sein
- wird transaktional in die frische `template0`-Datenbank
  `retrieval_concurrency` restauriert
- muss dort einen Auditbestand und Integritaetsfehlerzaehler von `0:0` ergeben

Damit benoetigt der Test weder `DELETE`, `TRUNCATE` noch eine Triggerumgehung.
Beide Dumps und alle drei Datenbanken werden mit dem CI-Servicecontainer
verworfen und nicht als Artifact gespeichert.

## Harte Nebenlaeufigkeitsbarriere

`scripts/verify-therapy-retrieval-postgres-concurrency.mjs` akzeptiert nur die
explizite lokale CI-Test-URL mit Host `127.0.0.1` oder `localhost`. Es liest die
Fixture einmal aus `retrieval_restore`, schliesst diese Lesesitzung und
verbindet danach ausschliesslich:

- einen Inspektor mit `retrieval_concurrency`
- vier Owner-Testaufrufer mit `retrieval_concurrency`

Der Inspektor haelt zunaechst eine exklusive PostgreSQL-Advisory-Sperre. Alle
vier Aufrufer fordern innerhalb ihres Persistenzstatements dieselbe Sperre im
kompatiblen Shared-Modus an. Der Test gibt die Barriere erst frei, nachdem
`pg_locks` exakt vier wartende Shared-Anfragen bestaetigt hat. Danach erhalten
alle vier Aufrufer die kompatible Shared-Sperre gleichzeitig und fuehren den
gleichen Writervertrag aus.

Ein blosses schnelles Nacheinander von vier JavaScript-Aufrufen kann damit
nicht als Nebenlaeufigkeitsnachweis durchgehen.

## Ressourcen- und Fehlergrenzen

Der Nachweis besitzt feste Obergrenzen:

- vier Writer-Aufrufer
- insgesamt fuenf gleichzeitige 7F-Zielsitzungen
- fuenf Sekunden zum Erreichen der Startbarriere
- `statement_timeout = 30s`
- `lock_timeout = 10s`
- `idle_in_transaction_session_timeout = 30s`
- unveraenderte Workflowgrenze von 15 Minuten fuer die gesamte Gruppe

Kann ein Aufrufer die Barriere nicht rechtzeitig erreichen, tritt ein Lock-
oder Statement-Timeout auf oder entsteht mehr als eine Zeile, schlaegt der Job
fehl. Die ausgegebene Zusammenfassung enthaelt nur Zaehler und Laufzeitwerte,
keine IDs, Hashes, Inhalte oder Zugangsdaten.

## Abschlussvertrag

Nach den vier Aufrufen muss die separate Zieldatenbank exakt enthalten:

- eine Auditzeile
- eine Audit-ID
- einen Audit-Ergebnishash
- ausschliesslich eine gueltige Zeile
- null ungueltige Auditzeilen
- null ungewahrte Sperren der 7F-Sitzungen

Anschliessend muss der vollstaendige 7C-Preflight weiterhin den Status

`AUDIT_RETENTION_RESTORE_TECHNICAL_PREFLIGHT_READY_INACTIVE`

liefern. Snapshot-, append-only-, Restore-Fremdschluessel- und Zugriffsvertrag
muessen positiv sein. Gleichzeitig bleiben insbesondere folgende Felder
`false`:

- `retention_policy_approved`
- `retention_deletion_allowed`
- `operational_restore_drill_completed`
- `real_postgres_validation_completed`
- `audit_persistence_allowed`
- `replay_execution_allowed`
- `shadow_execution_allowed`
- `medical_use_allowed`
- `activation_allowed`

Der Persistenzabschluss der synthetischen Owner-Funktion ist damit kein Recht
fuer einen Anwendungsaufruf und keine fachliche Freigabe.

## Lokale Verifikation

Die lokale Node-20-Verifikation besteht aus:

- sechs disjunkten PGlite-Gruppen mit
  `10 + 15 + 14 + 6 + 7 + 4 = 56/56` Retrievaltests
- uebriger Projektsuite mit 50/50 Dateien und 528/528 Tests
- insgesamt 51 Testdateien und 584 Tests
- statischem PostgreSQL-/Workflowvertrag mit 5/5 Tests
- Secret-Policy mit 2/2 Tests
- JavaScript-Syntaxpruefung des 7F-Skripts
- beiden TypeScript-Projekten ohne Fehler
- gezieltem ESLint fuer die geaenderten Skript- und Testdateien ohne Fehler
- erfolgreichem Produktionsbuild unter Node 20.20.2

Der monolithische PGlite-Versuch bestand zwar alle 56 Einzeltests, erzeugte
nach rund 205 Sekunden aber einen Vitest-Worker-RPC-Timeout. Er wird nicht als
Gate gewertet. Die sechs ressourcenbegrenzten Einzellaeufe waren jeweils ohne
Fehlerlog erfolgreich.

Der vollstaendige Repository-Lint bleibt wegen 397 bereits vorhandener Fehler
ausserhalb der geaenderten Dateien rot. 7F fuegt keinen neuen Lintfehler hinzu.
Der Build meldet nur die bereits bekannten Browserslist-, Bluebird-`eval`- und
Chunkgroessenhinweise.

## PostgreSQL-17-Ergebnis

Der echte PostgreSQL-17-Nachweis wird erst nach dem Push des geprueften
Implementierungscommits eingetragen. Bis dahin ist 7F nicht als gegen
PostgreSQL bestaetigt dokumentiert.

## Unveraenderte Produktgrenzen und Restrisiken

- Es werden nur versionierte synthetische Fixtures verwendet.
- Es gibt keine Verbindung zu einem Supabase-Projekt oder einer externen
  Datenbank und keine GitHub-Secrets.
- Es gibt keine Aufbewahrungs-, Loesch-, Replay- oder Schattenfreigabe.
- KI, Planwahl, Dosierungsanzeige, medizinische und produktive Nutzung sowie
  Aktivierung bleiben ausgeschlossen.
- Vier identische Aufrufe sind kein Last-, Langzeit- oder Kapazitaetstest.
- Die Probe bewertet weder Supabase-Netzwerkverhalten noch produktive
  Verbindungspools, Failover, Regionen oder reale Datenmengen.
- Datenschutz-, Betriebs-, Rechts- und medizinische Abnahmen bleiben offen.

Ein erfolgreicher 7F-Lauf ist nur ein begrenzter technischer Nachweis der
PostgreSQL-Konflikt- und Idempotenzsemantik des weiterhin inaktiven
Owner-Writers.
