# Wiki Schritt 5B-4: Parserseitiger Repertoriums-Zeilenhashvertrag

Stand: 2026-08-03

Status: implementiert und vollstaendig lokal verifiziert. Kein Rohdatenparser,
kein Repertoriumsimport, kein Supabase-Deployment und keine medizinische Nutzung.

## Ziel und harte Grenze

Die Referenz

`src/lib/homeopathicImportRowHashes.ts`

bildet aus bereits normalisierten, streng geprueften Step-5A-Payloads exakt die
fuenf gespeicherten SHA-256-Werte fuer:

- Repertoriumsrevision
- Rubrikrevision
- source-native Graddefinition
- Repertoriumsmittelzuordnung
- Rubrik-Mittel-Grad-Assignment

Sie verwendet dieselbe PostgreSQL-`jsonb`-Kanonisierung wie der parserseitige
Bundlevertrag aus Schritt 5B-3. Die gemeinsame Hashfunktion ist deshalb
exportiert und wird von beiden Vertragsstufen verwendet.

Der Block liest weiterhin keine Quelldatei und schreibt keine Daten. Der
Quelleninhaltshash, die beiden Metadatenhashes und der generische
Mittelrevisionshash bleiben explizite Eingaben. Ihre Bildung aus einer konkreten
lizenzierten Rohquelle ist nicht Bestandteil dieses Schritts.

## Exakte Payload-Schemata

Alle Payloads sind gegen geschlossene Zod-Schemata geprueft. Dazu gehoeren:

- kanonische kleingeschriebene UUIDs und SHA-256-Werte
- kontrollierte Quellenarten und nur `own_content`, `licensed` oder
  `public_domain`
- ausschliesslich menschlicher oder historischer Ursprung fuer Repertoriums- und
  Mittelrevisionen
- positive Revisionsnummern sowie Step-5A-Grenzen fuer Grade und
  Geschwisterpositionen
- nach UTF-8-Bytes begrenzte Quellencodes, Texte, kanonisch geordnete eindeutige
  Aliasse und Fundstellen
- genau die vorhandenen Payloadfelder ohne stilles Ignorieren von Zusatzfeldern
- vollstaendige Null- oder Nichtnullbindung aller drei Elternrubrikfelder

Ungueltiges UTF-16 wird in der gemeinsamen Kanonisierung fuer jedes Textfeld
geschlossen abgelehnt.

## Verschachtelte Bindungen

Vor der Hashbildung werden nicht nur Formen, sondern auch Abhaengigkeiten
geprueft:

- Quellen-ID und Quellenrevisions-ID muessen zwischen Quellenpayload und
  Quellenbindung uebereinstimmen.
- Jede Rubrik, jeder Grad und jedes Repertoriumsmittel muss auf dasselbe
  Repertoriums-/Revisionspaar wie sein verschachteltes Payload zeigen.
- Der verschachtelte Repertoriumshash wird neu berechnet und muss exakt zum
  angegebenen Hash passen.
- Ein Assignment berechnet Rubrik-, Mittel- und Gradhash erneut und lehnt jede
  abweichende verschachtelte Bindung ab.

Damit kann ein Parser keinen fremden oder veralteten Unterpayload unbemerkt in
einen scheinbar gueltigen Zeilenhash aufnehmen.

## Kreuzlauf gegen PostgreSQL

Der erweiterte Step-5B-2-PGlite-Test liest die tatsaechlichen SQL-Payloads und
vergleicht Parser-, Datenbank- und gespeicherten Hash fuer sieben synthetische
Zeileninstanzen:

- eine Repertoriumsrevision
- eine Wurzel- und eine Kindrubrik
- eine Graddefinition
- zwei Mittelzuordnungen, davon eine ohne Assignment
- ein Assignment

Der Lauf deckt Nullfelder, Textarrays, verschachtelte Objekte, UTF-8-Text,
Anfuehrungszeichen und echte Zeilenumbrueche ab. Alle sieben Dreifachvergleiche
sind identisch.

Der reine Step-5B-4-Test baut die fuenf Payloadstufen ohne Datenbank auf, prueft
die Weitergabe einer Rubrikaenderung bis in den Assignmenthash und lehnt
abweichende Quellen-, Repertoriums-, Eltern-, Ursprungs- und Unterhashbindungen
ab.

Fokussierter Zwischenstand: 2/2 Dateien und 10/10 Tests bestanden.

## Abschlussreview und Verifikation

Abschlussstand nach Payload-, Bindungs- und Portabilitaetsreview:

- fokussierter Step-5B-2-/5B-4-Kreuzlauf: 2/2 Dateien, 10/10 Tests
- zusammenhaengende Repertoriumsregression Step 5A bis 5B-4: 5/5 Dateien,
  29/29 Tests
- vollstaendiger Projektlauf: 49/49 Dateien, 514/514 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf der beiden Hashreferenzen und beteiligten Tests ohne
  Fehler
- Produktionsbuild auf Node 20.20.2 und npm 10.9.9 erfolgreich; nur die
  bestehenden Browserslist-, Dependency-`eval`- und Chunkgroessenwarnungen
- `git diff --check` ohne Whitespacefehler; nur bekannte
  LF-zu-CRLF-Arbeitskopiehinweise
- projektweite ESLint-Baseline bleibt bei 397 Fehlern und 40 Warnungen in
  unberuehrten Altdateien; die neuen Dateien sind sauber
- finales Review ohne verbleibenden P0/P1-Befund

## Weiterhin offene Gates

Vor einem echten Repertoriumsimport bleiben zwingend offen:

1. konkrete lizenzierte oder gemeinfreie Quelle fachlich freigeben
2. Quellendateiformat und Bildung des Quelleninhaltshashes festlegen
3. erlaubte Metadaten und generische Mittelrevisionen gegen Gold-Fixtures binden
4. quellenspezifischen Parser implementieren und fachlich stichprobenpruefen
5. owner-only Chunk-/Bulk-Writer mit Idempotenz und atomarem Rollback entwerfen
6. Grossmengen, Locks und deferred Pruefungen auf echtem PostgreSQL profilieren
7. Backup, Restore, RLS und Freigabeprozess separat abnehmen

Bis dahin ist Schritt 5B-4 ausschliesslich ein technischer Referenzvertrag fuer
normalisierte synthetische Payloads und keine Import- oder Therapiefreigabe.
