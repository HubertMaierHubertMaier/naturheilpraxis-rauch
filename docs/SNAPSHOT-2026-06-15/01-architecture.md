# 01 — Architektur

## Tech-Stack

- **Frontend**: React 18, Vite 5, Tailwind CSS 3, TypeScript 5, shadcn/ui
- **Backend**: Lovable Cloud (Supabase) — PostgreSQL + Row-Level Security
- **Edge Functions**: Deno auf Supabase Edge Runtime
- **AI**: Lovable AI Gateway (Gemini 2.5 Flash/Pro) via `LOVABLE_API_KEY`
- **Email**: PHP-Relay v3.6 auf eigenem Linux-Root (SMTP Port 587, CRLF)
- **TTS**: ElevenLabs + Edge-TTS (Hypnose: Stimme `de-DE-FlorianMultilingualNeural`, Rate -50%, Pitch ±0 Hz)
- **PDF**: jsPDF + html2canvas (`src/lib/pdfExport.ts`, `pdfExportEnhanced.ts`, `icd10PdfExport.ts`, `datenschutzPdfExport.ts`)
- **Hosting**: Lovable-Preview + Lovable-Publish + Ziel: Linux Root Server (Portabilität gewährleistet)

## Auth-Modell (3-Tier Access)

```
┌───────────────────┐
│ Visitor (public)  │  → Startseite, Impressum, Datenschutz, FAQ, ausgewählte Infothek
├───────────────────┤
│ Neupatient        │  → + Anamnesebogen, Patientenvertrag, IAA
│ (auth.users)      │
├───────────────────┤
│ Verified Patient  │  → + Patient Dashboard, Patient Library, Hypnose-Module
│ (profiles.is_     │
│  verified_patient)│
├───────────────────┤
│ Admin             │  → + Admin Dashboard, Wiki, Therapie-Recommendation, Patient Manager
│ (user_roles.role  │
│  = 'admin')       │
└───────────────────┘
```

**2FA**: Mandatory für Login/Registrierung (außer Admin-Bypass via `useAdminCheck`).
Code-Versand via PHP-Relay → `request-verification-code` / `verify-code` Edge Functions.

## Routing (`src/App.tsx`)

| Route | Komponente | Zugriff |
|---|---|---|
| `/` | `Index` | Public |
| `/auth` | `Auth` | Public |
| `/erstanmeldung` | `Erstanmeldung` | Public |
| `/neupatient` | `Neupatient` | Public |
| `/anamnesebogen` | `Anamnesebogen` | Auth oder Public-Toggle |
| `/anamnesebogen-demo` | `AnamneseDemo` | Public (Test) |
| `/patient-dashboard` | `PatientDashboard` | Verified |
| `/patienten-bibliothek` | `PatientenBibliothek` | Verified |
| `/admin` | `AdminDashboard` | Admin |
| `/wissensdatenbank` | `Wissensdatenbank` | Admin |
| `/infothek` + ~20 Themen-Seiten | `Infothek*` | Public/Verified gemischt |
| `/raucherentwoehnung`, `/reizdarm`, `/schilddruese-hypnose` | Hypnose-Module | Verified |
| `/impressum`, `/datenschutz`, `/faq`, `/praxis-info`, `/quellenhinweis` | Public | Public |

Vollständige Routenliste: `src/App.tsx`.

## Edge-Function-Topologie

Siehe `03-edge-functions.md`. Aufrufmuster: Hybrid Auth — User-JWT für Auth-Kontext + Service-Role für DB-Schreibzugriff mit RLS-Bypass nur wenn explizit nötig.

## Datenfluss „Therapie-Empfehlung" (neu)

```
Admin UI (TherapyRecommendation.tsx)
   ↓ Eingaben (Patient-Pseudonym, Symptome, Labor, Apotheker-Rezept-PDF)
   ↓ optional: MultiDocUpload → analyze-documents (OCR + PII-Scrub)
   ↓
   ├─ therapy-recommend  → KI-Empfehlung (Gemini, Wiki-Boost)
   └─ check-hp-therapy   → KI-Sinnhaftigkeits-Check der HP-Therapie + Apotheker-Rezept + Zusatz-Therapie
   ↓
   Befund-HTML wird in therapy_sessions (kind='befund_auswertung') gespeichert
   + Export als PDF / HTML / neuer Tab
```
