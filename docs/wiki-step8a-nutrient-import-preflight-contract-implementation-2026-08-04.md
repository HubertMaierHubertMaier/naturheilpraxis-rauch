# Wiki Schritt 8A: Synthetischer quellneutraler Naehrstoff-Importvorpruefvertrag

Stand: 2026-08-04

Status: implementiert und lokal verifiziert. Es gibt kein Deployment, keine
echten Quelldaten, keinen Importwriter und keine Verbindung zum sichtbaren
Therapiepfad.

## Ziel und harte Grenze

Schritt 8A grenzt nach der oeffentlichen Quelleninventur ausschliesslich einen
generischen technischen Vorpruefvertrag ab. Er prueft eine bereits gespeicherte,
synthetische Naehrstoffzubereitungsrevision gegen einen erwarteten Manifesthash
und drei erwartete Zaehler. Der Vertrag ist an keinen Anbieter, Autor, Titel,
Katalog oder eine bestimmte Website gebunden.

Das bestehende additive Schema bleibt unveraendert. Insbesondere werden die
bereits vorhandenen Tabellen fuer Zubereitungsdetails, Naehrstoffdetails,
Komponenten, Aussagen und Quellenbindungen verwendet. Die Migration erzeugt nur
vier `SECURITY INVOKER`-Funktionen und entzieht ihre Ausfuehrung allen
Anwendungs-, Service- und Importrollen.

## Deterministisches Manifest

`kb_nutrient_import_manifest_v1` akzeptiert genau eine Zubereitungs- und
Revisions-ID. Ein Manifest entsteht nur, wenn:

- die Revision nach dem bestehenden therapeutischen Katalogvertrag gueltig ist,
- ihr Zubereitungstyp zum bereits vorhandenen Naehrstoffbereich gehoert,
- passende Naehrstoffdetails vorhanden sind,
- zwischen 1 und 4096 revisionsgebundene Komponenten vorhanden sind,
- jede verwendete Basisaussage mindestens eine primaere, lokalisierte und
  unterstuetzende oder qualifizierende Quellenbindung besitzt.

Das Manifest nennt nur Typen, Zaehler und SHA-256-Bindungen. Einzelne
Komponentenmengen, chemische Formen, Quellentitel, Zitate und Locator werden
nicht ausgegeben. Sie fliessen ausschliesslich in deterministische
Komponenten- beziehungsweise Provenienz-Hashes ein. Dadurch erkennt die
Vorpruefung Drift, ohne einen neuen Inhaltsleser oder eine Dosierungsanzeige zu
schaffen.

## Fail-closed Vorpruefung

`kb_nutrient_import_preflight_v1` akzeptiert nur:

- einen kleingeschriebenen SHA-256-Erwartungshash,
- genau die Zaehler `components`, `assertions` und `source_bindings`,
- positive Ganzzahlen innerhalb der festgelegten Obergrenzen.

Gueltige Erwartungen liefern genau einen der folgenden Zustaende:

- `NUTRIENT_IMPORT_PREFLIGHT_READY_INACTIVE`
- `NUTRIENT_IMPORT_BUNDLE_MISMATCH`
- `NUTRIENT_IMPORT_BUNDLE_UNAVAILABLE`

Fehlerhafte Erwartungen liefern
`NUTRIENT_IMPORT_EXPECTATION_INVALID`. Jede Antwort ist selbst wieder
deterministisch gehasht. `READY_INACTIVE` bestaetigt nur Hash- und
Zaehlergleichheit; es ist keine Import-, Quellen-, Betriebs- oder medizinische
Freigabe.

## Unveraenderte Ausschluesse

Manifest und Ergebnis halten alle folgenden Schalter explizit auf `false`:

- Deployment und Importausfuehrung
- Aufbewahrung und Loeschung
- Replay und Schattenausfuehrung
- KI-Nutzung und Planwahl
- Dosierungsauswertung und Dosierungsanzeige
- medizinische und produktive Nutzung
- Aktivierung

Der Quellenvertrag verlangt weiterhin eine gesonderte Rechtepruefung. Er laedt
keine echten Quellinhalte und erteilt keine Quellenfreigabe.

Die vorgelagerte oeffentliche Quelleninventur und die Pruefung dieses Vertrags
gegen deren Rechts- und Inhaltsgrenzen sind separat dokumentiert in
`wiki-step8a-strunz-public-source-inventory-2026-08-04.md`. Sie stellt keine
offene Inhaltslizenz fest und gibt daher weiterhin keine echten Quellen frei.

## Synthetischer Nachweis

Der fokussierte PGlite-Vertragstest verwendet ausschliesslich erfundene IDs,
Bezeichnungen, Aussagen, Komponenten und eine synthetische Quellenrevision. Er
prueft:

- die unveraenderten Wiki- und Therapieeingabe-Snapshots,
- deterministische Komponenten-, Provenienz-, Manifest- und Ergebnishashes,
- den inaktiven positiven Pfad mit ausschliesslich falschen Freigabeschaltern,
- die Ablehnung fehlerhafter oder uebergrosser Erwartungen,
- fail-closed Verhalten bei fehlender primaerer Provenienz,
- Hashabweichungen nach synthetischer Komponenten- oder Quellenrevisiondrift,
- den vollstaendigen Ausschluss von Anwendungs-, Service- und Importrollen.

## Lokale Verifikation

Folgende Pruefungen sind erfolgreich:

- fokussierter PGlite-Vertragstest mit 7/7 Tests
- gezieltes ESLint fuer den neuen Vertragstest
- TypeScript-Pruefung fuer `tsconfig.app.json` und `tsconfig.node.json`
- Repository-Secret-Policy innerhalb der Gesamtsuite mit 2/2 Tests
- Produktionsbuild mit 3788 transformierten Modulen
- `git diff --check` ohne Whitespacefehler

Die Gesamtsuite bestand 51/52 Dateien und 536 Tests. Die einzige nicht gruene
Datei war der bereits dokumentierte lange
`therapy-retrieval-v2-preflight.test.ts`-Lauf: im parallelen Gesamtlauf lief sein
`beforeAll` nach 120 Sekunden ab. Zwei isolierte Wiederholungen bestanden danach
jeweils alle 56/56 fachlichen Tests; Vitest meldete nach dem 187- beziehungsweise
213-sekuendigen Lauf weiterhin den bekannten Workerfehler
`Timeout calling "onTaskUpdate"`. Dieser Altbefund betrifft weder die neue
Migration noch ihren fokussierten Test, bleibt aber als nicht gruener
Vollrepository-Teststatus offen.

Der Build meldete nur die bereits bekannten Hinweise zu veralteten
Browserslist-Daten, Bluebird-`eval` und grossen Chunks. Es wurde keine
PostgreSQL-, Supabase- oder sonstige externe Umgebung angesprochen.
