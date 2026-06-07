# 03 — Edge Functions (16 Stück)

**Snapshot:** 2026-06-07 · Härtungsstand: Phase 3 + Phase 5 abgeschlossen

Auth-Modelle:
- **Public** (`verify_jwt = false`): Endpoint ohne JWT erreichbar. Eigene App-Layer-Validierung (OTP, Captcha-equivalent via Honeypot/Rate-Limit).
- **JWT** (`verify_jwt = true`): Supabase prüft JWT, Function liest User aus Token; Service-Role nur intern für privilegierte Reads.
- **Hybrid**: User-JWT prüft Identität, danach Service-Role für privilegierte DB-Operationen (siehe Memory `edge-function-auth-context`).

CORS-Allowlist (Phase 3): `naturheilpraxis-rauch.lovable.app`, `rauch-heilpraktiker.de`, `www.rauch-heilpraktiker.de`, `*.lovableproject.com`, localhost (5173/4173/5174/4174).

Rate-Limit (Phase 5): In-Memory-Map `Map<key, {count, resetAt}>`, 60 Anfragen / 60 Sek pro User-ID.

---

## Übersicht

| # | Function | `verify_jwt` | Zweck | Rate-Limit | LOC |
|---|---|---|---|---|---|
| 1 | `request-verification-code` | false | 2FA-OTP erzeugen + per Mail-Relay senden | (App-Layer) | 317 |
| 2 | `verify-code` | false | OTP einlösen, Session validieren | (App-Layer) | 324 |
| 3 | `send-verification-email` | false | Legacy-Verification (E-Mail-Confirm) | — | 170 |
| 4 | `submit-anamnesis` | false | Anamnese annehmen, PDF generieren, Mail | — | 700 |
| 5 | `resend-submission` | true | Admin-Resend einer früheren Submission | ✓ | 573 |
| 6 | `generate-icd10` | true | ICD-10-Codes via Gemini Pro generieren | ✓ | 401 |
| 7 | `send-icd10-report` | true | ICD-10-Report-PDF + Mail an `iaa@…` | ✓ | 227 |
| 8 | `generate-diagnoses` | true | Differentialdiagnosen via Gemini Pro | ✓ | 284 |
| 9 | `get-patients` | true | Admin-Patientenliste | ✓ | 197 |
| 10 | `notify-existing-patient` | true | Manuelle Patientenfreischaltungs-Mail | ✓ | 210 |
| 11 | `therapy-recommend` | true | KI-Therapieempfehlung (Wiki + Gemini Pro) | ✓ | 1.387 |
| 12 | `get-therapy-sessions` | true | Pseudonymisierte Session-Historie | ✓ | 157 |
| 13 | `list-therapy-pseudonyms` | true | Liste aller Pseudonyme | ✓ | 195 |
| 14 | `extract-lab-image` | true | OCR/Vision für Laborbild via Gemini Vision | ✓ | 194 |
| 15 | `enrich-wiki-tags` | true | Auto-Tagging der Wiki-Einträge via Gemini Flash | ✓ | 334 |
| 16 | `elevenlabs-tts` | true | (Reserviert / nicht aktiv) ElevenLabs-TTS | ✓ | 169 |

---

## Detail-Spezifikationen

### 1. `request-verification-code` (Public)
- **Input:** `{ email, type: 'login'|'signup'|'submission' }`
- **Flow:** Generiert 6-stelligen Code, schreibt `verification_codes`-Row (`expires_at = now() + 10min`), schickt via `_shared/smtp.ts` an PHP-Relay → User-Mail.
- **Schutz:** Honeypot-Feld, App-Layer-Rate-Limit (in DB-Zeit-Window).
- **Logging:** Nur generische "code sent" — KEIN E-Mail- oder Code-Klartext.

### 2. `verify-code` (Public)
- **Input:** `{ email, code, type }`
- **Flow:** Suche unbenutzten Code mit `expires_at > now()`, markiere `used = true`, liefere bei Erfolg User-Daten + (für Login) Session-Token.
- **Schutz:** Code-Brute-Force durch DB-Index + Code-Verfall.

### 3. `send-verification-email` (Public, Legacy)
- E-Mail-Verifikation für Confirm-Flow (Standard-Supabase-Auth).
- Logging-Hygiene Phase 3 angewandt.

### 4. `submit-anamnesis` (Public — OTP-gated)
- **Input:** Vollständiger `form_data`-JSON, `signature_data` (Base64-PNG), `verification_code`
- **Flow:**
  1. Verifiziert OTP (`type = 'submission'`)
  2. Schreibt Row in `anamnesis_submissions`
  3. Erzeugt PDFs (Anamnese-Bogen + ggf. IAA-Bogen) **inline in Deno** mit jsPDF-Logik
  4. Lädt PDF in `anamnesis-pdfs`-Bucket
  5. Split-Transmission: Sections I–XXIII, XXV → `anamnese@art-of-therapy.de`; Section XXIV → `iaa@art-of-therapy.de`
  6. Bestätigungs-Mail an Patient
