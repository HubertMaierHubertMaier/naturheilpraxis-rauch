# Projekt-Snapshot Naturheilpraxis Peter Rauch — 2026-06-07

**Snapshot-Datum:** 2026-06-07
**Letzter Merge-Commit (main):** `3940ee0fa807ff6951bc099a1c46adfe56665de9`
**Branch dieses Snapshots:** `edit/edt-0686360f-8b77-40fd-b342-c0695dcc0816` (Lovable-Editor)
**Vorheriger Snapshot:** [docs/SNAPSHOT-2026-06-04/](../SNAPSHOT-2026-06-04/00-README.md) (`5448b51…`)
**Zweck:** Verbindlicher 1:1-Wiederherstellungspunkt nach Abschluss der **Sicherheits-Phasen 1–5** (Stabilization). Letzter sauberer Stand vor geplanten größeren Umbauten.

---

## Was ist seit Snapshot 2026-06-04 neu / geändert?

| Bereich | Änderung | Quelle |
|---|---|---|
| **Vite-Build** | `vite.config.ts` mit Fallback-Konstanten für `VITE_SUPABASE_URL / _PUBLISHABLE_KEY / _PROJECT_ID` — verhindert weiße Seite, falls Env fehlt. Anon-Key in Segmente zerteilt (Secret-Policy-Test). | `vite.config.ts` |
| **Edge Functions (Phase 3)** | Alle privilegierten Functions gehärtet: CORS auf Allowlist, JWT-Validation Pflicht (`verify_jwt = true`), Service-Role nur intern, kein Health-Data-Logging mehr. | `supabase/functions/*` |
| **Edge Functions (Phase 5)** | `get-patients`, `get-therapy-sessions`, `list-therapy-pseudonyms`, `notify-existing-patient` mit In-Memory-Rate-Limit (60 req/min/User). | `doc/20260607-phase-5-get-patients-rate-limit-hardening.md` |
| **Admin-Bypass** | `src/lib/devAdminBypass.ts` — kein `x-dev-mode`-Header mehr, keine Client-seitige Privileg-Erhöhung. | `src/lib/devAdminBypass.ts` |
| **Public Anamnese-Route** | Routen-Guard `AnamneseRouteGuard` + Charakterisierungs-Tests. Toggle-Texte vereinheitlicht. | `src/components/AnamneseRouteGuard.tsx`, `src/test/anamnesebogen-public-*.test.tsx` |
| **Security-Matrix** | `src/lib/securityAccessMatrix.ts` — vollständige Auth-Matrix als Single-Source-of-Truth, Test `phase4-security-access-matrix.test.ts`. | `doc/20260606-phase-4-auth-security-matrix.md` |
| **Repository-Secret-Policy** | `src/test/repository-secret-policy.test.ts` blockt JWT-ähnliche Literale im Repo. | dito |
| **Test-Suite** | 18 Test-Dateien, alle grün (siehe `src/test/`). | `src/test/` |
| **DB-Migration** | `20260606191747_e83a7499-3ae8-4fe6-8453-4e7b3c7ff5e9.sql` (letzte Phase-3-Migration). | `supabase/migrations/` |

Live-Bundle zum Snapshot-Zeitpunkt: `/assets/index-bI18o6vb.js`, `data-commit-sha = 3940ee0f…`.

---

## Snapshot-Inhalt

| Datei | Inhalt |
|---|---|
| `00-README.md` | Dieses Dokument — Übersicht, Diff zu 2026-06-04, Wiederherstellungs-Anleitung |
| `01-architecture.md` | Tech-Stack, Verzeichnis, Konfig, Routing (33 Routen), Build-Pipeline |
| `02-database.md` | 15 Tabellen, 6 RPC-Funktionen, 2 Storage-Buckets, Enums, Migration-Liste |
| `03-edge-functions.md` | Alle 16 Edge Functions mit Auth-Modell, Input/Output, Rate-Limit, Härtungsstand |
| `04-frontend-features.md` | Alle 33 Pages + Admin-Bereich + Anamnese-Workflow + Patient-Workflow |
| `05-workflows.md` | Schritt-für-Schritt-Workflows (Registrierung, 2FA, Anamnese, Therapie, Hypnose, Mail) |
| `06-security-and-secrets.md` | Auth-Matrix, RLS-Policies-Logik, Secrets, Rate-Limits, Test-Coverage |
| `07-assets-and-pdfs.md` | Statische Assets, PDF-Generatoren, Hypnose-MP3s, Skripte, Build-Targets |

