# Wiki Schritt 5B-6: Owner-only Chunk-Staging und Resume

Stand: 2026-08-03

Status: implementiert und vollstaendig lokal verifiziert. Kein Rohdatenparser,
kein echter Repertoriumsimport, kein Supabase-Deployment und keine medizinische
Nutzung.

## Ziel und harte Grenze

Die Migration

`supabase/migrations/20260803130000_create_kb_homeopathic_chunk_import_contract.sql`

ergaenzt den atomaren Step-5B-5-Kleinmengenwriter um einen persistenten,
unterbrechbaren Referenzpfad. Bereits parserseitig normalisierte und gehashte
Zeilen koennen in unveraenderlichen Chunks gestagt, nach einer Unterbrechung
exakt fortgesetzt und erst nach Vollstaendigkeit atomar geschrieben werden.

Der Vertrag ist weiterhin kein produktiver Bulk-Importer. Die abschliessende
Schreiboperation verwendet bewusst
`kb_homeopathic_write_small_bundle_v1(jsonb)` und erbt damit dessen Gesamtgrenze
von 4 MiB, 256 Rubriken, 64 Graddefinitionen, 256 Mitteln und 2.048
Assignments. Ein Chunk ist auf 1 MiB begrenzt; ein Batch bindet 1 bis 64
eindeutige Chunkhashes. Beim Staging sind kumulativ hoechstens 4.000.000
Payloadbytes erlaubt, damit fuer den finalen Umschlag sicher Platz unter der
4-MiB-Writergrenze bleibt. Auch jeder Komponentenzaehler wird schon beim Insert
gegen seine Batcherwartung begrenzt.

## Persistente Batchidentitaet

`kb_homeopathic_chunk_import_batches` bindet unveraenderlich:

- eine explizite Batch-UUID
- das exakte Repertoriums- und Revisionspaar
- die vollstaendige Step-5B-5-Repertoriumsbindung
- den erwarteten Step-5B-3-Bundlehash und vier positive Gesamtzaehler
- die geordnete Liste aller erwarteten Chunk-SHA-256-Werte
- den Zustand `open`, `written` oder `cancelled`

Nur ein offener oder geschriebener Batch darf dasselbe Repertoriums-
Revisionspaar binden. Ein nachweislich falscher Versuch kann owner-seitig
abgebrochen werden. Seine Chunks bleiben unveraenderlich als Audit erhalten;
danach darf eine neue Batch-ID dasselbe Ziel uebernehmen. Geschriebene und
abgebrochene Batches sind terminal und unveraenderlich.

## Chunk- und Resume-Vertrag

`kb_homeopathic_chunk_import_chunks` speichert je Batch und nullbasiertem Index
genau einen Payload. Der Payload besitzt exakt vier Arrays fuer Rubriken,
Graddefinitionen, Mittel und Assignments. Feldtypen, UUIDs, SHA-256-Werte,
Ordnungszahlen, Aliasse und die vollstaendigen Step-5B-5-Zeilenformen werden vor
dem Insert geschlossen geprueft.

Der gespeicherte Chunkhash wird in PostgreSQL erneut aus dem kanonischen JSONB
gebildet und muss sowohl zum Payload als auch zum vorab gebundenen Hash am
gleichen Index passen. Dadurch gilt:

- Chunks duerfen in beliebiger Reihenfolge eintreffen.
- Der Status nennt exakte fehlende Indizes und aktuelle Komponentenzaehler.
- Eine identische Wiederholung veraendert nichts und liefert denselben Status.
- Eine abweichende Wiederholung oder ein nicht gebundener Hash scheitert.
- Nach `written` oder `cancelled` koennen keine neuen Chunks entstehen.

## Atomare Finalisierung und Rollback

`kb_homeopathic_finalize_chunk_import_v1(uuid)` sperrt die Batchzeile, verlangt
alle Indizes und exakt die vier erwarteten Gesamtzaehler und setzt daraus einen
Step-5B-5-Umschlag zusammen. Erst dann wird der vorhandene atomare Writer
aufgerufen.

