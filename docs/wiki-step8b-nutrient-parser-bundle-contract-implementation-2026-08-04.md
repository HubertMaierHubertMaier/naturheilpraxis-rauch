# Wiki Schritt 8B: Parserseitiger quellneutraler Naehrstoff-Bundlevertrag

Stand: 2026-08-04

Status: implementiert und lokal verifiziert. Kein Rohdatenparser, kein Writer,
kein Deployment, keine echten Quelldaten und keine medizinische Nutzung.

## Ziel und harte Grenze

Die browser- und Node-kompatible Referenz

`src/lib/nutrientImportBundle.ts`

validiert ein bereits normalisiertes Schritt-8A-Manifest, leitet daraus die drei
Vorpruefzaehler ab und bildet denselben kanonischen SHA-256 wie PostgreSQL. Sie
liest keine Datei, verarbeitet keine URL und schreibt keine Daten.

Der Block erzeugt insbesondere keine Komponenten-, Aussage- oder
Quellenbindungshashes aus Rohdaten. Diese drei bereits vorhandenen Hashbindungen
sind geschlossene Eingaben. Ihre Bildung aus einer konkreten Quelle bleibt bis
zu einer gesonderten Rechte-, Format- und Fachfreigabe ausgeschlossen.

## Geschlossener Manifestvertrag

Akzeptiert werden ausschliesslich:

- Vertragsversion `1`, Scope `NUTRIENT_IMPORT_PREFLIGHT_ONLY` und Datenklasse
  `general_knowledge`
- kanonische kleingeschriebene UUIDs und SHA-256-Werte
- die acht bereits vorhandenen Naehrstoff-Zubereitungsarten
- die vorhandenen Formulierungsarten und Abgabesysteme
- 1 bis 4096 Komponenten
- 1 bis 8192 Aussagen und 1 bis 16384 primaere Quellenbindungen
- mindestens so viele Quellenbindungen wie Aussagen
- exakt die quellneutrale Schritt-8A-Quellenpolicy
- exakt alle 13 weiterhin falschen Betriebs- und Freigabeschalter

`nutrient_single` muss an `single` und `nutrient_combination` an `combination`
gebunden sein. Zusatzfelder, grossgeschriebene Hashes, inkonsistente Zaehler,
abweichende Policywerte oder ein wahrer Freigabeschalter werden geschlossen
abgelehnt.

## Bytegleiche Hashbildung

Die Referenz verwendet die bereits gepruefte gemeinsame
PostgreSQL-`jsonb`-Kanonisierung aus dem Repertoriumsvertrag. Dadurch sind
Objektreihenfolge und lokale Spracheinstellung ohne Bedeutung. Der fokussierte
PGlite-Kreuzlauf vergleicht:

- das vollstaendige parserseitige Manifest mit
  `kb_nutrient_import_manifest_v1()`
- den parserseitigen Bundle-Hash mit
  `kb_nutrient_import_manifest_hash_v1()`
- die abgeleiteten Zaehler mit den Schritt-8A-Erwartungen fuer Komponenten,
  Aussagen und Quellenbindungen

Alle drei Vergleiche sind fuer die ausschliesslich synthetische Fixture exakt
identisch.

## Unveraenderte Ausschluesse

Nicht Bestandteil von Schritt 8B sind:

- Anbieter-, Produkt-, Autor-, URL- oder Katalogbindung
- Quelldatei, Download, Crawler, Upload oder Rohdatenparser
- echte Texte, Mengen, chemische Formen, Einnahmehinweise oder Behauptungen
- Tabellen, Migrationen, Inserts, Updates, Deletes oder Rollenrechte
- Aufbewahrung, Loeschung, Replay oder Schattenausfuehrung
- KI-Nutzung, Planwahl, Dosierungsauswertung oder Dosierungsanzeige
- medizinische, produktive oder sonstige Aktivierung

Die oeffentliche Schritt-8A-Inventur fand keine offene Inhaltslizenz und keine
dokumentierte Import-API. Schritt 8B aendert diese Rechtsgrenze nicht.

## Testabdeckung

Der reine Schritt-8B-Test prueft:

- Unveraenderlichkeit des Eingabemanifests
- exakte Ableitung der drei Vorpruefzaehler
- Bindung von Zubereitung, Komponentenhash, Provenienzhash und Policy
- Ablehnung von Zusatzfeldern, fehlerhaften Hashes und inkonsistenten Zaehlern
- Ablehnung jedes wahren Freigabeschalters
- statischen Ausschluss von Anbietername, Reader, Writer und Patientenschluesseln

Der erweiterte Schritt-8A-Test fuehrt den bytegleichen Datenbank-Kreuzlauf aus.

## Lokale Verifikation

Folgende Pruefungen sind erfolgreich:

- reiner Schritt-8B-Test mit 4/4 Tests
- erweiterter Schritt-8A-PGlite-Test mit 8/8 Tests
- zusammenhaengender Schritt-8A-/8B-Lauf mit 2/2 Dateien und 12/12 Tests
- TypeScript-Pruefung fuer `tsconfig.app.json` und `tsconfig.node.json`
- gezieltes ESLint fuer Referenz und beide Tests
- Repository-Secret-Policy mit 2/2 Tests
- Produktionsbuild mit 3788 transformierten Modulen
- `git diff --check` ohne Whitespacefehler

Der Build meldete nur die bekannten Hinweise zu veralteten Browserslist-Daten,
Bluebird-`eval` und grossen Chunks.

Der vollstaendige Projektlauf bestand 52/53 Dateien und 541 Tests. Die einzige
nicht gruene Datei war der unveraenderte bekannte Langlaeufer
`therapy-retrieval-v2-preflight.test.ts`: Sein `beforeAll` ueberschritt nach 120
Sekunden das Hook-Zeitlimit, sodass dessen 56 Tests uebersprungen wurden. Der
Schritt-8A-/8B-Kreuzlauf bestand auch innerhalb dieses Gesamtlaufs vollstaendig.

## Weiterhin offene Gates

Vor jedem echten Naehrstoffimport bleiben mindestens offen:

1. konkrete Quelle und erlaubten Nutzungsumfang schriftlich freigeben
2. zulassige Rohdatenfelder und ein versioniertes Dateiformat festlegen
3. Komponenten- und Provenienz-Hashbildung gegen rechtlich freigegebene
   Gold-Fixtures spezifizieren
4. quellenspezifischen Parser getrennt implementieren und fachlich pruefen
5. owner-only Writer, Idempotenz, Rollback und Wiederaufnahme separat abnehmen
6. PostgreSQL-Grossmengen, Locks, Backup, Restore und RLS pruefen
7. medizinische, produktive und Runtime-Freigaben in neuen Vertraegen behandeln

Bis dahin ist Schritt 8B ausschliesslich ein technischer Hashvertrag fuer ein
synthetisches, bereits normalisiertes Manifest.
