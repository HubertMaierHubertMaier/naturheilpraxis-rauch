## Ziel

Im **Admin → Backup-Center** zusätzlich zu den bestehenden Buttons (GitHub-Code-ZIP, DB-Backup, Voll-Backup) eine neue Sektion **"Teilbereich-Backups"** einbauen. Jeder Teilbereich erzeugt **lokal im Browser** ein eigenes ZIP mit *allen* dazugehörigen Dateien (Code-Assets aus `public/`, DB-Tabellen als JSON+CSV, Storage-Bucket-Dateien). So musst du bei einem verschütteten Teil nur das passende kleine ZIP zurückspielen.

## Teilbereiche (Vorschlag)

| Bereich | Enthält |
|---|---|
| **Anamnesebogen** | `public/anamnesebogen-blanko.pdf` (+ `.backup`), `assets/backups/anamnesebogen-blanko.pdf`, `src/pages/Anamnesebogen.tsx`, `src/components/anamnese/*`, `src/lib/anamneseFormData.ts`, `src/lib/pdfExport*.ts`, DB-Tabelle `anamnesis_submissions`, Bucket `anamnesis-pdfs` |
| **Patientenvertrag & Datenschutz** | `scripts/build-vertrag-datenschutz.py`, `src/pages/Datenschutz.tsx`, `src/lib/datenschutzPdfExport.ts`, alle generierten Vertrags-PDFs in `public/` |
| **Wiki / Naturheilkundliche Mittel** | `src/pages/Wissensdatenbank.tsx`, Admin-Wiki-Komponenten, DB-Tabellen `admin_knowledge_base`, `wiki_*`, `practice_pricing` |
| **Infothek (öffentlich)** | alle `public/*.html` Patienten-Infoseiten, `src/pages/Infothek.tsx`, `src/lib/infothekContent.ts`, `public/infothek-gate.js` |
| **Hypnose-Module** | `public/therapie/**`, `src/pages/*Hypnose.tsx`, `scripts/build-*-hypnose.py`, `src/components/hypnose/*` |
| **Patienten-Bibliothek** | `src/pages/PatientenBibliothek.tsx`, Bucket `patient-library` |
| **IAA / ICD-10** | `src/components/iaa/*`, `src/lib/iaaQuestions.ts`, `src/lib/icd10*.ts`, Edge-Functions `generate-icd10`, `send-icd10-report` |
| **Edge Functions & Mail-Relay** | `supabase/functions/**`, `docs/mail-relay-v3-smtp.php` |
| **Auth & 2FA** | `src/pages/Auth.tsx`, `src/pages/Erstanmeldung.tsx`, `src/contexts/AuthContext.tsx`, Edge-Functions `*-verification-*`, `verify-code` |

(Liste am Ende noch verfeinerbar — siehe Frage unten.)

## Umsetzung

### 1. Neue Edge-Function `backup-subset`
- Input: `{ area: "anamnesebogen" | "wiki" | ... }`
- Liefert pro Bereich gezielt nur die relevanten DB-Tabellen + Storage-Buckets als JSON.
- Code-Dateien aus `public/` werden **nicht** in dieser Funktion gepackt — diese holt der Browser direkt per `fetch('/anamnesebogen-blanko.pdf')` etc. (sind ja statisch ausgeliefert).
- `src/`-Dateien liegen **nicht** auf dem laufenden Server — die kommen weiterhin nur über das GitHub-ZIP. Pro Teilbereich erzeugen wir aber ein **Filter-Manifest** (`AREA-MANIFEST.json`) mit der Liste der zugehörigen Pfade, sodass man aus einem GitHub-ZIP gezielt die Teilbereich-Dateien extrahieren kann.

### 2. Frontend `BackupCenter.tsx` erweitern
- Neue Card **"Teilbereich-Backups"** mit einem Button pro Bereich.
- Klick → Edge-Function `backup-subset?area=...` rufen, im Browser per `JSZip` zusammenpacken mit:
  - `db/<tabelle>.json` + `.csv`
  - `storage/<bucket>/...` (per Signed-URL geladen)
  - `public-assets/...` (direkt per `fetch` vom eigenen Server)
  - `AREA-MANIFEST.json` (Liste aller Source-Pfade des Bereichs)
  - `RESTORE-ANLEITUNG.md` (wie man genau diesen Bereich zurückspielt)
- Download als `Naturheilpraxis-<Bereich>-Backup-<Zeitstempel>.zip`.

### 3. Bestehende Buttons bleiben
- GitHub-Code-ZIP, DB-Backup und Voll-Backup unverändert.
- Die neuen Teilbereich-Buttons stehen darunter in einer eigenen Card.

## Technisches

- Mapping Bereich → {Tabellen[], Buckets[], PublicAssets[], SourcePaths[]} liegt als Konstante sowohl im Frontend (für Public-Assets + Manifest) als auch in der Edge-Function (für DB/Storage) — zentrale Definition in `src/lib/backupAreas.ts`, in Edge-Function via Copy/Paste gespiegelt.
- Größenbegrenzung: pro Bereich i.d.R. < 20 MB, Browser-`JSZip` ist dafür unproblematisch.
- Sicherheit: Edge-Function bleibt admin-only (gleicher JWT/Role-Check wie `backup-export`).

## Frage vor Umsetzung

Passen die 9 vorgeschlagenen Teilbereiche so, oder willst du Bereiche zusammenlegen / splitten / umbenennen (z. B. "Auth & 2FA" mit "Patienten-Verwaltung" verschmelzen)?
