# 07 — Assets, PDFs, Hypnose-MP3s, HTML-Slides

**Snapshot:** 2026-06-04

## 1. `public/` Verzeichnis

### Blanko-Formulare (PDF)
- `anamnesebogen-blanko.pdf`
- `datenschutz-einwilligung-blanko.pdf`
- `patientenpaket-blanko.pdf`
- `patientenvertrag-blanko.pdf`

### HTML-Slides (Reveal.js Presentations)
Patienteninfo-Seiten als statische HTML-Präsentationen (vertikal scrollbar, 1600x900px Base):
- `allergiebehandlung.html`
- `ass-salicylat-histamin.html`
- `candida-diaet.html`
- `datenschutz-fahrplan.html`
- `diabetes-handout.html`
- `kraeuter-schmerz-entzuendung.html`
- `krankheit-ist-messbar.html`
- `logi-ernaehrung-mitochondrien.html`
- `parasiten-deutschland.html`
- `patienteninfo-hochohmiges-wasser.html`
- `therapieweg-uebersicht.html` (Patient-Onboarding "Ihr Therapieweg")
- `umwelt-alltag-gesundheit.html`
- `vieva-pro-vitalanalyse.html`
- `viren-bakterien-deutschland.html`
- `zapper-diamond-shield.html`

### Hypnose-Module (`public/therapie/`)
```
therapie/
├── raucherentwoehnung/
│   ├── Begleitskript-E-Zigarette.pdf
│   └── Selbsthypnose-Wortlaut-Audio.pdf
├── reizdarm/
│   ├── Begleitskript-Bauchwohl.pdf
│   └── Verlaufstagebuch-Bauchwohl.pdf
└── schilddruese/
    └── Selbsthypnose-Skript-Wortlaut.pdf
```

MP3-Dateien werden über `public/audio/` oder direkt im Therapie-Ordner gehostet.

### Statische Resources
- `placeholder.svg`, `favicon.ico`, `robots.txt`
- `content-protection.js` — Rechtsklick-/Copy-Blocker für sensible Inhalte (über `useContentProtection`-Hook aktiviert)
- `public/bilder/` — Hero/Symbol-Bilder (neutral, kein Stock)
- `public/audio/` — Hypnose-MP3s

---

## 2. `scripts/` — Python Build-Tools

| Script | Funktion |
|--------|----------|
| `build-raucher-hypnose.py` | Generiert Wortlaut-PDF + Edge-TTS-MP3 für Raucherentwöhnung |
| `build-schilddruese-hypnose.py` | Schilddrüsen-Hypnose |
| `build-reizdarm-hypnose.py` | Reizdarm-Hypnose |
| `build-anamnese-fillable.py` | Generiert PDF-Fillable-Version des Anamnesebogens |
| `build-vertrag-datenschutz.py` | Patientenvertrag + Datenschutzerklärung als PDF |

**TTS-Standard (VERBINDLICH):**
```python
voice = "de-DE-FlorianMultilingualNeural"
rate = "-50%"
pitch = "+0Hz"
```

---

## 3. Frontend-Assets (`src/assets/`)

- `hero-nature.jpg` — Landing-Hero
- `practice-icon.png` — App-Icon
- `practice-logo.png` — Brand-Logo

---

## 4. PDF-Export-Module (`src/lib/`)

| Modul | Zweck | LOC |
|-------|-------|-----|
| `pdfExportEnhanced.ts` | Haupt-Generator: Anamnese-PDF + IAA-PDF mit Signatur, Layout, Header/Footer | 1417 |
| `pdfExport.ts` | Re-Export-Shim (Legacy) | 12 |
| `datenschutzPdfExport.ts` | Patientenvertrag + Datenschutz-Einwilligung | 259 |
| `icd10PdfExport.ts` | ICD-10-Bericht für Versand an iaa@ | 235 |

**Engine:** `jspdf` 4.0.0
**Schriftarten:** System-Fonts (kein Custom-Font-Embedding aktuell)
**Layout:** A4 Hochformat, 1cm Ränder, Praxis-Header mit Logo

---

## 5. Bekannte Storage-Limits

- **Edge-Function-Payload:** 4 MB max → PDFs müssen unter dieser Grenze bleiben
- **Storage-Bucket `anamnesis-pdfs`:** Privat, signierte URLs (15 Min Default)
- **Storage-Bucket `patient-library`:** Privat, nur verified patients

---

## 6. Wiederherstellung der Assets

Alle Assets sind im Git-Repo eingecheckt. `git clone` der GitHub-Spiegelung enthält:
- Alle PDFs in `public/`
- Alle HTML-Slides
- Alle Hypnose-Begleitmaterialien
- Alle Build-Scripts
- Frontend-Assets in `src/assets/`

**MP3s im public-Ordner** sind ebenfalls eingecheckt (Git LFS oder direkt — je nach Größe). Bei Wiederherstellung prüfen: `ls -lah public/therapie/*/`.
