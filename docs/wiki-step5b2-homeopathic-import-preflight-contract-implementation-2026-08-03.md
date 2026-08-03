# Wiki Schritt 5B-2: Repertoriums-Importvorpruefvertrag

Stand: 2026-08-03

Status: implementiert und vollstaendig lokal verifiziert. Kein
Supabase-Deployment, kein Repertoriumsimport und keine medizinische Nutzung.

## Ziel und harte Grenze

Die additive Migration

`supabase/migrations/20260803110000_create_kb_homeopathic_import_preflight_contract.sql`

ergaenzt den Step-5A-Datenvertrag und den Step-5B-1-Reader um eine
deterministische, medizinisch inaktive Nachladepruefung fuer genau eine bereits
owner-seitig geladene Repertoriumsrevision. Der Vertrag vergleicht einen vor dem
Laden festgelegten erwarteten Bundle-Hash und vier erwartete Zeilenzahlen mit dem
tatsaechlich gespeicherten, vollstaendig validierten Stand.

Der Block ist absichtlich noch kein Importer. Er erstellt keine Tabelle, schreibt
keine Repertoriumsdaten, vergibt keine Import- oder Runtime-Rechte und aktiviert
kein Knowledge-Release. Er ist die fail-closed Pruefgrenze, die ein spaeterer,
separat abgenommener Bulk-Writer innerhalb derselben Transaktion aufrufen muss.

Nicht Bestandteil von Schritt 5B-2 sind:

- echte Repertorien, Rubriken, Grade, Mittel oder Zuordnungen
- Parser, Datei-Upload, Chunk-Writer, Upsert- oder Loeschpfad
- automatische UUID-Erzeugung oder stilles Zusammenfuehren von Quellencodes
- Freigabe, Release-Aktivierung oder Runtime-Reader-Recht
- Materia-medica-Abgleich, Wirksamkeitsbewertung oder Behandlungsempfehlung
- Patienten-, Nutzer-, Sitzungs-, Anamnese- oder Therapieverknuepfungen
- Dosierung, Potenz, Darreichung, Produktvariante oder Mittelverordnung

## Vier Funktionen

### Kanonisches Bundle-Manifest

`kb_homeopathic_repertory_bundle_manifest_v1()` akzeptiert genau ein
Repertoriums-/Revisionspaar. Es liefert nur dann ein Manifest, wenn der
vollstaendige Step-5A-Validator fuer dieses Paar wahr ist. Andernfalls bleibt das
Ergebnis `NULL`.

Das kleine Manifest bindet:

- Repertoriums- und Revisions-ID samt Repertoriumsinhaltshash
- Quellen- und Quellenrevisions-ID samt Quelleninhaltshash
- Quellenrecht, Quellencode, Sprache und Fundstelle
- exakte Zeilenzahlen fuer Rubriken, Graddefinitionen, Mittel und Assignments
- je einen deterministischen SHA-256-Komponentenhash fuer diese vier Bereiche
- Vertragsversion, Datenklasse und den Scope
  `HOMEOPATHIC_IMPORT_PREFLIGHT_ONLY`

Die Komponentenhashes werden aus stabil geordneten UUIDs, Abhaengigkeits-UUIDs
und den bereits vorhandenen, semantisch validierten Zeilenhashes gebildet. Damit
muss das Manifest nicht alle Texte oder den gesamten Zuordnungsbestand erneut in
ein riesiges JSON kopieren. Die Einzelhashes binden weiterhin Texte,
Quellencodes, Hierarchie, source-native Grade, Aliasse und Fundstellen.

### Bundle-Hash

`kb_homeopathic_repertory_bundle_hash_v1()` bildet den kanonischen SHA-256 des
vollstaendigen Bundle-Manifests. Reviewstatus, Reviewer und Zeitstempel sind
bewusst nicht Teil des fachlichen Hashes. Ein gueltiger Entwurf und derselbe
spaeter freigegebene Inhalt besitzen deshalb denselben Bundle-Hash.

### Erwartungsvalidierung

`kb_homeopathic_import_expectations_are_valid_v1()` akzeptiert nur:

- einen kleingeschriebenen SHA-256 mit exakt 64 Hex-Zeichen
- genau die vier Zaehler `rubrics`, `grade_definitions`, `remedies` und
  `assignments`
- positive, ganzzahlige Werte ohne Zusatzfelder oder numerische Sonderformen
- ein auf 1 KiB begrenztes Erwartungsobjekt

Fehlende, nullwertige, uebergrosse, gebrochene oder erweiterte Erwartungen
werden vor jeder teureren Bestandspruefung geschlossen abgelehnt.

### Importvorpruefung

`kb_homeopathic_repertory_import_preflight_v1()` liefert einen kanonischen
Ergebnisvertrag mit einem eigenen reproduzierbaren Ergebnishash. Moegliche
Zustaende sind:

- `HOMEOPATHIC_IMPORT_EXPECTATION_INVALID`
- `HOMEOPATHIC_IMPORT_BUNDLE_UNAVAILABLE`
- `HOMEOPATHIC_IMPORT_BUNDLE_MISMATCH`
- `HOMEOPATHIC_IMPORT_BUNDLE_READY`