Ein falscher Gesamt- oder Zeilenhash laesst alle sechs finalen Step-5A-Tabellen
und den Repertoriumshash unveraendert. Die bereits committeden Stagingchunks
bleiben fuer Diagnose, erneuten Finalisierungsversuch oder kontrollierten
Abbruch erhalten. Nach Erfolg bindet der Batch einen deterministischen
Resultathash; eine exakte Finalisierungswiederholung liefert dasselbe Ergebnis.

## Rechte, Snapshot und Restore

Alle schreibenden Funktionen sind `SECURITY INVOKER`, pruefen den Tabellenowner
und besitzen keine Ausfuehrungsrechte fuer `PUBLIC`, `anon`, `authenticated`,
`service_role`, `kb_importer` oder `kb_import_runtime`. Beide Tabellen haben RLS
ohne Runtime-Policy und keinerlei direkte Rechte fuer diese Rollen.

Der Wiki-Snapshot umfasst nun exakt 67 statt 65 Tabellen. Beide Stagingtabellen
werden samt Hashmanifest gesichert. Der neue Zaehler
`invalid_homeopathic_chunk_imports` muss 0 sein. Restore-Vertraege loeschen
Chunks vor Batches und laden Batches vor Chunks. Der vierteilige
Therapie-Eingabe-Snapshot bleibt byteidentisch.

## Fokussierte Verifikation

Der PGlite-Lauf verwendet ausschliesslich synthetische, nichtmedizinische Daten
und belegt:

- Installation auf der exakten 65-Tabellen-Ausgangsgrenze und Erweiterung auf 67
- out-of-order Staging, exakten fehlenden Index und identische Wiederholung
- vollstaendig gestagten Hashfehler ohne eine einzige finale Writerzeile
- terminalen Abbruch mit erhaltenem Audit und neuem Batch fuer dasselbe Ziel
- atomare Finalisierung, identischen Replay-Resultathash und Preflightgleichheit
- unveraenderten Therapie-Eingabe-Snapshot
- entzogene Tabellen- und Funktionsrechte fuer alle Runtime- und Importrollen

Der fokussierte Writer-/Chunk-/Preflightlauf besteht mit 15/15 Tests. Zusammen
mit den beiden Sicherungsvertragstests bestehen 3/3 Dateien und 67/67 Tests.
Die zusammenhaengende Repertoriumsregression Step 5A bis 5B-6 besteht mit 5/5
Dateien und 37/37 Tests. Der vollstaendige Projektlauf besteht mit 49/49 Dateien
und 523/523 Tests. Beide TypeScript-Projekte und der gezielte ESLint-Lauf der
geaenderten TypeScript-Dateien sind fehlerfrei. Der Produktionsbuild ist
erfolgreich; er zeigt nur die bereits bekannten Browserslist-, Dependency-`eval`-
und Chunkgroessenwarnungen. `git diff --check` meldet keine Whitespacefehler,
nur bekannte LF-zu-CRLF-Arbeitskopiehinweise.

## Weiterhin offene Gates

Vor einem echten Repertoriumsimport bleiben zwingend offen:

1. konkrete lizenzierte oder gemeinfreie Quelle fachlich freigeben
2. quellenspezifischen Rohdatenparser und Gold-Fixtures abnehmen
3. Quelleninhalt, Metadaten und generische Mittelrevisionen reproduzierbar bilden
4. produktiven Bulk-Writer ohne 4-MiB-Kleinmengengrenze separat entwerfen
5. Grossmengen, Speicher, Locks, Parallelitaet und deferred Pruefungen auf echtem
   PostgreSQL profilieren
6. Backup, Restore, RLS, Abbruchbetrieb und Freigabeprozess separat abnehmen

Schritt 5B-6 ist damit ein persistenter synthetischer Resume- und Rollbackbeweis,
aber keine Import-, Release-, Wirksamkeits- oder Therapiefreigabe.
