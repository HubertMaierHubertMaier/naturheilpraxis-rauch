# Wiki Schritt 7C: Audit-Aufbewahrungs- und Restore-Preflight

Stand: 2026-08-04

Status: lokal implementiert und synthetisch verifiziert. Es gibt kein
Supabase-Deployment, keine echten medizinischen Daten, keine freigegebene
Aufbewahrungs- oder Loeschregel, keinen Replaylauf, keinen Schattenbetrieb und
keine Anbindung an den sichtbaren Therapiepfad.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260804170000_create_therapy_retrieval_audit_retention_restore_preflight.sql`

erzeugt genau eine geschlossene Owner-Lesefunktion:

`therapy_retrieval_v2_audit_retention_restore_preflight_v1(integer, bigint)`

Sie prueft, ob der technische Schritt-7B-Vertrag fuer Integritaetskontrolle,
Backup und einen spaeteren kontrollierten Restore weiterhin vollstaendig
vorliegt. Sie erzeugt keine Tabelle, Spalte, Policy, Rolle, View, Trigger,
Schreibfunktion oder neue Snapshot-Version. Sie schreibt, veraendert und
loescht keine Auditzeile.

Der Preflight trifft ausdruecklich keine rechtliche oder organisatorische
Entscheidung. Er berechnet weder eine Aufbewahrungsfrist noch ein Loeschdatum.
Sein positiver Status bedeutet nur, dass die bereits dokumentierten technischen
Schutzmechanismen maschinenlesbar nachgewiesen werden konnten.

## Bounded Owner-Aufruf

`_max_audit_runs` und `_max_audit_bytes` begrenzen die vollstaendige
Integritaetspruefung vor dem Snapshot-Aufbau. Zulaessig sind 0 bis 100.000
Zeilen und 0 bis 1 GiB serialisierte Auditdaten. Die Standardwerte sind 10.000
Zeilen und 64 MiB.

- `NULL`, ein negativer Wert, mehr als 100.000 Zeilen oder mehr als 1 GiB
  erzeugt
  `AUDIT_RETENTION_RESTORE_EXPECTATION_INVALID`.
- Mehr vorhandene Zeilen als das angegebene Limit erzeugen
  `AUDIT_RETENTION_RESTORE_LIMIT_EXCEEDED`, bevor der teure Vollnachweis
  beginnt.
- Mehr serialisierte Auditdaten als das Bytelimit erzeugen
  `AUDIT_RETENTION_RESTORE_BYTE_LIMIT_EXCEEDED` ebenfalls vor dem
  Snapshot-Aufbau.
- Ein gueltiger Bestand innerhalb des Limits wird vollstaendig geprueft.

Der Grenzwert ist kein Aufbewahrungszeitraum und keine fachliche
Loeschentscheidung. Er begrenzt nur den einzelnen Owner-Prueflauf.

## Gepruefte technische Vertragsanatomie

Der Preflight prueft den aktuellen Datenbankkatalog und den geschuetzten
Snapshot v3.

### Auditintegritaet

- exakte Anzahl und serialisierte Gesamtgroesse persistierter Auditlaeufe
- `therapy_retrieval_v2_invalid_audit_run_count_v1() = 0`
- dadurch mittelbar alle in 7B gebundenen 7A-, Envelope-, Regel-, Eingabe-,
  Release-, Repertoriums- und Zeilenhashes

### Append-only Schutz

Die vier erwarteten Trigger muessen vorhanden und aktiviert sein:

- Insert-Gate
- Update-/Delete-Sperre
- Truncate-Sperre
- aufgeschobene Insert-Validierung

Der Preflight deaktiviert oder umgeht keinen dieser Trigger.

### Restore-Fremdschluessel

Die drei Audit-Fremdschluessel muessen:

- validiert sein
- `DEFERRABLE` sein
- `ON DELETE NO ACTION` verwenden
- auf Therapie-Eingaberevision, Knowledge-Release und exakte
  Repertoriumsrevision zeigen

Damit bleibt ein Owner-Restore in einer einzigen Transaktion technisch
moeglich, waehrend inkompatible Wiki- oder Eingabedaten beim unmittelbaren
Constraint-Gate scheitern.

### RLS und Rechte

Der Preflight verlangt:

- aktive RLS auf `therapy_retrieval_audit_runs`
- genau die Admin-SELECT-Policy fuer `authenticated`
- keinen Tabellenzugriff fuer `anon` und Importrollen
- nur `SELECT` fuer `authenticated` und `service_role`
- kein `INSERT`, `UPDATE` oder `DELETE` fuer Anwendungs- oder Servicerollen
- nur den geschuetzten Snapshot-v3-Aufruf fuer `service_role`
- weiterhin keine Ausfuehrungsrechte auf dem 7B-Owner-Writer fuer Anwendungs-,
  Service- oder Importrollen

Die neue 7C-Funktion selbst wird fuer dieselben Rollen vollstaendig gesperrt.

## Snapshot- und Inventarbindung

Der Preflight ruft intern `therapy_input_export_snapshot_v3()` auf und verlangt:

- Snapshot-Version 3
- exakt die fuenf geschuetzten Therapie- und Audittabellen
- exakt die drei Integritaetszaehler mit Wert 0
- fuer jede Tabelle ein JSON-Array
- exakte Zeilenzahl pro Array
- reproduzierten SHA-256 fuer jeden unveraenderten Tabellenstring
- Uebereinstimmung von Auditzeilenzahl und Auditmanifest

Ausgegeben werden nur:

- ein kanonischer Hash des gesamten Fuenf-Tabellen-Manifests
- der bereits im Manifest enthaltene SHA-256 des Audit-Inventars
- Zeilenzahl, Bytemenge, Snapshot-Version, Tabellenzahl und technische
  Boolesche Nachweise

Der Preflight gibt keine Auditzeile, keine Fakten, keine Quellen, keine
Pseudonyme, keine Akteur-ID und keinen medizinischen Inhalt aus.

## Aufbewahrung bleibt unfreigegeben

Jeder Status setzt unveraenderlich:

- `retention_policy_status = UNAPPROVED_REQUIRES_OWNER_LEGAL_DECISION`
- `retention_start_basis = null`
- `retention_period_years = null`
- `retention_policy_approved = false`
- `retention_deletion_allowed = false`
- `operational_restore_drill_completed = false`
- `real_postgres_validation_completed = false`

Damit wird insbesondere nicht unterstellt, dass der technische
Persistenzzeitpunkt den rechtlich massgeblichen Fristbeginn darstellt. Die im
Praxisprojekt an anderer Stelle genannte Mindestaufbewahrung ersetzt keine
konkrete fachkundige Freigabe des Audit-Lebenszyklus.

## Positive und blockierte Statuswerte

Der positive technische Status lautet:

`AUDIT_RETENTION_RESTORE_TECHNICAL_PREFLIGHT_READY_INACTIVE`

Er setzt nur `technical_readiness_complete = true`. Die operative und rechtliche
Bereitschaft bleibt unvollstaendig.

Weitere Statuswerte sind:

- `AUDIT_RETENTION_RESTORE_EXPECTATION_INVALID`
- `AUDIT_RETENTION_RESTORE_LIMIT_EXCEEDED`
- `AUDIT_RETENTION_RESTORE_BYTE_LIMIT_EXCEEDED`
- `AUDIT_RETENTION_RESTORE_INTEGRITY_BLOCKED`
- `AUDIT_RETENTION_RESTORE_TECHNICAL_CONTRACT_BLOCKED`

Jede Antwort besitzt einen kanonischen Resultathash und setzt:

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

## Rechte und unveraenderte Grenzen

Die Funktion ist `SECURITY INVOKER`, `STABLE` und besitzt einen festen
`search_path`. `EXECUTE` ist fuer `PUBLIC`, `anon`, `authenticated`,
`service_role`, `kb_importer` und `kb_import_runtime` widerrufen. Es gibt keinen
Runtime-RPC.

Wiki-Snapshot, Therapie-Snapshot v2 und Therapie-Snapshot v3 bleiben
byteidentisch. Backup-Inventare und Restore-Anleitungen werden durch 7C nicht
geaendert. Release v1 bleibt hart inaktiv.

## Synthetische Nachweise

`src/test/therapy-retrieval-v2-preflight.test.ts` prueft fuer 7C:

- reine Ein-Funktionen-Migration ohne Schema-, Rechteerweiterungs- oder
  Schreib-DDL
- byteidentische Wiki-, Therapie-v2- und Therapie-v3-Snapshots
- exakte Katalogpruefung fuer Trigger, FKs, RLS, Policy und Rechte
- reproduzierte Hashes aller fuenf Snapshot-Tabellen
- Manifest- und Audit-Inventarhash ohne Inhaltsausgabe
- positiven technischen Status bei einer gueltigen Auditzeile
- fail-closed Status bei manipuliertem Audit-Zeilenhash
- ungueltige und ueberschrittene Zeilen- und Bytegrenzen
- explizit offene Rechtsfreigabe, Real-PostgreSQL-Pruefung und Restore-Drill
- fehlende Ausfuehrungsrechte aller Anwendungs-, Service- und Importrollen

Abschlussstand:

- fokussierter Schritt-6A-bis-7C-Vertrag in sechs disjunkten
  Hintergrundgruppen: 10 + 15 + 14 + 6 + 7 + 4 = 56/56 Tests
- zusammenhaengende Eingabe-, Release-, Regel-, Such-, Repertoriums- und
  Retrievalregression: 7/7 Dateien, 143/143 Tests
- vollstaendiger Projektlauf aus den gruppierten Retrievalvertraegen und dem
  uebrigen Projektbestand: 50/50 Dateien, 579/579 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf fuer die geaenderte TypeScript-Datei ohne Fehler
- Repository-Secret-Policy ohne Befund
- Produktionsbuild erfolgreich; nur die bekannten Browserslist-,
  Dependency-`eval`- und Chunkgroessenwarnungen
- `git diff --check` ohne Whitespacefehler; nur der bekannte
  LF-zu-CRLF-Arbeitskopiehinweis
- strukturierte P0/P1-Gegenpruefung: `APPROVE`; Zeilen-/Bytebegrenzung,
  vollstaendige DML-Matrix und die Selbstsperre des Preflights wurden vor der
  Freigabe gehaertet

## Bewusste Restrisiken und naechste Gates

- Eine fachkundige Entscheidung zu Rechtsgrundlage, Fristbeginn,
  Mindest-/Hoechstfrist, Ausnahmen, Legal Hold, Betroffenenrechten und sicherer
  Vernichtung fehlt weiterhin.
- Der Preflight loescht deshalb absichtlich nichts und kann keine operative
  Lebenszyklusfreigabe ersetzen.
- Reale PostgreSQL-Nebenlaeufigkeit, Locks, Queryplaene und Hoechstlast sind
  nicht durch PGlite abgedeckt.
- Ein verschluesselter Backup-/Restore-Drill auf einer isolierten echten
  PostgreSQL-Instanz steht aus.
- Replay, Schattenvergleich, KI, Planwahl, Dosierungsanzeige, sichtbare
  Therapieausgabe und Aktivierung bleiben technisch abwesend.

Ein weiterer additiver Block darf den positiven 7C-Status nicht als
Aufbewahrungs-, Loesch-, Betriebs- oder Aktivierungsfreigabe interpretieren.
