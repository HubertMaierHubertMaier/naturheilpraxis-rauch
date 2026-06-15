# 04 — Frontend-Features

## Verzeichnisstruktur

```
src/
├── components/
│   ├── admin/           — Admin-UI (Dashboard, Wiki, Pricing, PatientManager, TherapyRecommendation)
│   │   └── therapy/     — Therapy-Submodule (LiveInputSummary, MultiDocUpload, ResultPanel, ...)
│   ├── anamnese/        — Anamnesebogen-Sektionen (Wizard + Accordion)
│   ├── home/            — Hero, Features, InfoSection, WelcomeSelection
│   ├── hypnose/         — HypnoseAudioPlayer
│   ├── iaa/             — IAAForm (Section XXIV Trikombin)
│   ├── layout/          — Header, Footer, Layout, InfothekDropdown
│   ├── seo/             — SEOHead, SchemaOrg (JSON-LD)
│   └── ui/              — shadcn-Primitiven (NICHT editieren)
├── pages/               — Route-Komponenten (~30)
├── lib/                 — pdfExport*, icd10Mapping, therapyParser, translations, medicalOptions, ...
├── hooks/               — useAdminCheck, useAnamneseEnabled, useAnamnesePublic, ...
├── contexts/            — AuthContext, LanguageContext
└── integrations/supabase/  — client.ts + types.ts (AUTO-GEN, niemals editieren)
```

## Kernfeatures (Stand 15.06.2026)

### Therapy Recommendation (Admin) — **stark erweitert seit 07.06.**
- **Pfad**: `src/components/admin/TherapyRecommendation.tsx` + `src/components/admin/therapy/*`
- **Eingaben**: Pseudonym, Alter, Geschlecht, Symptome, Erkrankung, Medikamente, Budget, Labor, Stuhl, Arztbericht, Metatron/Heel-NLS, Perplexity-Analyse, **eigene HP-Therapie-Vorlage**, **Apotheker-Rezept** (Text + PDF/Bild-Upload mit OCR), **Zusatz-Therapie** (z. B. Stuhlanalyse)
- **Auto-Save**: alle ~5s in `therapy_sessions` (kind=`empfehlung`, autoSavedDraft=true) via `upsert_therapy_autosave_draft` RPC
- **KI-Empfehlung**: `therapy-recommend` Edge Function (Gemini 2.5, Wiki-Boost durch Ordnerauswahl, Pin-Mechanismus für Vitaplace/Mannayan)
- **KI-Sinnhaftigkeits-Check**: `check-hp-therapy` Edge Function (separat aufrufbar im grünen Block) — bewertet HP-Therapie, Apotheker-Rezept und Zusatz-Therapie auf Sinnhaftigkeit, Wechselwirkungen, Lücken
- **Export**: PDF (jsPDF), HTML in neuem Tab, HTML-Download, Befund-Speicherung in `therapy_sessions` (kind=`befund_auswertung`, befund_html)
- **Live-Übersicht**: `LiveInputSummary.tsx` zeigt Eingaben in Echtzeit + Sprung-Button zum KI-Check (`#hp-therapy-check-section`)

### Anamnesebogen
- 25 Sektionen, Wizard- oder Accordion-Layout (User-Wahl)
- Minderjährige: Sorgerechts-Sektionen mit Altersvalidierung
- Digitale Signatur (§ 126a BGB), 6-stellige OTP-Verifikation vor Submission
- PDF-Generation (`pdfExportEnhanced.ts`) → Bucket `anamnesis-pdfs` (4 MB Limit)
- Split-Mail-Routing: Anamnese → `anamnese@`, IAA → `iaa@`
- Versionierung: jede Aktualisierung erzeugt neuen Datensatz mit Vorbefüllung
- Public-Toggle via `app_settings.anamnese_public_enabled`

### IAA (Section XXIV Trikombin)
- `src/components/iaa/IAAForm.tsx`
- Bewertungsskala für Therapieverlauf
- Auto-ICD-10-Bericht an `iaa@art-of-therapy.de`

### Patient Dashboard + Patient Library
- Geschützte PDF/MP3-Sammlung (Bucket `patient-library`)
- Hypnose-Module: Raucherentwöhnung, Reizdarm, Schilddrüse (Edge-TTS Florian -50%)

### Admin Dashboard
- FAQ-CRUD, Practice-Info-CRUD, Pricing-Manager, Mannayan-Price-Manager
- Patient-Manager (Verifikation, E-Mail-Resend)
- Knowledge-Base-Manager (Wiki) + Tag-Enrichment-Dialog
- Audit-Log-Viewer
- Pathogen-Index (lateinische Nomenklatur Pflicht)

### Infothek (öffentlich + verified)
- ~20 statische HTML-Seiten unter `public/*.html` (Reveal.js-Präsentationen)
- React-basierte Seiten (Embla Carousel): Ernährung, Frequenztherapie, Heilpraktiker, Knieschwellung, Milch, Reizdarm, Raucher etc.
- Visitor-Sanitization: bestimmte Links nur für eingeloggte User sichtbar

## Mehrsprachigkeit
- `src/contexts/LanguageContext.tsx` + `src/lib/translations.ts`
- DE/EN Switch in Header (`LanguageSwitcher`)
- DB-Tabellen mit `_de`/`_en`-Suffix-Spalten

## Styling
- `src/index.css` — Sage-Green/Sand/Terracotta-Tokens als HSL-Variablen
- `tailwind.config.ts` — Theme-Extension mit semantischen Farben
- Fonts: Playfair Display (Headings), Source Sans 3 (Body)
- **Regel**: keine hardcoded Farben in Komponenten, nur Tokens