- **4-MB-Payload-Grenze** (Edge-Function-Limit) — `signature_data` als komprimiertes PNG

### 5. `resend-submission` (Admin)
- Re-sendet bereits eingegangene Submission (z.B. nach Mail-Bounce); regeneriert PDF, schickt erneut.

### 6. `generate-icd10` (Admin)
- **Hybrid-Mapping:** Erst feste Lookup-Tabelle (`src/lib/icd10Mapping.ts` Spiegelung), dann Gemini-2.5-Pro für unbekannte Beschwerden.
- Output: Array von ICD-10-Codes mit Konfidenz.

### 7. `send-icd10-report` (Admin)
- Generiert PDF-Report, schickt an `iaa@art-of-therapy.de`.

### 8. `generate-diagnoses` (Admin)
- Differentialdiagnose-Vorschläge via Gemini Pro mit Sicherheitshinweisen.

### 9. `get-patients` (Admin)
- Service-Role-Lookup aller Patienten + Status (verifiziert/unverifiziert).
- Phase-5-Rate-Limit aktiv (siehe `doc/20260607-phase-5-get-patients-rate-limit-hardening.md`).

### 10. `notify-existing-patient` (Admin)
- Sendet manuelle Freischaltungs-Mail mit Verifikations-Link.

### 11. `therapy-recommend` (Admin) — größtes Modul (1.387 LOC)
- **Input:** Patientendaten (pseudonymisiert), Pathogene, Beschwerden, Wiki-Ordner-Boost (Memory: `therapy-knowledge-search-boost`)
- **Flow:**
  1. Wiki-Suche über `admin_knowledge_base` (immer ganze DB, Ordner als Boost)
  2. Bevorzugte Mittel (Memory: `admin-therapy-preferred-remedies` — Vitaplace etc.)
  3. Gemini-2.5-Pro mit Wiki-Kontext → Therapieplan
  4. Sicherheits-Checks (Kontraindikationen, HWG/UWG-konforme Sprache)
  5. Speichert in `therapy_sessions` (Pseudonym-basiert)
- Output: Strukturierter Plan + Rezept-Druckansicht

### 12. `get-therapy-sessions` (Admin) — Phase-5-Hardening
- Liest `therapy_sessions` für gegebenes `pseudonym_id` (Admin-only).
- **Auth:** Lehnt `Bearer <anon-key>` explizit ab → 401; prüft `has_role('admin')` → sonst 403.
- **Rate-Limit:** `get-therapy-sessions:admin:<user_id>`, 60/min.

### 13. `list-therapy-pseudonyms` (Admin)
- Alle Pseudonyme + Metadaten.

### 14. `extract-lab-image` (Admin)
- Bild-Upload → Gemini-2.5-Vision (`gemini-2.5-pro` mit Vision) → strukturierte Laborwerte.

### 15. `enrich-wiki-tags` (Admin)
- Batch-Tagging der Wiki-Einträge via `gemini-2.5-flash`.

### 16. `elevenlabs-tts` (Reserviert)
- ElevenLabs-API-Wrapper, **aktuell nicht im UI verlinkt**. Standard-TTS sind statische Edge-TTS-MP3s (siehe `07-assets-and-pdfs.md`).

---

## `_shared/smtp.ts`

- POST an `https://rauch-heilpraktiker.de/mail-relay.php`
- Header: `X-Relay-Token: <RELAY_SECRET>`, `Content-Type: application/json`
- Body: `{ to, subject, body_html, body_text, attachments?, from_account: 'anamnese'|'iaa'|'noreply' }`
- Relay-Logik in PHP: SMTP-Auth Port 587 STARTTLS pro Recipient-Konto, CRLF-Line-Endings, Fallback PHP `mail()`.

---

## Härtung (Phase 3+5) — gemeinsame Patterns

```ts
// CORS Allowlist
function isAllowedCorsOrigin(origin: string | null): boolean { /* siehe oben */ }

// Anti-Anon-Key-Auth
if (!authHeader?.startsWith("Bearer ") || authHeader === `Bearer ${anonKey}`) return 401;

// User extrahieren
const userClient = createClient(supabaseUrl, anonKey);
const { data: { user } } = await userClient.auth.getUser(token);

// Admin-Check via Service-Role
const adminClient = createClient(supabaseUrl, serviceKey);
const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
if (!isAdmin) return 403;

// Rate-Limit
if (!checkRateLimit(`<fn>:admin:${user.id}`)) return 429;

// Logging-Hygiene: nie PHI, nie E-Mail-Klartext, nur generische Meldungen
console.warn("[<fn>] <event>");
```

Regressions-Tests:
- `src/test/supabase-edge-function-jwt-policy.test.ts` (28 Tests)
- `src/test/phase4-security-access-matrix.test.ts` (12 Tests)
- `src/test/repository-secret-policy.test.ts` (2 Tests)
