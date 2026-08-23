# Sorra an Lovable

message_id: `SLH-2026-08-23-004`
status: `sibo_retry_waiting_for_new_visible_peter_confirmation`
project: `naturheilpraxis-rauch`
supabase_project_ref: `jmebqjadlpltnqawoipb`

## Ziel

Genau die additive interne SIBO-Migration
`supabase/migrations/20260810170000_import_sibo_gasprofile_sources.sql` nach
einer rein lesenden Vorpruefung anwenden und nur Schluessel, Revisionen,
Anzahlen und Schutzstatus nachpruefen.

Normalisierte LF-Datei:

- Bytezahl: `12260`
- SHA-256: `d92764a70e2f2f3ba48fb1a22ce5e34d845a6ff51857c68725ca39d635d55cfb`

Der erste Versuch `SLH-2026-08-23-003` wurde wegen PostgreSQL 42702
vollstaendig atomar zurueckgerollt. Ursache war die mehrdeutige Variable
`article_id`. Im aktuellen GitHub-Stand ist sie an allen sieben
Variablenverwendungen in `v_article_id` umbenannt; die Spalte `article_id` in
der INSERT-Liste bleibt unveraendert. Der Regressionstest
`src/test/package-one-pending-migrations.test.ts` erzwingt diese Trennung.

Diese Datei ist keine Ausfuehrungsfreigabe. Vor jeder Schreiboperation muss
Peter im sichtbaren Lovable-Chat ausdruecklich bestaetigen:

`Ich bestaetige einmalig SLH-2026-08-23-004: korrigierte SIBO-Vorpruefung, genau Migration 20260810170000 und reiner Metadaten-Nachtest. Vieva, Patientendaten und alle anderen Aenderungen bleiben gesperrt.`

Ohne diese inhaltliche Bestaetigung nur den Auftrag erklaeren und nichts live
schreiben.

## Verbindliche Grenzen

- Aktives Cloudprojekt muss exakt `jmebqjadlpltnqawoipb` sein.
- Keine Patienten-, Therapie- oder sonstigen fachlichen Datensaetze lesen.
- Vieva nicht wiederholen oder veraendern.
- Keine andere Migration ausfuehren.
- Kein `migration repair`, Main-Merge, Deployment oder Veroeffentlichung.
- Keine automatische Produkt-, Therapie- oder Patientenverknuepfung.
- Bei jeder Abweichung vor einer Schreiboperation stoppen und berichten.

## 1. Rein lesende Vorpruefung

Fuer exakt diese drei Schluessel muss der Bestand jeweils 0 sein:

1. `source:sibo-pdf-2026-08-10`
2. `source:dr-kirkamm-sibo-public-material`
3. `reference:sibo-gasprofile-drei-formen-pdf-kirkamm`

Zusaetzlich pruefen und im Bericht ausgeben:

- Tabellen und benoetigte Spalten in `kb_sources`, `kb_source_revisions`,
  `kb_articles` und `kb_article_revisions` sind vorhanden.
- Fremdschluessel und Eindeutigkeitsregeln passen zur Migration.
- Dateihash und Bytezahl stimmen exakt mit den obigen Werten.
- `v_article_id` ist deklariert und die Bedingung lautet eindeutig
  `existing_revision.article_id = v_article_id`; eine Variable
  `article_id uuid` ist nicht mehr deklariert.
- Die Migration ist mit `BEGIN`/`COMMIT` transaktionsgebunden.
- Sie beruehrt weder `admin_knowledge_base` noch `therapy_sessions`.
- Alle Inhalte bleiben intern, ungeprueft und nicht patientengerichtet.

Wenn ein Schluessel bereits vorhanden ist oder eine Pruefung abweicht: stoppen
und nichts schreiben.

## 2. Genau eine Migration

Nach Peters sichtbarer Bestaetigung ausschliesslich
`20260810170000_import_sibo_gasprofile_sources.sql` als eine Transaktion
anwenden. Keine zweite Datei und kein Historien-Reparaturbefehl.

## 3. Rein lesender Nachtest

Nachher exakt pruefen:

- zwei Quellschluessel und ein Artikelschluessel vorhanden
- genau zwei Quellrevisionen mit `revision_no=1`
- genau eine Artikelrevision mit `revision_no=1`
- `current_revision_id` zeigt jeweils auf die erzeugte Revision
- Quellen-Metadaten jeweils `admin_only=true`
- Artikel-Metadaten `admin_only=true`, `patient_facing_allowed=false` und
  `review_status=unreviewed`
- Quell- und Artikelrevisionen `review_status=draft`
- keine Produkt-, Therapie- oder Patientenverknuepfung
- Migrationshistorie genau eine neue SIBO-Zeile und keine weitere neue Zeile

Erzeuge nach dem Nachtest eine direkt nutzbare, aber nicht ausgefuehrte
Rollback-Datei. Sie darf nur die in diesem Lauf erzeugten Revisionen und drei
festen Schluessel in korrekter Fremdschluesselreihenfolge entfernen, muss vorher
alle erzeugten IDs und unerwarteten Referenzen pruefen und bei einer Abweichung
geschlossen abbrechen. Rollback niemals automatisch ausfuehren.

## Abschlussbericht

Antwort im Lovable-Chat und, falls GitHub-Push moeglich, mit derselben
`message_id` in `docs/lovable-sorra-response.md`:

- `project_ref`
- `precheck_passed`
- drei Vorherzaehler
- Tabellen-, Spalten-, Fremdschluessel- und Eindeutigkeitspruefung
- Dateibytes und SHA-256
- `migration_applied` und Transaktionsergebnis
- alle erzeugten IDs, Schluessel, Revisionsnummern und Schutzstatus
- neue Migrationshistorienzeile
- vollstaendiger Rollback-Wortlaut in einem Codeblock
- `patient_rows_read` muss 0 sein
- `other_migrations_applied` muss 0 sein
- `vieva_changed` muss false sein
- `product_therapy_patient_links_created` muss 0 sein
- `deployment_or_publish` muss false sein
- Warnungen oder Abweichungen

Bei einem Fehler waehrend der Transaktion zuerst zurueckrollen. Keine
eigenstaendige Reparatur ausfuehren.
