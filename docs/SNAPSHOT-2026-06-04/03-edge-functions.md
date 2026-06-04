# 03 — Edge Functions (16 + 1 shared)

**Snapshot:** 2026-06-04 · Runtime: Deno (Supabase Hosted)

## Shared Module

### `_shared/smtp.ts`
Zentrales E-Mail-Versand-Modul. Sendet via PHP-Relay v3.6 (`POST https://rauch-heilpraktiker.de/mail-relay.php`) mit `X-Relay-Token` (Secret `RELAY_SECRET`). Unterstützt HTML-Body + Anhänge (Base64). Kein direkter SMTP von Edge-Function — Relay löst Port-587-Blockaden in Deno Deploy.

---

## Funktions-Katalog

### Auth / 2FA

#### `request-verification-code` (verify_jwt=false)
- **Trigger:** Frontend `/auth` bei Login oder Registrierung
- **Input:** `{ email, type: 'login'|'signup'|'submission' }`
- **Flow:**
  1. Hybrid-Auth: User-JWT (wenn vorhanden) + Service-Role
  2. Generiert 6-stelligen Code
  3. INSERT in `verification_codes` (expires_at = now()+10min)
  4. Sendet Mail via `_shared/smtp.ts`
- **Bypass:** Admins (`has_role`) erhalten Code automatisch ohne 2FA-Pflicht (siehe Memory)

#### `verify-code` (verify_jwt=false)
- **Input:** `{ email, code, type }`
- **Flow:** SELECT auf `verification_codes` (used=false, expires_at>now), markiert als used, returned `{ valid: true }`

#### `send-verification-email` (verify_jwt=false)
- Legacy/Alt-Variante des Verification-Mailers. Wird teilweise direkt aus dem Frontend gerufen.

---

### Anamnese

#### `submit-anamnesis` (verify_jwt=false)
- **Trigger:** Anamnesebogen-Submit nach OTP-Verifikation
- **Input:** `{ user_id, form_data, signature_data, pdf_base64 }`
- **Flow:**
  1. INSERT in `anamnesis_submissions` (Service-Role)
  2. PDF-Upload nach `anamnesis-pdfs/<user_id>/<id>.pdf`
  3. Split-Transmission Mail:
     - **Anamnese-Teil** → `anamnese@art-of-therapy.de`
     - **IAA-Teil** → `iaa@art-of-therapy.de` (separat, falls Section XXIV ausgefüllt)
  4. Patient erhält Bestätigung
- **Payload-Limit:** 4 MB (PDF synchron im Bucket gespeichert)

#### `resend-submission` (verify_jwt=false)
- Admin-only. Sendet bestehende Anamnese erneut.

---

### ICD-10 / Diagnosen

#### `generate-icd10` (verify_jwt=false)
- **Input:** `anamnesis_submission_id`
- **Flow:** Hybrid (Fixed-Mapping aus `icd10Mapping.ts` + Gemini-Pro-AI-Analyse für komplexe Fälle)
- **Output:** Strukturierte ICD-10-Liste + Begründung

#### `send-icd10-report` (verify_jwt=false)
- Versendet ICD-10-PDF an `iaa@art-of-therapy.de`

#### `generate-diagnoses` (default config)
- Erweiterte Diagnose-Empfehlung (Gemini), nutzt admin_knowledge_base als Context

---

### Therapie-Empfehlungen (Admin-Tool)

#### `therapy-recommend` (verify_jwt=false)
- **Input:** `{ pathogens[], patient_context, existing_remedies[], preferred_remedies[], boost_categories[], lab_image_url? }`
- **Flow:**
  1. Holt passende Einträge aus `admin_knowledge_base` (Boost via `boost_categories`, Vollsuche immer auf gesamter DB)
  2. Pinnt explizit `preferred_remedies` und Produktlinien (z.B. Vitaplace)
  3. Gemini-2.5-Pro generiert Therapieplan (kostengünstige Mittel priorisiert)
  4. Speichert in `therapy_sessions` (pseudonymisiert)
- **Output:** Markdown-formatiertes Rezept + Notiz
- **Memory-Regeln:**
  - HWG/UWG-konform ("kann unterstützen")
  - Latinische Pathogen-Nomenklatur
  - Kritische Bewertung bestehender Patientenmittel
  - NLS-Befund-Disclosure in Patienten-PDF wenn Pathogene > 0

#### `get-therapy-sessions` (verify_jwt=false)
- Admin: Holt alle Sessions zu einem `pseudonym_id` (Verlauf)

#### `list-therapy-pseudonyms` (default)
- Admin: Listet alle vorhandenen Pseudonyme

#### `extract-lab-image` (default)
- Gemini-Vision: Extrahiert strukturierte Labordaten aus hochgeladenem Bild

---

### Patienten-Verwaltung

#### `get-patients` (verify_jwt=false)
- Admin-only. Hybrid-Auth. Liefert vollständige Patientenliste mit Statistiken (Submissions-Count, letzte IAA, Verifikationsstatus).

#### `notify-existing-patient` (default)
- Manuelle Verifikations-Mail an Bestandspatienten (Admin-Trigger)

---

### Wissensdatenbank (Admin-Wiki)

#### `enrich-wiki-tags` (default)
- Gemini-Flash: Schlägt Tags für einen Wiki-Eintrag basierend auf Inhalt vor (Bulk-Operation möglich)

---

### TTS / Hypnose

#### `elevenlabs-tts` (default)
- Optional. ElevenLabs API für hochwertige TTS.
- **WICHTIG (Memory):** Standard für Hypnose-Module ist **Edge-TTS Florian -50% / ±0 Hz**, NICHT ElevenLabs. Diese Function existiert als Fallback/Alternative, wird in aktuellen Hypnose-Seiten aber nicht verwendet.

---

## Hybrid-Auth-Pattern

Funktionen mit `verify_jwt=false` implementieren intern:
```ts
const userJwt = req.headers.get('Authorization');
const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: userJwt }}});
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// User-Identität bestätigen via userClient.auth.getUser()
// Privilegierte Writes mit adminClient
```

Vorteile:
- Anonyme Endpoints (Verification, Registrierung) möglich
- Admin-Aktionen mit Service-Role möglich
- User-Context erhalten für RLS-konforme Reads

## Secrets (in Supabase Vault)

| Secret | Verwendung |
|--------|------------|
| `RELAY_SECRET` | PHP-Mail-Relay Auth (`998a476a-cf1c-7443-ea47-3e329d70e934`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role für Admin-Operationen |
| `LOVABLE_API_KEY` | Lovable AI Gateway (Gemini, GPT) |
| `ELEVENLABS_API_KEY` | (optional, falls TTS-Fallback aktiv) |
