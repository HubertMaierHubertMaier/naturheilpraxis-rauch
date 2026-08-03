# Wiki Schritt 5B-3: Parserseitiger Repertoriums-Bundlevertrag

Stand: 2026-08-03

Status: implementiert und vollstaendig lokal verifiziert. Kein Parserlauf, kein
Repertoriumsimport, kein Supabase-Deployment und keine medizinische Nutzung.

## Ziel und harte Grenze

Die browser- und Node-kompatible Referenz

`src/lib/homeopathicImportBundle.ts`

bildet aus bereits normalisierten Repertoriumsmetadaten, UUIDs und semantisch
gebildeten Zeilenhashes exakt dasselbe kompakte Manifest und denselben
Bundle-SHA-256 wie der PostgreSQL-Vertrag aus Schritt 5B-2.

Der Block liest keine Quelldatei, interpretiert keine Rubrik und schreibt keine
Daten. Er erzeugt insbesondere keine Zeilenhashes aus medizinischen Rohdaten.
Diese bleiben Teil eines spaeteren, separat abgenommenen Parser-/Writervertrags.

## Strikter Eingabevertrag

Der Eingabeumschlag akzeptiert ausschliesslich:

- Vertragsversion `1`, Scope `HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY` und
  Datenklasse `general_knowledge`
- kanonische kleingeschriebene UUIDs
- kleingeschriebene SHA-256-Werte mit exakt 64 Hex-Zeichen
- ein genaues Repertoriums-/Revisions- und Quellen-/Quellenrevisionspaar
- die Quellenrechte `own_content`, `licensed` oder `public_domain`
- gueltige Sprachcodes und nach UTF-8-Bytes begrenzte Quellencodes/Fundstellen
- mindestens eine Rubrikrevision, Graddefinition, Mittelzuordnung und ein
  Assignment

Zusatzfelder, leere Komponenten, Grossschreibung in Hashes, ungueltige UUIDs,
NUL-Zeichen und alleinstehende UTF-16-Surrogate werden geschlossen abgelehnt.

## Identitaet und Verweise

Vor jeder Hashbildung prueft die Referenz:

- eindeutige Rubrik- und Rubrikrevisions-IDs
- eindeutige Graddefinitions-IDs
- eindeutige Repertoriumsmittel-, generische Mittel- und Mittelrevisions-IDs
- eindeutige Assignment-IDs und Rubrik-/Mittelpaarungen
- vorhandene Rubrikrevision, Graddefinition und Mittelzuordnung fuer jedes
  Assignment

Die Reihenfolge der Eingabearrays ist ohne Bedeutung und wird nicht veraendert.

## Bytegleiche Hashbildung

Die vier Komponentenhashes verwenden dieselben, mit `:` verbundenen
UUID-/Hashfelder und dieselbe `C`-Sortierung wie PostgreSQL. Die Zeilen werden
ohne abschliessenden Zeilenumbruch mit `\n` verbunden und als UTF-8 mit SHA-256
gehasht.

Der abschliessende Manifesthash bildet die PostgreSQL-`jsonb`-Textdarstellung
gezielt nach:

- Objektschluessel zuerst nach UTF-8-Bytelaenge, dann byteweise sortiert
- `: ` zwischen Schluessel und Wert sowie `, ` zwischen Eintraegen
- JSON-konforme Zeichenketten-Escapes
- ausschliesslich sichere ganzzahlige Zahlen

Damit haengt die Referenz weder von JavaScript-Objektreihenfolge noch von einer
lokalen Spracheinstellung ab.

## Kreuzlauf gegen PostgreSQL

Der bestehende Step-5B-2-PGlite-Test liest die tatsaechlich gespeicherten
synthetischen UUIDs und Zeilenhashes, erzeugt daraus parserseitig den Vertrag und
vergleicht danach:

- das vollstaendige Manifest byteinhaltlich mit dem SQL-Manifest
- den parserseitigen Bundle-Hash mit `kb_homeopathic_repertory_bundle_hash_v1()`
- Fundstellen mit Anfuehrungszeichen und echtem Zeilenumbruch
- zwei Mittelzuordnungen, von denen eine noch kein Assignment besitzt

Der reine Step-5B-3-Test prueft zusaetzlich Permutationsstabilitaet,
Unveraenderlichkeit der Eingabe, vollstaendige Feldbindung, Zusatzfelder,
Grossschreibung, Dubletten, unbekannte Verweise und ungueltiges UTF-16.

Fokussierter Zwischenstand: 2/2 Dateien und 9/9 Tests bestanden.

## Abschlussreview und Verifikation

Abschlussstand nach Portabilitaets- und Sicherheitsreview:

- parserseitiger Kreuzlauf Step 5B-2/5B-3: 2/2 Dateien, 9/9 Tests
- zusammenhaengende Repertoriumsregression Step 5A bis 5B-3: 4/4 Dateien,
  25/25 Tests
- vollstaendiger Projektlauf: 48/48 Dateien, 510/510 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf der Referenz und ihrer beiden Tests ohne Fehler
- Produktionsbuild auf Node 20.20.2 und npm 10.9.9 erfolgreich; nur die
  bestehenden Browserslist-, Dependency-`eval`- und Chunkgroessenwarnungen
- `git diff --check` ohne Whitespacefehler; nur bekannte
  LF-zu-CRLF-Arbeitskopiehinweise
- projektweite ESLint-Baseline bleibt bei 397 Fehlern und 40 Warnungen in
  unberuehrten Altdateien; die neuen Dateien sind sauber
- finales Review ohne verbleibenden P0/P1-Befund

## Weiterhin offene Gates

Vor jedem echten Repertoriumsimport bleiben zwingend offen:

1. konkrete lizenzierte oder gemeinfreie Quelle fachlich freigeben
2. Rohdatenformat und Bildung aller semantischen Zeilenhashes spezifizieren
3. Parser gegen feste, rechtlich freigegebene Gold-Fixtures testen
4. owner-only Chunk-/Bulk-Writer mit idempotenter Batchidentitaet entwerfen
5. Fehler-, Resume- und vollstaendigen Rollbackpfad definieren
6. Grossmengen, Locks und deferred Pruefungen auf echtem PostgreSQL profilieren
7. Backup, Restore, RLS und fachliche Stichprobe separat abnehmen

Bis dahin ist die neue Referenz nur ein deterministischer technischer
Hashvertrag. Sie bestaetigt weder Vollstaendigkeit einer Rohquelle noch
medizinische Richtigkeit, Freigabe, Wirksamkeit oder therapeutische Eignung.
