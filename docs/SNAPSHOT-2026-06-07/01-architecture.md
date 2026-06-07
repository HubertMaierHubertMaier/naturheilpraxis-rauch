# 01 — Architektur, Stack, Konfiguration, Routing

**Snapshot:** 2026-06-07 · Commit `3940ee0f…`

## 1. Tech-Stack (exakte Versionen aus `package.json`)

### Runtime
- **React** 18.3.1, **React-DOM** 18.3.1
- **React-Router-DOM** 6.30.1 (mit `v7_startTransition` + `v7_relativeSplatPath` Future-Flags aktiv)
- **TanStack React-Query** 5.83.0
- **Supabase JS** 2.90.1

### Build
- **Vite** 5.4.19
- **@vitejs/plugin-react** 4.2.1
- **TypeScript** 5.8.3
- **lovable-tagger** 1.1.13 (nur development)

### UI
- **Tailwind CSS** 3.4.17 + `tailwindcss-animate` 1.0.7 + `@tailwindcss/typography` 0.5.16
- **shadcn/ui** (Radix-Primitive) — vollständige Komponenten-Suite
- **lucide-react** 0.462.0 — Icons
- **sonner** 1.7.4 / **`vaul`** 0.9.9 / **`cmdk`** 1.1.1 / **`embla-carousel-react`** 8.6.0
- **next-themes** 0.3.0
- **`recharts`** 2.15.4

### Formulare & Validierung
- **react-hook-form** 7.61.1, **@hookform/resolvers** 3.10.0, **zod** 3.25.76
- **input-otp** 1.4.2, **react-day-picker** 8.10.1, **date-fns** 3.6.0

### Dokumente / Export
- **jspdf** 4.0.0 (PDF-Erzeugung)
- **docx** 9.6.1 + **file-saver** 2.0.5 (DOCX-Export)
- **react-markdown** 10.1.0

### Test
- **vitest** 3.2.4, **jsdom** 20.0.3
- **@testing-library/react** 16, **@testing-library/jest-dom** 6.6.0

---

## 2. Verzeichnisstruktur (top-level relevant)

```
.
├── doc/                    # Phasenpläne, Status-Reports (DE)
├── docs/                   # Snapshots & Restore-Punkte
│   ├── SNAPSHOT-2026-06-04/
│   └── SNAPSHOT-2026-06-07/   ← DIESER SNAPSHOT
├── public/                 # Statische HTML-Handouts, Therapie-MP3s, robots.txt
│   └── therapie/{raucherentwoehnung, reizdarm, schilddruese}/
├── scripts/                # Python-Build-Scripts (Hypnose-MP3, PDF-Generator)
├── src/
│   ├── App.tsx             # Routing-Root (33 Routen)
│   ├── main.tsx, index.css # Entry, Tailwind, Design-Tokens
│   ├── components/
│   │   ├── admin/          # 16 Admin-Komponenten + therapy/
│   │   ├── anamnese/       # 29 Anamnese-Sektionen + shared/
│   │   ├── home/           # Hero, Features, Info, WelcomeSelection
│   │   ├── hypnose/        # HypnoseAudioPlayer
│   │   ├── iaa/            # IAAForm
│   │   ├── layout/         # Header, Footer, Layout, InfothekDropdown
│   │   ├── seo/            # SEOHead, SchemaOrg
│   │   └── ui/             # shadcn/ui-Primitive
│   ├── contexts/           # AuthContext, LanguageContext
│   ├── hooks/              # useAdminCheck, useAnamneseEnabled, useAnamnesePublic,
│   │                       # usePatientLoginEnabled, useContentProtection, use-toast,
│   │                       # use-mobile
│   ├── integrations/supabase/  # client.ts, types.ts  (AUTOGENERIERT — nicht editieren)
│   ├── lib/                # Domain-Logik (siehe LOC-Tabelle)
│   ├── pages/              # 33 Pages
│   └── test/               # 18 Test-Dateien
├── supabase/
│   ├── config.toml         # verify_jwt-Konfiguration pro Function
│   ├── functions/          # 16 Edge Functions + _shared/smtp.ts
│   └── migrations/         # 32 SQL-Migrationen
├── package.json, vite.config.ts, tailwind.config.ts, tsconfig*.json
├── eslint.config.js, postcss.config.js, components.json
└── index.html
```

### LOC-Highlights (Stand 2026-06-07)
| Datei | Zeilen |
|---|---|
| `src/components/admin/TherapyRecommendation.tsx` | 2.405 |
| `src/lib/pdfExportEnhanced.ts` | 1.417 |
| `supabase/functions/therapy-recommend/index.ts` | 1.387 |
| `src/components/admin/MannayanPriceManager.tsx` | 775 |
| `src/components/admin/KnowledgeBaseManager.tsx` | 742 |
| `supabase/functions/submit-anamnesis/index.ts` | 700 |
| `src/lib/anamneseFormData.ts` | 619 |
| `supabase/functions/resend-submission/index.ts` | 573 |
| Frontend + Edge gesamt | **~27.000** |

---

## 3. Konfigurationsdateien

