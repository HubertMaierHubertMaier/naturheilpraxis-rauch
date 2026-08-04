# Wiki Schritt 7D: PostgreSQL-17-Konformitaetslauf

Stand: 2026-08-04

Status: lokal implementiert. Der lokale PGlite-Vertrag und die statischen
CI-Nachweise sind verifiziert; der isolierte PostgreSQL-17-Lauf wird auf dem
zugehoerigen GitHub-Branch ausgefuehrt. Es gibt kein Supabase-Deployment, keine
echten medizinischen Daten und keine Verbindung zum sichtbaren Therapiepfad.

## Ziel und harte Grenze

Schritt 7D fuegt keine Datenbankmigration und keinen Anwendungs- oder
Produktionspfad hinzu. Der bestehende synthetische Vertrag aus

`src/test/therapy-retrieval-v2-preflight.test.ts`

wird unveraendert mit zwei Datenbanktreibern ausfuehrbar:

- PGlite bleibt ohne Konfiguration der lokale Standard.
- Nur die explizite Testvariable
  `THERAPY_RETRIEVAL_TEST_DATABASE_URL` schaltet auf den Node-PostgreSQL-Treiber
  `pg` um.

Dadurch prueft PostgreSQL exakt dieselben Migrationen, Fixtures,
Hashberechnungen, Trigger, Transaktionen, RLS-Regeln, Rollenmatrizen,
Auditpersistenz, Restore-Schritte und Governance-Sperren wie PGlite. Es gibt
keine vereinfachte zweite SQL-Testkopie.

## Lokale Laufzeitgrenze

Auf der lokalen Windowsumgebung sind weder Docker noch Podman noch `psql`
installiert. Ein lokaler echter PostgreSQL-Lauf wird deshalb nicht vorgetaescht
und es wird keine Software oder Datenbankinstanz produktiv installiert.

Ohne Test-URL erzeugt `createTestDatabase()` weiterhin ausschliesslich eine
ephemere PGlite-Instanz. Der neue Treiber hat damit keine Wirkung auf normale
lokale Projekt-, Build- oder Anwendungslaufzeiten.

## Optionaler PostgreSQL-Treiber

Die Testabstraktion besitzt nur die drei bereits verwendeten Operationen:

- `exec(sql)` fuer nicht parametrisierte Mehrfachstatements
- `query(sql, params)` fuer genau ein parametrisiertes Statement
- `close()` fuer kontrolliertes Beenden

Der PostgreSQL-Adapter verwirft Mehrfachresultate bei `query`, damit kein
Treiberunterschied still akzeptiert wird. Der PGlite-Adapter kapselt dieselbe
Oberflaeche. Anwendungscode importiert `pg` nicht.

`pg` und `@types/pg` sind reine Entwicklungsabhaengigkeiten. Die Test-URL steht
weder im Quelltest noch in der Anwendung; sie wird ausschliesslich von der
isolierten CI-Laufzeit gesetzt.

## PostgreSQL-17-Matrix

Der Workflow

`.github/workflows/therapy-retrieval-postgres-conformance.yml`

startet pro Vertragsgruppe einen frischen offiziellen `postgres:17`-Service.
Die sechs disjunkten Gruppen decken zusammen alle 56 Tests ab:

- 10 Eingabe- und Entity-Resolution-Vertraege
- 15 Split-Track- und Safety-Vertraege
- 14 Kandidaten- und Dosierungsregelvertraege
- 6 Audit-Envelope-Vertraege
- 7 Auditpersistenz-, Restore- und Rechtevertraege
- 4 Aufbewahrungs-/Restore-Governance-Vertraege

Hoechstens drei Gruppen laufen parallel; jede Gruppe besitzt ein
15-Minuten-Limit und eine eigene leere Datenbank. Damit gibt es keine
gruppenuebergreifenden Rollen-, Tabellen- oder Triggerreste.

## CI-Sicherheitsgrenze

Der Workflow:

