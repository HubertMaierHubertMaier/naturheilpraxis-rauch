# 01 — Architektur, Konfiguration, Routing

**Snapshot:** 2026-06-04 / Commit `5448b51`

## 1. Tech-Stack (exakte Versionen aus `package.json`)

### Runtime / Framework
- React `^18.3.1`, react-dom `^18.3.1`, react-router-dom `^6.30.1`
- Vite `^5.4.19`, `@vitejs/plugin-react` `4.2.1`, TypeScript `^5.8.3`
- Tailwind CSS `^3.4.17`, `@tailwindcss/typography` `^0.5.16`, `tailwindcss-animate` `^1.0.7`

### UI / shadcn-Stack
- Komplettes Radix-UI-Set (alle `@radix-ui/react-*` Pakete)
- `lucide-react` `^0.462.0`, `class-variance-authority`, `clsx`, `tailwind-merge`
- `cmdk`, `vaul`, `sonner`, `next-themes`, `embla-carousel-react`, `react-resizable-panels`, `react-day-picker`, `input-otp`, `recharts`

### Forms / Validation / Daten
- `react-hook-form` `^7.61.1`, `@hookform/resolvers` `^3.10.0`, `zod` `^3.25.76`
- `@tanstack/react-query` `^5.83.0`
- `date-fns` `^3.6.0`

### Backend / SDK
- `@supabase/supabase-js` `^2.90.1`
- Edge Functions: Deno-Runtime (Supabase Hosted), kein lokaler Server

### PDF / Dokumente
- `jspdf` `^4.0.0` (primärer PDF-Generator: `src/lib/pdfExportEnhanced.ts`)
- `docx` `^9.6.1`, `file-saver` `^2.0.5`
- `react-markdown` `^10.1.0`

### Dev / Test
- `vitest` `^3.2.4`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`
- `eslint` `^9.32.0`, `typescript-eslint`, `lovable-tagger` `^1.1.13`

---

## 2. Konfigurationsdateien

### `.env` (von Lovable Cloud verwaltet — NIE manuell editieren)
```
VITE_SUPABASE_URL=https://jmebqjadlpltnqawoipb.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptZWJxamFkbHBsdG5xYXdvaXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NjkwNTcsImV4cCI6MjA4NDI0NTA1N30.l9fm-vpCmz2FUOCxTV7amUP-IE11InHgJHA9hDdRmzY
VITE_SUPABASE_PROJECT_ID=jmebqjadlpltnqawoipb
```

### `supabase/config.toml`
```toml
project_id = "jmebqjadlpltnqawoipb"

