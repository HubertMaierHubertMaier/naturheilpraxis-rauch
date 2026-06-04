# Projekt-Snapshot Naturheilpraxis Peter Rauch

**Snapshot-Datum:** 2026-06-04
**Git-Commit:** `5448b511d44b74e29bb211107fec8651807ba884` ("Markdown-Renderer ergänzt")
**Branch:** `main` (clean, in Sync mit `origin/main` und GitHub `reddy67/naturheilpraxis-rauch`)
**Zweck:** Verbindlicher 1:1-Referenzpunkt vor größeren Umbauten. Jede Datei, jede Route, jede Tabelle, jede Edge Function, jeder Workflow ist hier dokumentiert oder direkt im Git verifizierbar.

---

## Wiederherstellungs-Strategie

Es gibt **drei voneinander unabhängige Wiederherstellungs-Quellen**:

1. **Git (Primärquelle)** — Vollständiger Code-Stand auf `5448b51`.
   - Lovable-intern: `git.private.lovable-gcp.code.storage/2a361a45-…`
   - GitHub-Spiegel: `https://github.com/reddy67/naturheilpraxis-rauch.git` (privat)
   - Wiederherstellen via Lovable Version History oder `git checkout 5448b51`.

2. **Lovable Cloud (Backend)** — Datenbank, Auth, Storage, Edge Functions, Secrets.
   - Supabase-Projekt-Ref: `jmebqjadlpltnqawoipb`
   - Region: EU
   - Schema-Stand siehe `02-database.md`

3. **Diese Snapshot-Dokumentation** (`docs/SNAPSHOT-2026-06-04/`) — Menschlich lesbare Beschreibung aller Workflows und Architektur-Entscheidungen für den Fall, dass Code rekonstruiert werden muss.

---

## Inhalt dieses Snapshots

| Datei | Inhalt |
|------|--------|
| `00-README.md` | Dieses Dokument (Übersicht & Wiederherstellung) |
| `01-architecture.md` | Tech-Stack, Verzeichnisstruktur, Konfigurationsdateien, Routing |
| `02-database.md` | Komplettes DB-Schema, Enums, Funktionen, RLS-Policies, Storage-Buckets |
| `03-edge-functions.md` | Alle 16 Edge Functions: Zweck, Auth-Modell, Input/Output, Abhängigkeiten |
| `04-frontend-features.md` | Alle Pages, Admin-Bereich, Anamnese-Workflow, Patient-Workflow |
| `05-workflows.md` | Schritt-für-Schritt-Workflows (Registrierung, Anamnese, 2FA, Therapie, Hypnose, Mail) |
| `06-secrets-and-integrations.md` | Secrets, externe Dienste (Lovable AI, ElevenLabs, Edge-TTS, PHP-Relay) |
| `07-assets-and-pdfs.md` | Alle statischen Assets, PDF-Generatoren, Hypnose-MP3s, Begleitskripte |

---

## Schnell-Fakten

- **Frontend:** React 18 + Vite 5 + TypeScript 5 + Tailwind 3 + shadcn/ui
- **Backend:** Lovable Cloud (Supabase) — PostgreSQL, Auth, Storage, 16 Edge Functions (Deno)
- **Mail:** PHP-Relay v3.6 auf `rauch-heilpraktiker.de`, Port 587 STARTTLS, X-Relay-Token-Auth
- **AI:** Lovable AI Gateway (Gemini 2.5 Flash/Pro), optional ElevenLabs für TTS (Standard: Edge-TTS Florian -50%)
- **2FA:** Pflicht für Login/Registrierung (Admin-Bypass via `has_role`), 6-stelliger OTP via Mail-Relay
- **Routen:** 33 Routen (siehe `01-architecture.md`)
- **DB-Tabellen:** 15 (siehe `02-database.md`)
- **Edge Functions:** 16 (siehe `03-edge-functions.md`)
- **LOC Frontend:** ~13.843 Zeilen in `src/lib/*.ts` + `src/pages/*.tsx`
- **Compliance:** DSGVO-konform (10y Retention, AI-Training-Opt-out, §126a BGB digitale Signatur, HWG/UWG-konforme Sprache)

---

## Wiederherstellung in 3 Schritten

```bash
# 1. Code zurücksetzen
git checkout 5448b511d44b74e29bb211107fec8651807ba884

# 2. Dependencies
bun install

# 3. .env (wird von Lovable Cloud automatisch bereitgestellt)
# VITE_SUPABASE_URL=https://jmebqjadlpltnqawoipb.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIs...
# VITE_SUPABASE_PROJECT_ID=jmebqjadlpltnqawoipb
```

Backend-Wiederherstellung ist über Lovable Cloud automatisch; die SQL-Schemata in `02-database.md` sind als Referenz dokumentiert, der **wirkliche Stand lebt in der Supabase-Instanz**.

---

## Verbindliche Standards (Memory-gestützt)

- **TTS-Hypnose:** Edge-TTS `de-DE-FlorianMultilingualNeural`, Rate `-50%`, Pitch `±0 Hz` — NIE abweichen.
- **Hypnose-Wortlaut:** Bei jeder Hypnose `Selbsthypnose-Skript-Wortlaut.pdf` als Download anbieten.
- **Heilpraktiker-Sprache:** "Heilpraktiker oder Arzt" gleichrangig; "ärztlich" nur bei echtem Arztvorbehalt.
- **Dosierungen:** Public Infothek dosierungsfrei, Admin-Wiki mit exakten Dosierungen.
- **Datenschutz:** Keine Gesundheitsdaten ins Console-Log. 10 Jahre Aufbewahrung. Split-Transmission (Anamnese vs. IAA).
- **Scope-Disziplin:** Vom User freigegebene Inhalte/Settings nie eigenmächtig ändern.
