# 06 — Secrets & externe Integrationen

**Snapshot:** 2026-06-04

## 1. Secrets (Supabase Vault / Edge Function Env)

| Secret | Wert / Hinweis | Verwendung |
|--------|----------------|------------|
| `SUPABASE_URL` | `https://jmebqjadlpltnqawoipb.supabase.co` | Edge Functions intern |
| `SUPABASE_ANON_KEY` | (siehe `.env`) | Edge Functions User-Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Vault | Privilegierte Admin-Operationen |
| `RELAY_SECRET` | `998a476a-cf1c-7443-ea47-3e329d70e934` | PHP-Mail-Relay `X-Relay-Token` |
| `LOVABLE_API_KEY` | Vault (auto) | Lovable AI Gateway (Gemini/GPT) |
| `ELEVENLABS_API_KEY` | Vault (optional) | Fallback-TTS (Standard: Edge-TTS) |

**Wichtig:** Keine Secrets im Code oder im Frontend. Alle Frontend-Anfragen an AI/Mail laufen über Edge Functions.

---

## 2. Externe Dienste

### 2.1 Lovable AI Gateway
- **Endpoint:** Lovable-managed (kein eigener API-Key nötig im Frontend)
- **Genutzte Modelle:**
  - `google/gemini-2.5-flash` — Standard für `enrich-wiki-tags`, einfache Klassifikation
  - `google/gemini-2.5-pro` — Therapie-Empfehlung, ICD-10-Generierung, Diagnosen
  - `google/gemini-2.5-flash-image` — (optional, nicht aktiv genutzt)
- Aufruf via `LOVABLE_API_KEY` aus Edge Functions
- Memory-Hinweis: `dsgvo-lovable-audit-results` — explizites AI-Training-Opt-out für Gesundheitsdaten

### 2.2 PHP-Mail-Relay
- **Host:** `https://rauch-heilpraktiker.de/mail-relay.php`
- **Version:** v3.6 (SMTP-Auth) — Quellcode `docs/mail-relay-v3-smtp.php`
- **Port:** 587 (STARTTLS)
- **Authentifizierung:** Per-Recipient SMTP-Auth (separate Credentials pro Mail-Konto)
- **Line-Endings:** CRLF (kritisch — sonst Postfix-Reject)
- **Fallback:** PHP `mail()` wenn SMTP nicht erreichbar
- **Token:** `X-Relay-Token` Header gegen `RELAY_SECRET`
- **Empfänger-Konten:**
  - `anamnese@art-of-therapy.de` — Anamnese-PDFs (Sections I-XXIII, XXV)
  - `iaa@art-of-therapy.de` — IAA-Sections (XXIV) + ICD-10-Reports
  - Patient-E-Mail — Bestätigungsmails, OTP-Codes

### 2.3 Edge-TTS (Microsoft Cognitive Services)
- **VERBINDLICHER Standard für alle Hypnose-Module**
- Voice: `de-DE-FlorianMultilingualNeural`
- Rate: `-50%`
- Pitch: `±0 Hz`
- Aufruf via Python-Scripts (`scripts/build-*-hypnose.py`) zur **Build-Zeit**, MP3s werden statisch in `public/therapie/<thema>/` ausgeliefert (keine Runtime-TTS-Kosten)

### 2.4 ElevenLabs (optional/Fallback)
- Edge Function `elevenlabs-tts` existiert, wird aktuell **nicht in den Hypnose-Modulen verwendet**
- Reserviert für zukünftige Use-Cases

### 2.5 GitHub
- **Repo:** `https://github.com/reddy67/naturheilpraxis-rauch.git` (privat)
- Bidirektionaler Sync mit Lovable
- Backup-Optionen: Local Clone, ZIP-Download

---

## 3. Hosting / Deployment

### Frontend
- **Preview:** `https://id-preview--2a361a45-233a-4659-a3f4-a2f1dda0e86d.lovable.app`
- **Production:** `https://naturheilpraxis-rauch.lovable.app`
- **Custom Domain:** (keine aktiv — Memory: Linux Root Server Ziel)
- Build: Vite Static, deploybar auf jedem Linux-Server (Portability-Anforderung gem. Memory)

### Backend
- Lovable Cloud (managed Supabase, EU-Region)
- Edge Functions: Auto-Deploy bei Lovable-Edit
- DB-Migrationen: Über Lovable Migration-Tool

### Mail-Relay
- Eigener Server `rauch-heilpraktiker.de` (Apache + PHP)
- Aktualisierung: PHP-File via FTP/SFTP ersetzen
- Source-of-Truth: `docs/mail-relay-v3-smtp.php`