# Edge Functions mit verify_jwt = false (Hybrid-Auth-Pattern)
[functions.request-verification-code]
verify_jwt = false
[functions.verify-code]
verify_jwt = false
[functions.submit-anamnesis]
verify_jwt = false
[functions.send-verification-email]
verify_jwt = false
[functions.generate-icd10]
verify_jwt = false
[functions.send-icd10-report]
verify_jwt = false
[functions.resend-submission]
verify_jwt = false
[functions.get-patients]
verify_jwt = false
[functions.therapy-recommend]
verify_jwt = false
[functions.get-therapy-sessions]
verify_jwt = false
```

Funktionen ohne expliziten Eintrag (`elevenlabs-tts`, `enrich-wiki-tags`, `extract-lab-image`, `generate-diagnoses`, `list-therapy-pseudonyms`, `notify-existing-patient`) laufen mit Lovable-Defaults.

### `vite.config.ts`
- Port 8080, Host `::`, HMR-Overlay aus
- `componentTagger` nur in development
- Alias `@` → `./src`

### `tsconfig.json`
- `allowJs: true`, `noImplicitAny: false`, `strictNullChecks: false`
- Paths: `@/* → ./src/*`

---

## 3. Verzeichnisstruktur (Top-Level)

```
naturheilpraxis-rauch/
├── docs/                              # Dokumentation + Restore-Files (V1..V8)
│   └── SNAPSHOT-2026-06-04/           # ← DIESER SNAPSHOT
├── public/                            # Statische HTML-Slides, PDFs, Audio, Bilder
│   ├── therapie/                      # Hypnose-MP3s + Begleitskripte
│   │   ├── raucherentwoehnung/
│   │   ├── reizdarm/
│   │   └── schilddruese/
│   └── *.html                         # 15+ Patienten-Infoseiten (Reveal.js)
├── scripts/                           # Python-Buildskripte (Hypnose-PDF/MP3, Vertrag)
├── src/
│   ├── App.tsx                        # Routing-Root
│   ├── main.tsx
│   ├── index.css                      # Design-Tokens (Sage/Sand/Terracotta)
│   ├── assets/                        # hero-nature.jpg, practice-icon.png, practice-logo.png
│   ├── components/
│   │   ├── admin/                     # 16 Admin-Komponenten + therapy/ Unterordner
│   │   ├── anamnese/                  # 25 Sections + shared/ Helpers
│   │   ├── home/                      # HeroSection, FeaturesSection, InfoSection, WelcomeSelection
│   │   ├── hypnose/                   # HypnoseAudioPlayer
│   │   ├── iaa/                       # IAAForm
│   │   ├── layout/                    # Header, Footer, Layout, InfothekDropdown
│   │   ├── seo/                       # SEOHead, SchemaOrg
│   │   ├── ui/                        # 49 shadcn-Komponenten
│   │   ├── AnamneseRouteGuard.tsx
│   │   ├── CookieBanner.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── LanguageSwitcher.tsx
│   │   ├── LoginDisabledBanner.tsx
│   │   ├── NavLink.tsx
│   │   └── ProtectedRoute.tsx
│   ├── contexts/                      # AuthContext, LanguageContext
│   ├── hooks/                         # useAdminCheck, useAnamneseEnabled, useAnamnesePublic, useContentProtection, usePatientLoginEnabled, use-mobile, use-toast
│   ├── integrations/supabase/         # AUTO-GENERATED — client.ts + types.ts (nie editieren)
│   ├── lib/                           # 13 Module (siehe unten)
│   ├── pages/                         # 33 Pages (siehe Routing)
│   └── test/                          # Vitest setup + example
└── supabase/
    ├── config.toml
    └── functions/                     # 16 Edge Functions + _shared/smtp.ts
```

### `src/lib/` Module (LOC-zählung)
| Datei | LOC | Zweck |
|------|-----|-------|
| `anamneseFormData.ts` | 619 | Anamnese-Datenmodell (25 Sections), Field-Definitionen, TypeScript-Types |
| `iaaQuestions.ts` | 409 | IAA-Fragenkatalog für Trikombin/Bicom |
| `pdfExportEnhanced.ts` | 1417 | Haupt-PDF-Generator (Anamnese, IAA, mit Signatur) |
| `pdfExport.ts` | 12 | Re-Export-Shim |
| `datenschutzPdfExport.ts` | 259 | Patientenvertrag + Datenschutz-PDF |
| `icd10PdfExport.ts` | 235 | ICD-10-Bericht-PDF |
| `icd10Mapping.ts` | 217 | Symptom→ICD-10-Mapping (Fixed-Lookup) |
| `infothekContent.ts` | 270 | Infothek-Inhaltsindex (5 Sektionen) |
| `medicalOptions.ts` | 314 | Dropdown-Optionen (Medikamente, Allergien, etc.) |
| `therapyParser.ts` | 207 | Therapieempfehlungs-Parser (AI-Output → strukturiert) |
| `translations.ts` | 49 | DE/EN-Translation-Helfer |
| `devAdminBypass.ts` | 62 | Dev-Mode Admin-Bypass (nur non-prod) |
| `utils.ts` | 6 | `cn()` Helper |

---

## 4. Routing — `src/App.tsx` (33 Routen)

| Pfad | Component | Schutz |
|------|-----------|--------|
| `/` | `Index` | public |
| `/auth` | `Auth` | public (Login + Registrierung + 2FA) |
| `/anamnesebogen` | `Anamnesebogen` | `AnamneseRouteGuard` (App-Setting `anamnese_enabled` + Auth/Public-Toggle) |
| `/anamnesebogen-demo` | `AnamneseDemo` | public (Test-Daten) |
| `/erstanmeldung` | `Erstanmeldung` | `ProtectedRoute` (Auth pflicht) |
| `/datenschutz` | `Datenschutz` | public |
| `/impressum` | `Impressum` | public |
| `/patientenaufklaerung` | `Patientenaufklaerung` | public |
| `/neupatient` | `Neupatient` | public |
| `/heilpraktiker` | `Heilpraktiker` | public |
| `/gebueh` | `Gebueh` | public (Gebührenordnung) |
| `/ernaehrung` | `Ernaehrung` | public |
| `/milch-unvertraeglichkeit` | `MilchUnvertraeglichkeit` | public |
| `/milch-knochengesundheit` | `MilchKnochengesundheit` | public |
| `/rohmilch-mikrobiologie` | `RohmilchMikrobiologie` | public |
| `/frequenztherapie` | `Frequenztherapie` | public |
| `/faq` | `FAQ` | public (DB-getrieben) |
| `/praxis-info` | `PraxisInfo` | public (DB-getrieben) |
| `/quellenhinweis` | `Quellenhinweis` | public |
| `/raucherentwoehnung` | `Raucherentwoehnung` | public (Hypnose-Modul) |
| `/schilddruese-hypnose` | `SchilddrueseHypnose` | public |
| `/reizdarm-hypnose` | `ReizdarmHypnose` | public |
| `/reizdarm` | `Reizdarm` | public |
| `/knieschwellung` | `Knieschwellung` | public |
| `/infothek` | `Infothek` | public (Übersicht 5 Pillars) |
| `/admin` | `AdminDashboard` | clientseitig `useAdminCheck` |
| `/wissensdatenbank` | `Wissensdatenbank` | clientseitig Admin |
| `/patienten` | `PatientenManager` | clientseitig Admin |
| `/dashboard` | `PatientDashboard` | (kein ProtectedRoute! eigene Logik intern) |
| `/patienten-bibliothek` | `PatientenBibliothek` | `ProtectedRoute` |
| `/app-uebersicht` | `AppUebersicht` | public (App-Funktionsübersicht) |
| `*` | `NotFound` | catch-all |

**Hinweis:** `/admin`, `/wissensdatenbank`, `/patienten`, `/dashboard` haben KEINEN `ProtectedRoute`-Wrapper im App.tsx — die Auth-Prüfung erfolgt in der Component selbst (siehe `useAdminCheck`, `useAuth`).

---

## 5. Provider-Hierarchie (`src/App.tsx`)

```
QueryClientProvider
└── LanguageProvider          (DE/EN, localStorage-persistent)
    └── AuthProvider          (Supabase Auth, isAdmin via has_role RPC)
        └── TooltipProvider
            ├── Toaster + Sonner + SchemaOrg
            └── BrowserRouter
                ├── CookieBanner
                └── Routes
```

## 6. Design-Tokens (`src/index.css` + `tailwind.config.ts`)

Verbindliche Marken-Palette (HSL-Tokens):
- **Primary:** Salbei (Sage Green)
- **Secondary:** Sand
- **Accent:** Terracotta
- **Fonts:** Playfair Display (Headings), Source Sans 3 (Body)

Alle Komponenten verwenden semantische Tokens (`bg-primary`, `text-foreground` etc.) — keine Hard-Coded-Farben.
