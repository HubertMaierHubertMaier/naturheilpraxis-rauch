# Wiki Schritt 7E: Ephemere PostgreSQL-Dump-/Restore-Probe

Stand: 2026-08-04

Status: implementiert und lokal sowie gegen PostgreSQL 17 verifiziert. Der
isolierte GitHub-Lauf hat alle sechs Vertragsgruppen und die zusaetzliche
Dump-/Restore-Probe bestanden. Es gibt kein Supabase-Deployment, keine echten
medizinischen Daten und keine Verbindung zum sichtbaren Therapiepfad.

## Ziel und harte Grenze

Schritt 7E erweitert ausschliesslich den nichtproduktiven CI-Nachweis aus 7D.
Nach der erfolgreichen synthetischen Auditpersistenz-Gruppe wird dieselbe
ephemere PostgreSQL-17-Datenbank logisch gesichert und in eine zweite leere
Datenbank desselben Wegwerfcontainers restauriert.

Die Probe ist bewusst kein operativer oder verschluesselter Backup-/Restore-
Drill. Sie genehmigt weder eine Aufbewahrungs- oder Loeschregel noch
Deployment, Replay, Schattenlauf, KI, Planwahl, Dosierungsanzeige, medizinische
oder produktive Nutzung oder Aktivierung.

## Synthetischer Quellbestand

Die Probe laeuft nur nach

`group-5-audit-persistence`

des bestehenden PostgreSQL-17-Matrixvertrags. Dadurch enthaelt die Quelle
ausschliesslich die bereits versionierten synthetischen Fixtures aus
`therapy-retrieval-v2-preflight.test.ts`, einschliesslich genau einer gueltigen
append-only Auditzeile. Es werden keine externen Dienste, Supabase-Projekte,
Secrets oder Echtdaten gelesen.

Vor dem Dump muss der 7C-Preflight den weiterhin inaktiven Status

`AUDIT_RETENTION_RESTORE_TECHNICAL_PREFLIGHT_READY_INACTIVE`

und `technical_readiness_complete = true` liefern.

## Begrenzter logischer Dump

Der Workflow ermittelt genau einen lokalen `postgres:17`-Servicecontainer und
fuehrt darin den mit derselben PostgreSQL-Version gelieferten `pg_dump` aus:

- Custom-Format fuer einen strukturierten `pg_restore`
- nur die ephemere Datenbank `retrieval_contract`
- keine Artifact-Uebertragung und kein externer Speicher
- Dumpdatei ausschliesslich unter `/tmp` im Servicecontainer
- positive Dateigroesse und harte Obergrenze von 64 MiB

Der Dump wird weder als verschluesselt noch als aufbewahrungsfaehig bezeichnet.
Mit dem CI-Job wird der gesamte Container samt Dumpdatei verworfen.

## Transaktionaler Zielrestore

Im selben isolierten Cluster wird eine neue Datenbank `retrieval_restore` aus
`template0` angelegt. `pg_restore` verwendet:

- `--exit-on-error`
- `--single-transaction`
- den bestehenden synthetischen PostgreSQL-Superuser
- keine Berechtigungslockerung und keinen Anwendungsschluessel

Ein Fehler bricht den Zielrestore ab. Es gibt keinen partiell als erfolgreich
gewerteten Zustand und keinen Loesch- oder Clean-Lauf gegen eine vorhandene
Datenbank.

## Quell-/Zielvertrag

Vor dem Dump und nach dem Restore wird derselbe kanonische Vertrag berechnet:

- SHA-256 des exakten Wiki-Snapshottexts
- SHA-256 des exakten Therapie-Snapshot-v2-Texts
- SHA-256 des exakten Therapie-Snapshot-v3-Texts
- SHA-256 des vollstaendigen 7C-Aufbewahrungs-/Restore-Preflightresultats

Der letzte Hash bindet insbesondere Auditbestand, Nullzaehler, Trigger,
Restore-Fremdschluessel, RLS, Policy, Tabellenrechte, Snapshot-v3-Inventar und
den geschlossenen Persistenzwriter. Zusaetzlich muss der Zielpreflight exakt
denselben positiven, weiterhin inaktiven technischen Status wie die Quelle
liefern.

Jede Abweichung eines Snapshots, Integritaetszaehlers oder Rechtevertrags laesst
den Job fehlschlagen.

## CI-Sicherheitsgrenze

7E behaelt die 7D-Grenzen bei:

- Repositoryberechtigung nur `contents: read`
- keine GitHub-Secrets
- keine Verbindung zu einer externen Datenbank
- kein Upload des Dumps
- kein Deploy-, Supabase-Push- oder Produktionsbefehl
- keine explizite Datenbankloeschung
- automatische Entsorgung beider Datenbanken durch den GitHub-Servicecontainer

Die Probe startet zusaetzlich auf `db-step7e-*`; PGlite bleibt lokal weiterhin
der konfigurationsfreie Standard.

## Statische lokale Nachweise

`src/test/therapy-retrieval-postgres-conformance.test.ts` prueft zusaetzlich:

- Bindung der Probe ausschliesslich an Gruppe 5
- Custom-Dump und transaktionalen fail-closed Restore
- frische `template0`-Zieldatenbank
- 64-MiB-Grenze
- alle drei Snapshothashes und den 7C-Vertrag
- exakten Quell-/Zielvergleich
- Abwesenheit von Artifact-Upload und `DROP DATABASE`

Der statische Konformitaetsvertrag besteht lokal mit 4/4 Tests.

## PostgreSQL-17-Ergebnis

Der finale Workflow lief fuer Commit
`fe7dd95f40edf2ee96364b884fcac9d6388c20c4` erfolgreich:

<https://github.com/HubertMaierHubertMaier/naturheilpraxis-rauch/actions/runs/30904172952>

Alle sechs PostgreSQL-17.10-Gruppen meldeten `success`. In Gruppe 5 bestanden
zuerst alle sieben Auditpersistenztests und danach der eigene Schritt
`Rehearse an ephemeral synthetic dump and restore`. Damit sind nachgewiesen:

- erfolgreicher begrenzter Custom-Dump der synthetischen Quelle
- erfolgreicher fail-closed Ein-Transaktions-Restore in `retrieval_restore`
- identische Quell-/Zielhashes fuer Wiki-, Therapie-v2- und
  Therapie-v3-Snapshot
- identischer 7C-Integritaets-/Rechtevertrag und technischer Bereitschaftsstatus
- erfolgreiche automatische Entsorgung des PostgreSQL-Servicecontainers

Der Lauf erzeugte und behielt kein Backup-Artefakt ausserhalb des verworfenen
Containers.

## Bewusste Restrisiken und naechste Gates

- Quelle und Ziel liegen im selben ephemeren Cluster; ein unabhaengiger Host-
  oder Regionsausfall wird nicht simuliert.
- Der Dump ist nicht verschluesselt und wird nicht in einem kontrollierten
  Backupmedium aufbewahrt.
- Schluesselverwaltung, Zugriffstrennung, Aufbewahrung, sichere Vernichtung,
  Wiederanlaufzeit und Wiederherstellungspunktziel werden nicht geprueft.
- Es gibt weiterhin keine fachkundige Datenschutz-, Betriebs- oder medizinische
  Abnahme.
- Reale Last, Nebenlaeufigkeit und Langzeitwachstum bleiben separate Gates.

Ein erfolgreicher 7E-Lauf ist ausschliesslich ein technischer, synthetischer
Portabilitaetsnachweis und keine operative Restore- oder Produktionsfreigabe.
