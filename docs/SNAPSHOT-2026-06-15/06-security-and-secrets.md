# 06 — Security & Secrets

## Supabase Secrets (NAMEN, niemals Werte!)

Diese 15 Secrets müssen nach Restore manuell gesetzt werden:

| Secret | Quelle | Zweck |
|---|---|---|
| `LOVABLE_API_KEY` | auto durch Lovable Cloud | AI Gateway (Gemini) |
| `SUPABASE_URL` | auto | Edge Functions |
| `SUPABASE_ANON_KEY` | auto | Edge Functions |
| `SUPABASE_PUBLISHABLE_KEY` | auto | Frontend |
| `SUPABASE_PUBLISHABLE_KEYS` | auto | Edge Functions |
| `SUPABASE_SECRET_KEYS` | auto | Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | auto (auf Lovable Cloud NICHT abrufbar!) | Edge Functions admin ops |
| `SUPABASE_JWKS` | auto | JWT-Verifikation |
| `SUPABASE_DB_URL` | auto | Direkter DB-Zugriff |
| `SMTP_HOST` | manuell aus Passwort-Manager | PHP-Relay |
| `SMTP_PORT` | `587` | PHP-Relay |
| `SMTP_USER` | manuell | PHP-Relay |
| `SMTP_PASSWORD` | manuell | PHP-Relay |
| `RELAY_SECRET` | manuell (selbst generiert) | PHP-Relay-Auth |
| `ELEVENLABS_API_KEY` | aus ElevenLabs-Dashboard | TTS Premium |

## RLS-Matrix (Kurzform)

| Tabelle | anon | authenticated | verified_patient | admin |
|---|---|---|---|---|
| `admin_knowledge_base` | ❌ | ❌ | ❌ | RW |
| `anamnesis_submissions` | ❌ | RW own | RW own | RW all |
| `app_settings` | R public-keys | R public-keys | R public-keys | RW |
| `audit_log` | ❌ | R own | R own | R all |
| `faqs` | R published | R published | R published | RW |
| `iaa_submissions` | ❌ | RW own | RW own | RW all |
| `mannayan_*` | ❌ | ❌ | ❌ | RW |
| `patient_resources` | ❌ | ❌ | R published | RW |
| `patient_snapshot` | ❌ | ❌ | ❌ | RPC-only |
| `practice_info` | R published | R published | R published | RW |
| `practice_pricing` | R published | R published | R published | RW |
| `profiles` | ❌ | RW own | RW own | RW all |
| `therapy_sessions` | ❌ | ❌ | ❌ | RPC-only |
| `user_roles` | ❌ | R own | R own | RW |
| `verification_codes` | ❌ | ❌ | ❌ | Service-Role only |

## Sicherheits-Highlights

- **2FA Mandatory** für Login (außer Admin-Bypass via `useAdminCheck` Frontend + serverseitig durch RPC validiert)
- **HIBP Password Check** bei Registrierung (Supabase Auth Setting)
- **NO console.log** für Health-Data (DSGVO) — durchgesetzt in allen Edge Functions
- **PII-Scrubbing** in `analyze-documents` vor LLM-Call (Namen, Adressen, Geburtsdaten, Versicherungsnummern)
- **Pseudonymisierung** in `therapy_sessions` — niemals Klarname, nur `pseudonym_id`
- **Patient-Mismatch-Trigger** `prevent_therapy_session_patient_mismatch` blockiert versehentliche Vermischung
- **Audit-Log** über `insert_audit_log()` (SECURITY DEFINER) — alle sensiblen Aktionen
- **§ 126a BGB** konforme digitale Signatur (Canvas + Hash + Timestamp + IP)
- **Lovable DPA** mit explizitem AI-Training-Opt-out für Health Data
- **10-Jahres-Aufbewahrung** für medizinische Daten (DSGVO + Heilberufe-Vorschriften)
- **PHP-Relay** mit `RELAY_SECRET` HMAC-Auth, CRLF-Endings, Fallback `mail()`

## Test- und Admin-Accounts

Pre-konfigurierte Accounts: siehe `mem://auth/test-and-admin-accounts` (Lovable-Memory).
**Niemals** in dieses Doc übernehmen!
