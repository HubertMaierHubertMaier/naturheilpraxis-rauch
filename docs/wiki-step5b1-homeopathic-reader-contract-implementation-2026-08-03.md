# Wiki Schritt 5B-1: Deterministischer Einzelrepertorium-Reader

Stand: 2026-08-03

Status: implementiert und vollstaendig lokal verifiziert. Kein
Supabase-Deployment, kein Repertoriumsimport und keine medizinische Nutzung.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260803100000_create_kb_homeopathic_reader_contract.sql`

ergaenzt den Step-5A-Repertoriumsvertrag um einen medizinisch inaktiven,
deterministischen Owner-Reader fuer genau eine Repertoriumsrevision. Sie legt
keine Tabelle, keinen Inhalt und keinen Runtime-Zugriff an.

Der Block dient ausschliesslich dazu, den spaeteren Readervertrag mit
vollstaendig synthetischen, nichtmedizinischen Testdaten festzulegen. Er ist
kein Importvertrag und ersetzt die fuer echte Daten zwingend erforderliche
Lizenz-, Quellen-, Fach- und Performanceabnahme nicht.

Nicht Bestandteil von Schritt 5B-1 sind:

- echte Repertorien, Rubriken, Grade, Mittel oder Zuordnungen
- lizenzierter oder urheberrechtlich ungeklaerter Inhalt
- Parser, Importer, Bulk-Writer, Backfill oder Kandidatenpromotion
- Patienten-, Nutzer-, Sitzungs-, Anamnese- oder Therapieverknuepfungen
- Materia-medica-Abgleich, Praxiserfahrung oder Wirksamkeitsbewertung
- Dosierung, Potenz, Darreichung, Produktvariante oder Mittelverordnung
- Sicherheitsfreigabe oder Aufhebung eines Ausschlusses
- Release-Aktivierung oder Anbindung an `therapy-recommend`
- ein Grant an `authenticated`, `service_role`, Importrollen oder Patienten

## Vier Funktionen

### Spurstatus

`kb_homeopathic_repertory_lane_status_v1()` liefert ausschliesslich:

- `HOMEOPATHIC_LANE_READY`
- `HOMEOPATHIC_LANE_UNAVAILABLE`

Bereit ist eine Spur nur, wenn das exakte Repertoriums-/Revisionspaar den
vollstaendigen Step-5A-Validator besteht, Repertorium und Quelle mindestens
`approved` sind, der Quellenstatus `own_content`, `licensed` oder
`public_domain` ist und mindestens eine exakte Rubrik-Mittel-Grad-Zuordnung
existiert. Jeder andere Zustand bleibt geschlossen.

### Anfragevalidierung

`kb_homeopathic_repertorization_request_is_valid_v1()` akzeptiert ein Array von
1 bis 256 Objekten. Jedes Objekt besitzt exakt:

- `rubric_revision_id`: UUID einer Rubrikrevision desselben Repertoriums
- `importance`: ganze Zahl von 1 bis 5
- `polarity`: `include` oder `exclude`

Mindestens eine Einschlussrubrik ist erforderlich. Doppelte Rubrikrevisionen,
Zusatzfelder, falsche Typen, revisionsfremde Rubriken, ungueltige UUIDs und mehr
als 128 KiB Anfragegroesse werden fail-closed abgelehnt.

### Kanonisches Anfragemanifest

`kb_homeopathic_repertorization_request_manifest_v1()` sortiert die gueltige
Anfrage unabhaengig von ihrer Eingabereihenfolge. Das Manifest bindet fuer jede
Rubrik die stabile Rubrikidentitaet, native Quellenkennung, Text, Domaene,
Inhaltshash, Wichtigkeit und Polaritaet an das exakte Repertorium. Daraus wird
ein reproduzierbarer SHA-256 erzeugt.

### Deterministischer Reader

`kb_homeopathic_repertorize_single_v1()` liefert genau einen kanonischen
JSON-Vertrag. Zustaende sind:

- `HOMEOPATHIC_LANE_UNAVAILABLE`
- `HOMEOPATHIC_REQUEST_INVALID`
- `HOMEOPATHIC_NO_REPERTORY_MATCHES`
- `HOMEOPATHIC_REPERTORY_MATCHES_READY`

Die ersten beiden Fehlerzustaende enthalten immer eine leere Kandidatenliste.
Eine gueltige Anfrage unterscheidet einen leeren Trefferstand von vorhandenen
Treffern. Es gibt keinen Teiltreffer bei ungueltiger oder nicht freigegebener
Grundlage.

## Getrennte Ergebnisdimensionen

Ein Treffer besitzt keinen undurchsichtigen Gesamtscore. Sichtbar bleiben:

- Zahl abgedeckter Einschlussrubriken und Zahl angefragter Einschlussrubriken
- abgedeckte und angefragte Wichtigkeit
- abgedeckte und angefragte Rubrikdomaenen
- Zahl expliziter Ausschlussrubrik-Konflikte
- vollstaendiges source-native Gradprofil mit Code, Bezeichnung und Reihenfolge
- jede exakte Rubrik-Mittel-Grad-Zuordnung mit allen Inhaltshashes und Fundstelle

Die deterministische Ordnung verwendet nacheinander:

1. weniger Ausschlussrubrik-Konflikte
2. mehr abgedeckte Wichtigkeit
3. mehr abgedeckte Einschlussrubriken
4. mehr abgedeckte Domaenen
5. normalisierte quelleneigene Mittelkennung
6. stabile Mittelzuordnungs-UUID

Das source-native Gradprofil bleibt getrennt sichtbar und wird weder in eine
repertoriumsuebergreifende Zahl umgerechnet noch als Wirksamkeit interpretiert.
Die feste Ergebniskonstante
`SOURCE_NATIVE_REPERTORY_MATCH_NOT_EFFICACY` und der Kandidatenstatus
`REPERTORY_MATCH_ONLY` verhindern eine Umdeutung in `ALLOW`, Dosierung oder
Behandlungsempfehlung.

## Reproduzierbarkeit

Das Ergebnis enthaelt:

- Vertragsversion 1
- exaktes Repertoriums-/Revisionspaar und dessen Inhaltshash
- kanonisches Anfragemanifest und Anfragehash
- Gesamtzahl und tatsaechlich zurueckgegebene Kandidatenzahl
- deterministisch geordnete Kandidaten
- einen SHA-256 des vollstaendigen Ergebnispayloads

Eine Permutation derselben Anfrage erzeugt bytegleiches JSON und denselben
Ergebnishash. Ein Limit von 1 bis 200 schneidet nur die Ausgabe ab; die
Gesamtzahl bleibt sichtbar.

## Zugriff und Datenhaltung

Alle vier Funktionen sind `SECURITY INVOKER`. `EXECUTE` ist fuer `PUBLIC`,
`anon`, `authenticated`, `service_role`, `kb_importer` und
`kb_import_runtime` widerrufen. Es gibt absichtlich keinen Runtime-Grant.

Die Migration erzeugt keine Tabelle und veraendert keine vorhandene Tabelle.
Der gemeinsame Wiki-Snapshot bleibt byteidentisch bei exakt 65 Tabellen. Der
Therapie-Input-Snapshot v2 bleibt ebenfalls unveraendert bei vier Tabellen.
Release v1 bleibt hart `retrieval_eligible = false` und `is_active = false`.

## Testabdeckung

Der fokussierte Test

`src/test/wiki-step5b1-homeopathic-reader-contract.test.ts`

deckt insbesondere ab:

- reine Funktionsmigration ohne Tabellen, Seed, Patientendaten oder Grants
- byteidentischen 65-Tabellen-Wiki-Snapshot vor und nach der Migration
- byteidentischen Vier-Tabellen-Therapie-Input-Snapshot v2
- geschlossene Spur fuer unbekannte oder nicht freigegebene Repertorien
- geschlossene Spur bei fehlenden Repertoriumskennungen
- Ablehnung fehlerhafter, uebergrosser, doppelter und revisionsfremder Rubrikanfragen
- drei synthetische Mittel mit getrennten Abdeckungs-, Konflikt- und Gradprofilen
- deterministische Reihenfolge und kanonische Anfragepermutation
- unverkuerzte Gesamtzahl bei begrenzter Ausgabe
- reproduzierbare Anfrage- und Ergebnishashes
- fehlende Ausfuehrungsrechte aller Anwendungs- und Importrollen

Fokussierter Zwischenstand: 5/5 Tests bestanden.

## Abschlussreview und Verifikation

Das Abschlussreview schloss vor der Sicherung drei Randfaelle:

- Fehlende Repertoriumskennungen liefern nun garantiert
  `HOMEOPATHIC_LANE_UNAVAILABLE`, statt durch SQL-Dreiwertlogik in einen anderen
  Fehlerstatus zu fallen.
- Nicht-Array-JSON wird vor jeder Arrayoperation geschlossen abgelehnt; die
  dokumentierte Gesamtgrenze von 128 KiB wird explizit vor der Einzelpruefung
  durchgesetzt.
- Die letzte fachliche Kandidatenordnung verwendet tatsaechlich den
  normalisierten source-native Mittelschluessel. Ein gemischt geschriebener
  synthetischer Testcode verhindert eine unbemerkte Rueckkehr zur rohen
  byteweisen Schreibweisensortierung.

Abschlussstand nach den Korrekturen:

- fokussierter Step-5B-1-Test: 5/5 Tests
- vollstaendiger Projektlauf: 46/46 Dateien, 501/501 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf der beiden beteiligten Tests ohne Fehler
- Produktionsbuild erfolgreich; nur bestehende Browserslist-, Dependency-`eval`-
  und Chunkgroessenwarnungen
- `git diff --check` ohne Whitespacefehler; nur bestehende
  LF-zu-CRLF-Arbeitskopiehinweise
- projektweiter ESLint-Baseline-Lauf weiterhin rot mit 397 Fehlern in
  unberuehrten Altdateien; keine Meldung betrifft Step 5B-1
- finales Review ohne verbleibenden P0/P1-Befund

## Offene Step-5B-Grenzen

Vor echten Repertoriumsdaten bleiben zwingend offen:

1. konkrete lizenzierte oder gemeinfreie Quelle fachlich freigeben
2. separat abgenommenen Parser-/Bulk-Importvertrag entwerfen
3. grosse Rubrik-, Alias- und Assignmentmengen auf echtem PostgreSQL profilieren
4. deferred Abschlusspruefungen und Deadlockverhalten im Batch testen
5. source-native Gradaussage und Leserichtung der konkreten Quelle dokumentieren
6. Repertoriumsrelease und Runtime-Reader erst nach Restore-, RLS- und Fachabnahme
   in einem neuen Vertrag freigeben

Bis dahin bleibt der neue Reader eine owner-only getestete Vertragsreferenz.
