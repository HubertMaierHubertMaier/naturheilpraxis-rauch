# Wiki Phase 3.2: Therapeutischer Katalog - lokale Implementierung

Datum: 29.07.2026
Status: lokal implementiert und verifiziert; nicht committed, nicht gepusht,
nicht nach Supabase ausgerollt

## Umgesetzter Umfang

- neuer kontrollierter Entitaetstyp `preparation`
- sieben neue kontrollierte Relationstypen und Preparation-Domaenen
- sechs additive Katalogtabellen:
  - `kb_preparation_revision_details`
  - `kb_homeopathic_revision_details`
  - `kb_botanical_revision_details`
  - `kb_nutrient_revision_details`
  - `kb_product_variant_revision_details`
  - `kb_composition_components`
- exakte Verbund-FKs auf Entitaet und konkrete Revision
- Quellenbindung jeder Detail- und Komponentenreihe ueber `basis_assertion_id`
- kontrollierte Arten, Darreichungsformen, Potenzen, Extrakte, Mengen,
  Einheiten, Gueltigkeiten und Komponentenrollen
- kanonische sortierte, duplikat- und nullfreie Mengenarrays
- SHA-256 ueber kanonischen therapeutischen Revisionspayload
- referenzierte Produkt-, Zubereitungs- und Komponenten-Hashes im Payload
- verzögerte Transaktionsvalidierung fuer atomare Erstellung und Aenderung
- unveraenderliche Abhaengigkeiten freigegebener und historischer Revisionen
- gepruefte Assertions, primaere Quellen und nichtleere Fundstellen fuer
  freigegebene Revisionen
- replay-faehige historische Assertion-/Quellenstaende
- verzögerte Abhaengigkeitspruefung bei Quellen-, Assertion- und
  referenzierten Revisionsaenderungen
- Restore-validierbare Typ- und Besitzerpruefung auch bei deaktivierten
  User-Triggern
- Admin-RLS, kein anonymer oder Patientenzugriff
- `service_role` ausschliesslich lesend
- kein Zugriff fuer `kb_importer` oder `kb_import_runtime`

## Backup und Restore

- Wiki-Teilbackup von 32 auf 38 Tabellen erweitert
- Frontend-, Edge-, Fallback-, OpenAPI- und Snapshotinventar abgeglichen
- Snapshotzähler `invalid_therapeutic_catalog_revisions` hinzugefuegt
- Edge-Export verlangt einen endlichen numerischen Nullwert
- Restore-Reihenfolge um therapeutische Detailtabellen erweitert
- Zusammensetzungskomponenten werden nach den Detailtabellen geladen
- synthetischer 38-Tabellen-Export und Restore mit identischem
  Zeilenzahl-/SHA-256-Manifest erfolgreich

## Verifikation

- fokussierter Katalogtest: 14/14 bestanden
- vollstaendiger Testlauf: 303/303 bestanden, 33 Testdateien
- `npx tsc -p tsconfig.app.json --noEmit`: bestanden
- `npx tsc -p tsconfig.node.json --noEmit`: bestanden
- `npm run build`: bestanden
- `git diff --check`: keine Fehler; nur bestehende Windows-LF/CRLF-Hinweise
- Secret-, PII- und Patientenschluesselpruefung der neuen Migration: keine Funde
- unabhaengige Review nach zwei Korrekturschleifen: `APPROVE`, keine P1/P2-Funde

Bekannte unveraenderte Buildhinweise:

- veraltete Browserslist-Daten
- `eval`-Hinweis aus `bluebird`
- vorhandene grosse Vite-Chunks

Diese Hinweise wurden nicht im Phase-3.2-Datenbankblock geaendert.

## Nicht umgesetzt

- keine echten medizinischen Mittel oder Produktdaten
- keine Dosierungen oder Sicherheitsregeln
- keine Patientenfakten
- keine Entitaets-Promotion
- keine Repertoriumsdaten
- keine Retrieval-v2-Ausfuehrung
- keine Aenderung am sichtbaren Therapiepfad
- keine Supabase-Migration oder Edge-Bereitstellung

## Naechste Schritte

1. Phase-3.2-Diff und beabsichtigte Staging-Dateien vor einem Commit gemeinsam
   pruefen.
2. Supabase-Deployment weiterhin getrennt planen und erst mit Remotezugang,
   Backup, Restore-Test und Rollback-Freigabe durchfuehren.
3. Anschliessend Schritt 2 planen: typgerechte, atomare Katalog-Promotion aus
   dem geprueften Import-Staging.
