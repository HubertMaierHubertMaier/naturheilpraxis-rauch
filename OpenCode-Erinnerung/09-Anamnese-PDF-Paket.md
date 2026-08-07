# Anamnese PDF Paket

## Verbindliches Ziel

Der geschuetzte Erstanmeldungs-Download soll ein einziges vollstaendiges PDF liefern:

1. Anamnesebogen
2. Patientenvertrag
3. Datenschutz-Einwilligung

## Aktueller verbindlicher Stand

Peter hat am 27.07.2026 bestaetigt: `assets/protected-pdfs/patientenpaket-blanko.pdf` ist der aktuelle Anamnesevertrag im ausfuellbaren Adobe-PDF-Format. Bei kuenftigen Aenderungen ist diese Datei die verbindliche Ausgangsversion und darf nicht stillschweigend durch eine aeltere Fassung ersetzt werden.

## Befund vom 27.07.2026

Die App-Texte versprachen bereits dieses Komplettpaket. Der Download forderte jedoch `anamnesebogen` an, und die Edge Function `download-anamnesis-pdf` lieferte nur `blanko/anamnesebogen-blanko.pdf`.

Die versionierte Datei `assets/protected-pdfs/patientenpaket-blanko.pdf` ist das korrekte Paket. Nach Ergaenzung der radiologischen Angaben und Preisgestaltung am 27.07.2026 umfasst sie 49 Seiten: radiologische und nuklearmedizinische Angaben auf den Seiten 18 bis 20, Patientenvertrag mit vollstaendiger Preisliste auf Seite 45, Datenschutz-Einwilligung ab Seite 47 und eine gemeinsame Bestaetigungs-/Unterschriftsseite auf Seite 49.

## Lokale Korrektur

- `src/lib/anamnesePdfDownload.ts` fordert `patientenpaket` an und verwendet den Dateinamen `patientenpaket-blanko.pdf`.
- `supabase/functions/download-anamnesis-pdf/index.ts` liefert `blanko/patientenpaket-blanko.pdf`. Auch der alte Requestname `anamnesebogen` wird waehrend des Rollouts auf das vollstaendige Paket geleitet.
- `src/components/anamnese/AnamnesePdfButton.tsx` und `src/pages/Anamnesebogen.tsx` benennen den Download sichtbar als vollstaendiges Patientenpaket.
- `src/test/anamnese-pdf-package.test.ts` sichert Request, Storage-Pfad und Dateinamen ab.
- Der Patientenvertrag enthaelt jetzt die sieben am 27.07.2026 live verifizierten Preispositionen aus `practice_pricing`: Haupttherapien/Analyseverfahren, Vieva Check, Omega-3 Test, Analyseversand, 150MHz-Erstaufnahme, 150MHz-Folgetermine und Ausfallentschaedigung.
- `scripts/refresh-clear-signature-pages.py` registriert nach dem Zusammenfuehren alle sichtbaren PDF-Widgets erneut im AcroForm-Feldbaum. Das Paket besitzt dadurch 3186 ausfuellbare Felder statt nur der Felder der letzten Unterschriftsseite.

## Verifikation

- Lokale PDF-Pruefung: 49 Seiten und alle drei Dokumentteile vorhanden; Preisliste auf Seite 45, Datenschutz ab Seite 47, gemeinsame Unterschrift auf Seite 49 und 3186 registrierte AcroForm-Felder.
- Paketpruefungen: 4/4 erfolgreich.
- Interaktive Radiologiepruefung: 1/1 erfolgreich.
- Gesamttest: 89/89 erfolgreich.
- TypeScript App und Node: erfolgreich.
- Produktionsbuild: erfolgreich.

## Noch nicht live

In der Sitzung war kein `SUPABASE_ACCESS_TOKEN` gesetzt und keine lokale Supabase-Projektverknuepfung vorhanden. Vor der Live-Bestaetigung muessen:

1. `assets/protected-pdfs/patientenpaket-blanko.pdf` als `blanko/patientenpaket-blanko.pdf` in den privaten Bucket `anamnesis-pdfs` hochgeladen beziehungsweise dort bestaetigt werden.
2. Die Edge Function `download-anamnesis-pdf` ausgerollt werden.
3. Der Frontend-Stand ueber GitHub/Lovable synchronisiert und veroeffentlicht werden.
4. Mit einem freigeschalteten Testkonto der Download als 49-seitiges Paket geprueft werden.
