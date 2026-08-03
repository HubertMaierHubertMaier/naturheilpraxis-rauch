# Wiki Schritt 5B-5: Owner-only Repertoriums-Referenzwriter

Stand: 2026-08-03

Status: implementiert und vollstaendig lokal verifiziert. Kein Rohdatenparser,
kein echter Repertoriumsimport, kein Supabase-Deployment und keine medizinische
Nutzung.

## Ziel und harte Grenze

Die Migration

`supabase/migrations/20260803120000_create_kb_homeopathic_small_bundle_writer.sql`

fuegt genau eine Funktion hinzu:

`public.kb_homeopathic_write_small_bundle_v1(jsonb)`

Sie ist ein kleiner atomarer Referenzwriter fuer ein bereits normalisiertes und
vollstaendig vorgehashtes Repertoriumsbuendel. Sie zeigt, dass die
parserseitigen Step-5B-3-/5B-4-Vertraege und der datenbankseitige
Step-5B-2-Preflight ohne Zwischenzustand zusammenarbeiten.

Der Writer ist ausdruecklich kein Chunk- oder Bulk-Importer. Er liest keine
Quelldatei, erzeugt keine Quellen, Entitaeten oder generischen Revisionen und
aktiviert weder Release noch Retrieval oder Therapiepfad.

## Eingangsvertrag

Der Umschlag ist auf Vertragsversion 1, den Scope
`HOMEOPATHIC_SMALL_BUNDLE_WRITE_ONLY` und `general_knowledge` festgelegt. Er
enthaelt:

- eine bereits vorhandene Quellen- und Repertoriumsrevisionsbindung
- vollstaendige normalisierte Rubrik-, Grad-, Mittel- und Assignmentzeilen
- die fuenf parserseitig gebildeten Zeilenhashtypen
- den vor dem Schreiben gebildeten Step-5B-3-Bundlehash

Objekte muessen exakt die vorgesehenen Schluessel besitzen. UUIDs und
SHA-256-Werte sind kanonisch kleingeschrieben, JSON-Skalare haben den richtigen
Typ, Ordnungswerte sind positive Ganzzahlen und Mittelaliase ausschliesslich
Strings. Datenbankchecks und die abschliessende semantische Validierung pruefen
zusaetzlich Textgrenzen, kontrollierte Werte, Eindeutigkeit, Hierarchie und alle
Querverweise.

Der Referenzpfad ist begrenzt auf:

- 4 MiB kanonischen JSON-Text
- 256 Rubriken
- 64 source-native Graddefinitionen
- 256 Mittelzuordnungen
- 2.048 Assignments

Alle vier Komponenten muessen mindestens eine Zeile enthalten.

## Schreib- und Rollbacksemantik

Ein neuer Lauf setzt ausschliesslich den vorab berechneten Repertoriumshash und
schreibt die sechs vorhandenen Step-5A-Tabellen. Quelle, Repertoriumsrevision und
generische Mittelrevisionen muessen bereits in derselben owner-gesteuerten
Transaktion oder als gueltige Abhaengigkeiten vorliegen. Eine neue
Repertoriumsrevision muss `draft` sein.

Nach den Inserts werden jede gespeicherte Spalte, alle Zeilenhashes, die
vollstaendige Repertoriumssemantik und zuletzt Bundlehash sowie vier Zaehler
erneut geprueft. Nur `HOMEOPATHIC_IMPORT_BUNDLE_READY` wird zurueckgegeben. Jede
Abweichung loest eine Exception aus und rollt damit saemtliche Aenderungen des
Writeraufrufs atomar zurueck.

Der PGlite-Kreuztest setzt vor einem absichtlich falschen Assignmenthash einen
Savepoint. Nach der erwarteten Exception sind alle sechs Tabellen leer und der
urspruengliche Repertoriumshash unveraendert. Erst der korrekte Parserumschlag
wird anschliessend festgeschrieben.

## Exakte Wiederholung

Ist die Repertoriumsbindung bereits vorhanden, fuehrt die Funktion keine
erneuten Writes aus. Stattdessen vergleicht sie jede uebergebene Zeile exakt mit
dem gespeicherten Stand und wiederholt Semantik- und Preflightpruefung.

Dadurch gilt:

- ein bytegleiches Buendel liefert denselben Preflight inklusive Resultathash
- Zeilenzahlen bleiben bei Wiederholung unveraendert
- eine abweichende Wiederholung scheitert vor jeder Aenderung
- eine exakte Wiederholung bleibt auch nach der spaeteren Freigabe der
  beteiligten Revisionen moeglich, ohne eingefrorene Inhalte anzufassen

## Rechte und Schutzgrenzen

Die Funktion ist `SECURITY INVOKER` und vergleicht `current_user` mit dem
Tabellenowner. Alle Ausfuehrungsrechte fuer `PUBLIC`, `anon`, `authenticated`,
`service_role`, `kb_importer` und `kb_import_runtime` sind widerrufen. Die
Migration enthaelt keine Runtime-Freigabe und keine Patienten-, Sitzungs- oder
Therapiereferenz.

Die Installation erzeugt keine Tabelle und keine Inhaltszeile. Der 65-Tabellen-
Wiki-Snapshot und der vierteilige Therapie-Input-Snapshot bleiben byteidentisch.
Ein aktives oder retrieval-faehiges Knowledge-Release wird weiterhin
fail-closed ausgeschlossen.

## Abschlussreview und Verifikation

Abschlussstand:

- fokussierter Writer-/Preflightlauf: 1/1 Datei, 10/10 Tests
- zusammenhaengende Repertoriumsregression Step 5A bis 5B-5: 5/5 Dateien,
  32/32 Tests
- vollstaendiger Projektlauf: 49/49 Dateien, 517/517 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf der geaenderten Tests ohne Fehler
- Produktionsbuild auf Node 20.20.2 und npm 10.9.9 erfolgreich; nur die
  bestehenden Browserslist-, Dependency-`eval`- und Chunkgroessenwarnungen
- `git diff --check` ohne Whitespacefehler; nur bekannte
  LF-zu-CRLF-Arbeitskopiehinweise
- projektweite ESLint-Baseline unveraendert bei 397 Fehlern und 40 Warnungen in
  unberuehrten Altdateien

## Weiterhin offene Gates

Vor einem echten Repertoriumsimport bleiben zwingend offen:

1. konkrete lizenzierte oder gemeinfreie Quelle fachlich freigeben
2. quellenspezifischen Rohdatenparser und Gold-Fixtures abnehmen
3. Quelleninhalt, Metadaten und generische Mittelrevisionen reproduzierbar bilden
4. owner-only Chunk-/Bulk-Writer mit Batchidentitaet und Resume entwerfen
5. Grossmengen, Locks und deferred Pruefungen auf echtem PostgreSQL profilieren
6. Backup, Restore, RLS und Freigabeprozess separat abnehmen

Schritt 5B-5 ist damit nur der atomare synthetische Kleinmengenbeweis und keine
Import-, Release-, Wirksamkeits- oder Therapiefreigabe.