`READY` setzt gleichzeitig einen exakten Hash- und Zaehlervergleich voraus. Ein
falscher Hash und falsche Zaehler bleiben als getrennte boolesche Dimensionen
sichtbar. `READY` bedeutet ausschliesslich, dass der gespeicherte Bundle-Stand
der vorher festgelegten Importerwartung entspricht. Die feste Interpretation
`IMPORT_PREFLIGHT_ONLY_NOT_RELEASE_OR_MEDICAL_USE` verhindert eine Umdeutung in
Freigabe, Wirksamkeit oder therapeutische Eignung.

## Manipulations- und Rollenabwehr

Vor der Digestbildung laeuft der vollstaendige semantische Step-5A-Validator.
Eine nach Triggerumgehung veraenderte Assignment-Zeile fuehrt deshalb nicht zu
einem neuen scheinbar gueltigen Hash, sondern zu `BUNDLE_UNAVAILABLE`.

Alle vier Funktionen sind `SECURITY INVOKER`. `EXECUTE` ist fuer `PUBLIC`,
`anon`, `authenticated`, `service_role`, `kb_importer` und
`kb_import_runtime` widerrufen. Es gibt keinen Writer und keinen Runtime-Grant.

## Datenhaltung und Kompatibilitaet

Die Migration erzeugt keine Tabelle und veraendert keine vorhandene Tabelle.
Der gemeinsame Wiki-Snapshot bleibt byteidentisch bei exakt 65 Tabellen. Der
Therapie-Input-Snapshot v2 bleibt byteidentisch bei vier Tabellen. Release v1
bleibt hart `retrieval_eligible = false` und `is_active = false`.

## Testabdeckung

Der fokussierte Test

`src/test/wiki-step5b2-homeopathic-import-preflight-contract.test.ts`

verwendet ausschliesslich ein kleines synthetisches, nichtmedizinisches Bundle
und prueft insbesondere:

- reine Funktionsmigration ohne Tabellen, Seeds, Patientendaten oder Grants
- byteidentischen 65-Tabellen-Wiki-Snapshot und Therapie-Input-Snapshot v2
- kompakte Komponentenhashes und exakte Zaehler
- Erfassung auch eines gueltigen, noch keiner Rubrik zugeordneten Mittels
- identisches Manifest vor und nach dem Reviewstatuswechsel
- `READY` nur bei gleichzeitig exaktem Hash und exakten Zaehlern
- getrennte Hash- und Zaehlerabweichungen
- ungueltige, nullwertige und um Zusatzfelder erweiterte Erwartungen
- unbekannte Repertoriumsrevisionen
- fail-closed Verhalten nach triggerumgehender Hashmanipulation
- fehlende Ausfuehrungsrechte aller Anwendungs- und Importrollen

Fokussierter Zwischenstand: 6/6 Tests bestanden.

## Begleitende Testhaertung

Die bestehende Step-5A-Sicherheitspruefung akzeptiert den neuen, separat
geprueften reinen Vorpruefvertrag nun als dritten bekannten
Repertoriumsvertrag. Direkte Tabellenzugriffe ausserhalb dieser drei Migrationen
bleiben weiterhin verboten.

Die statische Phase-1-RLS-Pruefung akzeptiert sowohl LF- als auch CRLF-
Zeilenenden. Die gepruefte SQL-Zeichenfolge selbst und ihre Einrueckung bleiben
unveraendert; dadurch ist der Gesamtlauf auch in einem frischen Windows-Worktree
reproduzierbar.

## Abschlussreview und Verifikation

Abschlussstand nach Sicherheitsreview und Testhaertung:

- fokussierter Step-5B-2-Test: 6/6 Tests
- zusammenhaengende Step-5A-/5B-1-/5B-2-Regression: 22/22 Tests
- vollstaendiger Projektlauf: 47/47 Dateien, 507/507 Tests
- beide TypeScript-Projekte ohne Fehler
- gezielter ESLint-Lauf der drei beteiligten Tests ohne Fehler
- Produktionsbuild auf Node 20.20.2 und npm 10.9.9 erfolgreich; nur die
  bestehenden Browserslist-, Dependency-`eval`- und Chunkgroessenwarnungen
- `git diff --check` ohne Whitespacefehler; nur bekannte
  LF-zu-CRLF-Arbeitskopiehinweise
- projektweiter ESLint-Baseline-Lauf weiterhin rot mit 397 Fehlern und 40
  Warnungen in unberuehrten Altdateien; keine Meldung betrifft Schritt 5B-2
- finales Review ohne verbleibenden P0/P1-Befund

## Offene Gates vor einem echten Bulk-Import

Vor echten Daten bleiben zwingend offen:

1. konkrete lizenzierte oder gemeinfreie Quelle fachlich freigeben
2. Parserformat und parserseitige kanonische Hashbildung separat abnehmen
3. owner-only Chunk-/Bulk-Writer mit idempotenter Batchidentitaet entwerfen
4. Fehler-, Resume- und vollstaendigen Rollbackpfad definieren
5. grosse Rubrik-, Alias- und Assignmentmengen auf echtem PostgreSQL profilieren
6. Locks, Deadlocks und deferred Abschlusspruefungen im Batch testen
7. Browser-/Edge-Backup und isolierten Owner-Restore mit realistischen Mengen
   abnehmen
8. Repertoriumsrelease und Runtime-Reader erst nach Fach-, RLS-, Restore- und
   Performanceabnahme in einem neuen Vertrag freigeben

Bis dahin ist `HOMEOPATHIC_IMPORT_BUNDLE_READY` nur ein owner-seitiger
Integritaetsnachweis und keine Import-, Release- oder Therapiefreigabe.