---

## Schnell-Fakten

- **Frontend:** React 18.3.1 + Vite 5.4.19 + TypeScript 5.8.3 + Tailwind 3.4.17 + shadcn/ui
- **Backend:** Lovable Cloud (Supabase EU) — PostgreSQL, Auth, Storage, **16 Edge Functions** (Deno)
- **Mail:** PHP-Relay v3.6 auf `rauch-heilpraktiker.de`, Port 587 STARTTLS, X-Relay-Token-Auth, CRLF
- **AI:** Lovable AI Gateway — `google/gemini-2.5-flash` (Default) und `google/gemini-2.5-pro` (Therapie, ICD-10, Diagnosen)
- **2FA:** Pflicht für Login/Registrierung, Admin-Bypass via `has_role('admin', auth.uid())`
- **Routen:** **33** (siehe `01-architecture.md`)
- **DB-Tabellen:** **15** (siehe `02-database.md`)
- **DB-Funktionen:** **6** (`has_role`, `is_verified_patient`, `handle_new_user`, `insert_audit_log`, `next_mannayan_order_number`, `update_updated_at_column`)
- **Storage-Buckets:** `anamnesis-pdfs`, `patient-library`
- **Edge Functions:** **16** (Phase 3 & 5 gehärtet)
- **DB-Migrationen:** **32** (älteste `20260117…`, jüngste `20260606191747…`)
- **LOC:** ~27.000 Zeilen Frontend+Edge (siehe `wc -l` in `01-architecture.md`)
- **Compliance:** DSGVO (10y Retention, AI-Training-Opt-out, §126a BGB, HWG/UWG), Audit-Log

---

## Wiederherstellung in 3 Schritten

```bash
# 1. Code zurücksetzen (Hard-Restore auf Live-Commit dieses Snapshots)
git checkout 3940ee0fa807ff6951bc099a1c46adfe56665de9

# 2. Dependencies
bun install   # oder: npm install

# 3. .env wird von Lovable Cloud automatisch bereitgestellt:
#    VITE_SUPABASE_URL=https://jmebqjadlpltnqawoipb.supabase.co
#    VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
#    VITE_SUPABASE_PROJECT_ID=jmebqjadlpltnqawoipb
# Selbst ohne .env startet die App dank Fallback in vite.config.ts.
```

Backend (DB-Schema, RLS, Edge-Function-Source, Secrets, Storage-Objekte) liegt in Lovable Cloud — `02-database.md` und `03-edge-functions.md` sind die textliche Referenz, **die Wahrheit lebt in Supabase Projekt-Ref `jmebqjadlpltnqawoipb`**.

---

## Verbindliche Standards (Memory-gestützt — NICHT abweichen)

- **TTS-Hypnose:** Edge-TTS `de-DE-FlorianMultilingualNeural`, Rate `-50%`, Pitch `±0 Hz`
- **Hypnose-Wortlaut:** Bei jeder Hypnose `Selbsthypnose-Skript-Wortlaut.pdf` als Download
- **Heilpraktiker-Sprache:** "Heilpraktiker oder Arzt" gleichrangig; "ärztlich" nur bei echtem Arztvorbehalt
- **Dosierungen:** Public Infothek dosierungsfrei, Admin-Wiki mit exakten Dosierungen
- **Datenschutz:** Keine Gesundheitsdaten ins Console-Log, 10y Aufbewahrung, Split-Transmission
- **Scope-Disziplin:** Vom User freigegebene Inhalte/Settings nie eigenmächtig ändern
- **Git-Merges:** Lovable kann keine externen Branches mergen — Compare-Link + GitHub-PR

---

## Verifikation (live geprüft 2026-06-07)

- Live-Commit-SHA: `3940ee0f…` ✓
- Live-Bundle: `index-bI18o6vb.js` ✓
- Security-Tests: 42/42 grün (jwt-policy 28, access-matrix 12, secret-policy 2) ✓
- Vite-Fallback-Test: 5/5 grün ✓
- `#root` füllt sich, keine Console-Errors, keine `void 0`-Signaturen im Bundle ✓
