# 07 — Assets & PDFs

## Statische HTML-Infothek (`public/*.html`)

Reveal.js-basierte Präsentationen — vollständig im Repo, kein DB-Inhalt nötig:

```
public/allergiebehandlung.html
public/ass-salicylat-histamin.html
public/candida-diaet.html
public/content-protection.js
public/datenschutz-fahrplan.html
public/diabetes-handout.html
public/kraeuter-schmerz-entzuendung.html
public/krankheit-ist-messbar.html
public/logi-ernaehrung-mitochondrien.html
public/parasiten-deutschland.html
public/patienteninfo-hochohmiges-wasser.html
public/therapieweg-uebersicht.html  ← „Ihr Therapieweg" Onboarding
public/umwelt-alltag-gesundheit.html
public/vieva-pro-vitalanalyse.html
public/viren-bakterien-deutschland.html
public/zapper-diamond-shield.html
```

## Hypnose-PDFs (`public/therapie/`)

```
public/therapie/raucherentwoehnung/Begleitskript-E-Zigarette.pdf
public/therapie/raucherentwoehnung/Selbsthypnose-Wortlaut-Audio.pdf
public/therapie/reizdarm/Begleitskript-Bauchwohl.pdf
public/therapie/reizdarm/Verlaufstagebuch-Bauchwohl.pdf
public/therapie/schilddruese/Selbsthypnose-Skript-Wortlaut.pdf
```

**Generierung**: Python-Skripte unter `scripts/build-*-hypnose.py`.

## Build-Skripte (`scripts/`)

```
scripts/build-anamnese-fillable.py       — Fillable Anamnese-PDF (Fallback Print)
scripts/build-raucher-hypnose.py         — Raucher-Hypnose PDF + TTS
scripts/build-reizdarm-hypnose.py        — Reizdarm-Hypnose PDF + TTS
scripts/build-schilddruese-hypnose.py    — Schilddrüse-Hypnose PDF + TTS
scripts/build-vertrag-datenschutz.py     — Patientenvertrag + Datenschutzerklärung
```

Voraussetzungen: Python 3.10+, `reportlab`, `edge-tts`, `pypdf`.

## PDF-Export im Frontend

| Modul | Datei | Zweck |
|---|---|---|
| Anamnese-Standard | `src/lib/pdfExport.ts` | Einfacher Export |
| Anamnese-Enhanced | `src/lib/pdfExportEnhanced.ts` | Full-Featured mit Signatur, 25 Sektionen |
| ICD-10-Bericht | `src/lib/icd10PdfExport.ts` | Für IAA-Reports |
| Datenschutz | `src/lib/datenschutzPdfExport.ts` | Patientenvertrag-PDF |
| Therapie-Befund | inline in `TherapyRecommendation.tsx` | Neu: HP-Check-Befund |

Engine: `jsPDF` + `html2canvas`. Logo + Praxis-Header in jeder PDF.

## Storage-Bucket-Inhalte (NICHT im Repo!)

Diese Bucket-Inhalte müssen separat über Cloud → Storage exportiert werden:
- `anamnesis-pdfs/` — generierte User-Anamnesen (sensibel)
- `patient-library/` — Verified-Patient-Ressourcen (PDFs + MP3s)
- `therapy-documents/` — hochgeladene Apotheker-Rezepte, Labore (sensibel)

## Restore-Folge für Assets

1. GitHub-Repo klonen → alle `public/*` + `scripts/*` automatisch da
2. Storage-Bucket-Exporte separat downloaden (Cloud-Dashboard)
3. Buckets im neuen Projekt neu anlegen (siehe Runbook)
4. Bucket-Inhalte hochladen via Cloud-UI oder `supabase storage cp`