### `vite.config.ts` (HARDENED — Phase 1 Fix)
- Lädt Env via `loadEnv(mode, process.cwd(), "")`
- **Fallback-Konstanten** für `FALLBACK_SUPABASE_URL`, `FALLBACK_SUPABASE_PUBLISHABLE_KEY` (segmentiert via `.join("")`), `FALLBACK_SUPABASE_PROJECT_ID`
- `define`-Block injiziert effektive Werte als `JSON.stringify(value)` — verhindert `JSON.stringify(undefined)` → `void 0` → White-Screen
- Server: Host `::`, Port `8080`, HMR Overlay aus
- Plugin: `react()` + im Dev-Mode `componentTagger()` (Lovable)
- Alias `@` → `./src`
- Regression-Test: `src/test/vite-supabase-define-fallback.test.ts` (5 grüne Tests)

### `supabase/config.toml`
- `project_id = "jmebqjadlpltnqawoipb"`
- Funktionsspezifisch `verify_jwt`:
  - **`false`** (Public-Endpoints): `request-verification-code`, `verify-code`, `submit-anamnesis`, `send-verification-email`
  - **`true`** (alle übrigen 12 Functions — siehe `03-edge-functions.md`)

### `tailwind.config.ts`
- shadcn/ui-Vollkonfiguration, semantische HSL-Tokens aus `index.css`
- Container, dark-mode `class`, plugins: `tailwindcss-animate`, `@tailwindcss/typography`

### `src/index.css` — Design-Tokens (HSL)
- **Background** `40 30% 97%` / **Foreground** `150 20% 15%`
- **Primary** Salbeigrün `145 25% 36%`
- **Secondary** Sand `35 35% 85%`
- **Accent** Terracotta `18 45% 55%`
- **Radius** `0.75rem`
- Custom Tokens: `sage-50..700`, `sand-50..300`, `terracotta`, `terracotta-light`
- Gradients: `--gradient-hero`, `--gradient-card`, `--gradient-accent`
- Shadows: `--shadow-soft`, `--shadow-card`, `--shadow-elevated`
- Fonts: Playfair Display (Headings) + Source Sans 3 (Body) via Google Fonts

### `index.html`
- `<html lang="de">`, vollständige SEO-Metas (OG, Geo-Tags Augsburg)
- Canonical `https://rauch-heilpraktiker.de/`

### `.env` (von Lovable Cloud bereitgestellt — NIE manuell editieren)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`

---

## 4. Routing (33 Routen in `src/App.tsx`)

### Öffentlich (ungeschützt)
| Route | Component | Zweck |
|---|---|---|
| `/` | `Index` | Startseite mit `WelcomeSelection` (3-Tier) |
| `/auth` | `Auth` | Login + Registrierung + 2FA |
| `/datenschutz` | `Datenschutz` | DSGVO-Aufklärung |
| `/impressum` | `Impressum` | § 5 TMG |
| `/heilpraktiker`, `/gebueh`, `/ernaehrung` | Info-Seiten | Praxisinfo |
| `/milch-unvertraeglichkeit`, `/milch-knochengesundheit`, `/rohmilch-mikrobiologie` | Themenseiten | Ernährung |
| `/frequenztherapie`, `/reizdarm`, `/knieschwellung` | Themenseiten | Therapie-Infos |
| `/faq`, `/praxis-info`, `/quellenhinweis` | CMS-getrieben | FAQ/Praxis/Quellen |
| `/patientenaufklaerung`, `/neupatient` | Patient-Info | Rechtliche Aufklärung |
| `/raucherentwoehnung`, `/schilddruese-hypnose`, `/reizdarm-hypnose` | Hypnose-Module | Audio + PDF |
| `/infothek` | `Infothek` | Wissensportal |
| `/anamnesebogen-demo` | `AnamneseDemo` | Test-Submission-Flow |
| `/app-uebersicht` | `AppUebersicht` | Sitemap-Übersicht |

### Geschützt durch `<AnamneseRouteGuard>`
- `/anamnesebogen` → prüft `useAnamneseEnabled()` + `useAnamnesePublic()`; Redirect wenn deaktiviert

### Geschützt durch `<ProtectedRoute>` (Auth-Pflicht)
- `/erstanmeldung` → `Erstanmeldung`
- `/patienten-bibliothek` → `PatientenBibliothek`

### Admin / Therapeut (Auth + `has_role('admin')` intern geprüft)
- `/admin` → `AdminDashboard` (alle Manager-Tabs)
- `/wissensdatenbank` → `Wissensdatenbank` (Admin-Wiki, dosiert)
- `/patienten` → `PatientenManager`
- `/dashboard` → `PatientDashboard` (auch für Patienten — Rolle-spezifische Ansicht)

### Catch-all
- `/*` → `NotFound`

---

## 5. Build-Pipeline

```bash
bun install           # Dependencies
bun run dev           # Vite Dev-Server Port 8080
bun run build         # Production Build → dist/
bun run build:dev     # Development-Mode Build
bun run preview       # dist/ servieren
bun run test          # vitest run (18 Test-Dateien)
bun run lint          # eslint .
```

- Edge Functions deployen **automatisch** beim Edit (Lovable Cloud)
- Migrationen werden via `supabase--migration`-Tool ausgeführt
- Hypnose-MP3s werden **build-time** mit Python-Skripten (`scripts/build-*-hypnose.py`) erzeugt und committed
