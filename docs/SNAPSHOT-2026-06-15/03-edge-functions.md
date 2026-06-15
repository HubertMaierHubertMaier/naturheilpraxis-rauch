# 03 — Edge Functions

**Quelle der Wahrheit:** `supabase/functions/<name>/index.ts` + `supabase/config.toml`.

19 produktive Functions + `_shared/smtp.ts` (Helper).

| Function | Zweck | verify_jwt | Wichtige Secrets |
|---|---|---|---|
| `analyze-documents` | OCR + PII-Scrub für Labor/Befund-Uploads (multi-pass, chunked) | true (Admin) | LOVABLE_API_KEY |
| `check-hp-therapy` | **NEU** — KI-Sinnhaftigkeits-Check für HP-Therapie + Apotheker-Rezept + Zusatz-Therapie | true (Admin) | LOVABLE_API_KEY |
| `elevenlabs-tts` | TTS für Hypnose-Audios | true (Verified) | ELEVENLABS_API_KEY |
| `enrich-wiki-tags` | Auto-Tagging der Wiki-Einträge via Gemini | true (Admin) | LOVABLE_API_KEY |
| `extract-lab-image` | Labor-Foto → strukturierter Text | true (Admin) | LOVABLE_API_KEY |
| `generate-diagnoses` | ICD-10-Vorschläge aus Anamnese | true | LOVABLE_API_KEY |
| `generate-icd10` | Hybrid: feste Mappings + Gemini | true | LOVABLE_API_KEY |
| `get-patients` | Patient-Liste für Admin (mit Rate-Limit, JWT-Hardening) | true (Admin) | SUPABASE_SERVICE_ROLE_KEY |
| `get-therapy-sessions` | Therapie-Historie (Slim-Mode, RPC-basiert) | true (Admin) | SUPABASE_SERVICE_ROLE_KEY |
| `list-therapy-pseudonyms` | Pseudonym-Suche | true (Admin) | SUPABASE_SERVICE_ROLE_KEY |
| `notify-existing-patient` | E-Mail an Bestandspatienten | true (Admin) | SMTP_*, RELAY_SECRET |
| `request-verification-code` | 2FA-Code-Erzeugung + Versand | false (öffentlich für Login) | SMTP_*, RELAY_SECRET |
| `resend-submission` | Anamnese erneut per Mail senden | true (Admin) | SMTP_*, RELAY_SECRET |
| `send-icd10-report` | Auto-PDF + Mail an `iaa@art-of-therapy.de` | true | SMTP_*, RELAY_SECRET |
| `send-verification-email` | Welcome-Mail mit OTP | false (Signup) | SMTP_*, RELAY_SECRET |
| `submit-anamnesis` | Anamnese-Upload + Bucket-Save + Split-Mail-Routing | true | SMTP_*, RELAY_SECRET, SERVICE_ROLE |
| `therapy-recommend` | KI-Therapieempfehlung mit Wiki-Boost | true (Admin) | LOVABLE_API_KEY, SERVICE_ROLE |
| `verify-code` | 2FA-Code-Prüfung | false (Login-Flow) | SERVICE_ROLE |

## `config.toml`

Liegt unter `supabase/config.toml` — definiert `verify_jwt` pro Function. **Niemals manuell editieren** außer für `verify_jwt`-Flag.

## Standard-Patterns

- **Hybrid Auth**: User-JWT lesen → `has_role(uid, 'admin')` über RPC prüfen → bei OK Service-Role-Client für DB.
- **RPC-Stripping**: Resource-heavy Functions (`get-therapy-sessions`) nutzen `get_therapy_sessions_safe_list` statt direktem `SELECT *`.
- **PII-Scrubbing**: `analyze-documents` entfernt Namen/Adressen/Geburtsdaten vor LLM-Call.
- **Logging-Hygiene**: KEIN Health-Data-Console-Log. Nur Metadaten (Längen, IDs).
- **CORS**: alle Functions whitelisten `https://*.lovable.app` + Custom Domain.