- besitzt nur `contents: read`
- verwendet Node 20 und `npm ci`
- verwendet ausschliesslich synthetische lokale Service-Zugangsdaten
- liest keine GitHub-Secrets
- ruft weder Supabase noch Lovable noch eine andere externe Datenbank auf
- enthaelt keinen Deploy-, Push-, Migrations- oder Produktionsbefehl
- wird nur bei passenden Retrieval-/Migrationspfaden, auf `db-step7d-*`, in
  Pull Requests oder manuell gestartet

Die PostgreSQL-Service-Datenbank existiert nur fuer den jeweiligen CI-Job und
wird danach verworfen.

## Statische lokale Nachweise

`src/test/therapy-retrieval-postgres-conformance.test.ts` prueft:

- PGlite als unveraenderten Default
- PostgreSQL nur hinter der expliziten Testvariable
- dynamischen `pg`-Import ausschliesslich im Test
- vorhandene Entwicklungsabhaengigkeiten
- offizielles PostgreSQL 17 und Node 20
- genau sechs Matrixgruppen
- Parallelitaets- und Zeitgrenzen
- `npm ci` und den exakten Retrieval-Testbefehl
- minimale Workflowrechte
- Abwesenheit von Secrets und Deploymentpfaden

## Lokale Verifikation

Die Abschlussverifikation verwendet wegen der dokumentierten lokalen
Ressourcengrenzen denselben gruppierten Vertrag wie die CI statt eines einzigen
monolithischen PGlite-Prozesses:

- sechs disjunkte PGlite-Gruppen mit `10 + 15 + 14 + 6 + 7 + 4 = 56/56`
  bestandenen Retrievaltests und leeren Fehlerlogs
- statischer Treiber-, Matrix- und Sicherheitsvertrag mit 3/3 Tests
- uebrige Projektsuite mit 50/50 Dateien und 526/526 Tests
- damit insgesamt 51 Testdateien und 582 Tests ohne Abdeckungsluecke
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf der zwei betroffenen Testdateien ohne Fehler
- Produktionsbuild mit Node 20.20.2 und npm 10.9.9 erfolgreich

Ein unter Node 20 sichtbar gewordener bestehender Laufzeitgrenzfall wurde
explizit gemacht: Der Cherry-Picking-Integritaetstest benoetigte lokal knapp
mehr als das implizite Fuenf-Sekunden-Standardlimit. Er besitzt nun wie die
benachbarten schweren Integritaetstests ein ausdrueckliches 15-Sekunden-Limit;
die isolierte Node-20-Wiederholung bestand in 4,973 Sekunden. Fachlogik,
Erwartungen und Datenbankoperationen wurden dabei nicht geaendert.

Der Build meldet ausschliesslich die bereits sichtbaren Hinweise zu veralteten
Browserslist-Daten, `eval` in der Drittbibliothek Bluebird und grossen Chunks.
7D fuegt keinen Anwendungsbundle-Import und keinen neuen Produktionschunk hinzu.

## Unveraenderte Produktgrenzen

7D erzeugt keine neue fachliche Antwort und keinen Datenbankstatus. Alle
Sperren aus 7C bleiben unveraendert:

- keine Aufbewahrungs- oder Loeschfreigabe
- kein Replay oder Schattenlauf
- keine KI oder Planwahl
- keine Dosierungsanzeige
- keine medizinische oder produktive Nutzung
- keine Aktivierung

Ein bestandener PostgreSQL-Lauf bestaetigt nur die technische Portabilitaet des
synthetischen Vertrags. Er ist weder eine Datenschutz-, Restore-, Betriebs-,
medizinische noch produktive Freigabe.

## Bewusste Restrisiken und naechste Gates

- CI bildet keine Supabase-spezifische Netzwerk-, Auth-, Backup- oder
  Betriebsumgebung ab.
- Lastprofile, Langzeitwachstum und echte gleichzeitige Owner-Aufrufe benoetigen
  spaeter eigene, freigegebene Tests.
- Ein operativer verschluesselter Restore-Drill bleibt offen.
- Rechtsgrundlage, Aufbewahrungsbeginn, Frist und sichere Vernichtung bleiben
  persoenlich und fachkundig zu entscheiden.
- Es werden weiterhin keine echten medizinischen Daten oder Regeln verwendet.

Der naechste Block darf einen erfolgreichen CI-Lauf nicht als Aktivierung oder
Produktionsbereitschaft interpretieren.
