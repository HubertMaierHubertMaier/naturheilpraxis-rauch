# 07 — Statische Assets, PDFs, Hypnose-MP3s, Build-Skripte

**Snapshot:** 2026-06-07

## 1. `public/` — direkt ausgelieferte Dateien

### HTML-Handouts (öffentlich, von Routen verlinkt)
- `allergiebehandlung.html`, `ass-salicylat-histamin.html`, `candida-diaet.html`
- `datenschutz-fahrplan.html`, `diabetes-handout.html`
- `kraeuter-schmerz-entzuendung.html`, `krankheit-ist-messbar.html`
- `logi-ernaehrung-mitochondrien.html`, `parasiten-deutschland.html`
- `patienteninfo-hochohmiges-wasser.html`, `therapieweg-uebersicht.html`
- `umwelt-alltag-gesundheit.html`, `vieva-pro-vitalanalyse.html`
- `viren-bakterien-deutschland.html`, `zapper-diamond-shield.html`

Diese HTML-Handouts sind Reveal.js-Präsentationen (Memory: `infothek-presentation-frameworks`) oder statische Info-Seiten — direkt unter `https://…/<filename>.html` aufrufbar.

### Sonstiges
- `robots.txt` — Allow-Regeln + Disallow für `/admin*`, `/patienten*`
- `placeholder.svg`
- `content-protection.js` — Right-Click-Disable-Logik (Memory: `content-protection-policy`)

---

## 2. `public/therapie/` — Hypnose-Module (statische Assets)

### `raucherentwoehnung/`
- `Begleitskript-E-Zigarette.pdf`
- `Selbsthypnose-Skript-Wortlaut.pdf` (Pflicht, Memory)
- `Selbsthypnose-Freiheit-Taeglich.mp3` + `-Frau.mp3`
- `Selbsthypnose-Freiheit-Tief.mp3` + `-Frau.mp3`

### `reizdarm/`
- `Begleitskript-Bauchwohl.pdf`
- `Verlaufstagebuch-Bauchwohl.pdf`
- MP3s (build via `scripts/build-reizdarm-hypnose.py`)

### `schilddruese/`
- `Selbsthypnose-Skript-Wortlaut.pdf`
- MP3s (build via `scripts/build-schilddruese-hypnose.py`)

**TTS-Build-Standard (verbindlich):**
- Engine: Microsoft Edge-TTS
- Voice: `de-DE-FlorianMultilingualNeural`
- Rate: `-50%`
- Pitch: `±0 Hz`
- Memory: `tts-engine`

---

## 3. PDF-Generator-Module (`src/lib/`)

| Datei | Zweck | LOC |
|---|---|---|
| `pdfExportEnhanced.ts` | Vollständige Anamnese-PDF-Erzeugung (jsPDF, alle 25 Sektionen, Signatur-Einbettung, Header/Footer/Watermark) | **1.417** |
| `pdfExport.ts` | Re-Export-Stub (12 LOC) |
| `icd10PdfExport.ts` | ICD-10-Report-PDF | 235 |
| `datenschutzPdfExport.ts` | Datenschutzerklärung als PDF (z.B. Erstanmeldung-Begleitdokument) | 259 |
| `infothekContent.ts` | Public-Wiki-Content-Definitionen | 270 |
| `medicalOptions.ts` | Stamm-Listen (Krankheiten, Medikamente, Allergien) | 314 |
| `therapyParser.ts` | Wiki-Markdown-Parser für Pathogen-Index / Therapie-Karten | 207 |
| `iaaQuestions.ts` | IAA-Fragebogen-Definition (Trikombin-Skala) | 409 |
| `icd10Mapping.ts` | Lokales ICD-10-Lookup (Hybrid-Fallback) | 217 |
| `anamneseFormData.ts` | Sektions-Definitionen + Defaults für Anamnesebogen | 619 |
| `securityAccessMatrix.ts` | Auth-Matrix-Spec | 270 |
| `translations.ts` | DE/EN-Strings (LanguageContext) | 49 |
| `devAdminBypass.ts` | Stub (Phase 3 deaktiviert) | 56 |
| `utils.ts` | `cn()` shadcn-helper | 6 |

PDF-Erzeugung läuft **zur Submit-Zeit in der Edge-Function** (Deno-portierter jsPDF-Pfad in `submit-anamnesis/index.ts`, 700 LOC) und **zur Admin-Aktion im Browser** (jsPDF im Frontend).

---

## 4. `scripts/` — Python-Build-Scripts

| Script | Zweck |
|---|---|
| `build-anamnese-fillable.py` | Erzeugt befüllbares PDF-Anamnese-Formular (Backup-/Print-Variante) |
| `build-raucher-hypnose.py` | Generiert MP3s + PDF-Wortlaut für Raucherentwöhnung via Edge-TTS |
| `build-reizdarm-hypnose.py` | dito für Reizdarm |
| `build-schilddruese-hypnose.py` | dito für Schilddrüse |
| `build-vertrag-datenschutz.py` | Patientenvertrag + Datenschutz-PDF |

**Voraussetzung:** Python 3.10+, `edge-tts` (`pip install edge-tts`), `reportlab` für PDF.

Run-Beispiel:
```bash
python3 scripts/build-raucher-hypnose.py
# → schreibt nach public/therapie/raucherentwoehnung/*.mp3 + .pdf
```

---

## 5. Mail-Relay-Quelltext

- `docs/mail-relay-v3-smtp.php` — **Source of Truth** für PHP-Relay v3.6
- Deploy: SFTP nach `https://rauch-heilpraktiker.de/mail-relay.php`
- Konfig: Per-Recipient SMTP-Auth-Credentials in PHP-Datei (oder via Env)
- Port 587 STARTTLS, CRLF Line-Endings (kritisch — sonst Postfix-Reject)
- Fallback: PHP `mail()` bei SMTP-Fehler

Legacy-Versionen archiviert: `docs/mail-relay-v2.php`, `docs/mail-relay-v2.php.old`, `docs/send-email-relay.php`.

---

## 6. Storage-Buckets (Lovable Cloud)

| Bucket | Inhalt | Größenrahmen |
|---|---|---|
| `anamnesis-pdfs` | Pro Submission ein PDF (~200–800 KB) | erwartet < 5 GB / Jahr |
| `patient-library` | Patienten-Bibliothek (PDFs, MP3s, Skripte) | manuell vom Admin gepflegt |

Backup: Lovable Cloud UI → Storage → Bucket → Download.

---

## 7. Schriften & externe Resources

- **Playfair Display** + **Source Sans 3** — Google Fonts via `@import` in `src/index.css`
- **Lucide Icons** — `lucide-react`
- **Recharts** — Diagramme im Admin-Dashboard
- Keine CDN-Abhängigkeiten für Geschäftslogik
