# 06 — Sicherheit, Auth-Matrix, Secrets, Test-Coverage

**Snapshot:** 2026-06-07 (Phase 1–5 abgeschlossen)

## 1. Auth-Matrix (Source: `src/lib/securityAccessMatrix.ts`)

| Ressource | Anonymous | Authenticated | Verified Patient | Admin |
|---|---|---|---|---|
| `/` (Startseite) | ✓ | ✓ | ✓ | ✓ |
| `/auth` | ✓ | ↻ (Redirect) | ↻ | ↻ |
| `/anamnesebogen` | ✓ wenn `anamnese_public` | ✓ wenn enabled | ✓ | ✓ |
| `/erstanmeldung` | ✗ → `/auth` | ✓ | ✓ | ✓ |
| `/patienten-bibliothek` | ✗ | ✗ (RLS) | ✓ | ✓ |
| `/dashboard` | ✗ | ✓ (eigene Daten) | ✓ | ✓ |
| `/admin` | UI ausgeblendet | UI ausgeblendet | UI ausgeblendet | ✓ |
| `/wissensdatenbank` | UI ausgeblendet, RLS denied | dito | dito | ✓ |
| Public-Edge-Functions | ✓ (App-Layer OTP) | ✓ | ✓ | ✓ |
| Admin-Edge-Functions | 401 | 403 | 403 | ✓ (Rate-Limit 60/min) |

Tests: `src/test/phase4-security-access-matrix.test.ts` (12 Tests, alle grün).

---

## 2. RLS-Policies (Logik-Zusammenfassung — Details in DB)

- **User-eigene Daten** (`profiles`, `anamnesis_submissions`, `iaa_submissions`): `auth.uid() = user_id`
- **Rollen-Check**: Via `has_role(_user_id, _role)`-SECURITY-DEFINER-Funktion (verhindert Rekursion)
- **Admin-only** (`admin_knowledge_base`, `audit_log` read, `therapy_sessions`): `has_role('admin', auth.uid())`
- **Verified-Patient** (`patient_resources`, `patient-library`-Bucket): `is_verified_patient(auth.uid())`
- **Public-CMS** (`faqs`, `practice_info`, `practice_pricing`): SELECT `is_published = true`
- **Public-Settings** (`app_settings`): SELECT anon, UPDATE Admin
- **Audit-Log**: INSERT nur via `insert_audit_log()`-Funktion (kein Direct-INSERT erlaubt)

Jede Tabelle hat in der gleichen Migration explizite `GRANT`-Statements (Memory: `public-schema-grants`).

---

## 3. Authentifizierungs-Flows

### 3.1 Standard-Login (mit 2FA)
```
/auth → signInWithPassword
  → AuthContext erkennt Session, prüft Admin-Role
  → if (!isAdmin) → request-verification-code(type='login')
  → User-OTP → verify-code → Session bestätigt
```

### 3.2 Registrierung
```
/auth → signUp
  → handle_new_user-Trigger (profiles + user_roles)
  → Confirm-Mail (send-verification-email)
  → Erst-Login mit 2FA
```

### 3.3 Anamnese-Submission-OTP
```
Submit → request-verification-code(type='submission')
  → User-OTP → submit-anamnesis(code) → verify-code intern → DB-Insert
```

### 3.4 Patienten-Verifikation
- Admin-getriggert via `notify-existing-patient`
- One-Click-Link setzt `is_verified_patient = true`

---

## 4. Edge-Function-Härtung (Phase 3 + 5)

| Maßnahme | Umsetzung |
|---|---|
| **CORS-Allowlist** | `naturheilpraxis-rauch.lovable.app`, `rauch-heilpraktiker.de`, `*.lovableproject.com`, localhost-Ports |
| **`verify_jwt = true`** | Alle 12 privilegierten Functions (siehe `config.toml`) |
| **Anon-Key-Reject** | `Bearer <anonKey>` wird explizit als unauthorisiert behandelt |
| **Service-Role nur intern** | User-Identität via User-JWT, danach Admin-Reads via Service-Role |
| **Logging-Hygiene** | Keine E-Mails, keine Codes, keine PHI — nur generische Events |
| **Rate-Limit** | In-Memory-Map, 60 req / 60 sec / User für alle Admin-Functions |
| **Secret-Policy** | Repo-Test blockt JWT-ähnliche Literale (Phase 3) |

Test-Coverage: `src/test/supabase-edge-function-jwt-policy.test.ts` (28 Tests).

---

## 5. Secrets (Lovable Cloud Vault / Edge-Function-Env)

| Secret | Verwendung | Gesetzt? |
|---|---|---|
| `SUPABASE_URL` | Edge Functions intern | ✓ (auto) |
| `SUPABASE_ANON_KEY` | User-JWT-Validation | ✓ (auto) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin-Operationen | ✓ (Vault) |
| `RELAY_SECRET` | PHP-Mail-Relay X-Relay-Token (`998a476a-cf1c-…`) | ✓ |
| `LOVABLE_API_KEY` | Lovable AI Gateway (Gemini/GPT) | ✓ (auto) |
| `ELEVENLABS_API_KEY` | Reserviert (Edge-TTS Standard) | optional |

**Keine Secrets im Frontend-Code oder Repo.** Anon-Key in `vite.config.ts` ist segmentiert (Phase-3-Secret-Policy-konform).

---

## 6. Frontend-Sicherheits-Komponenten

- **`AuthContext`** — zentrale Session-Verwaltung, `onAuthStateChange`-Listener
- **`ProtectedRoute`** — Redirect auf `/auth`
- **`AnamneseRouteGuard`** — Feature-Flag + Public-Toggle
- **`useAdminCheck`** — RPC `has_role('admin')`, gecached
- **`devAdminBypass.ts`** — leerer Stub (Phase 3 entfernt `x-dev-mode`-Header)
- **`useContentProtection`** — lädt `public/content-protection.js` (Right-Click-Disable für Wiki/Infothek)

Memory: `content-protection-policy` — Access-Gates bevorzugt vor UI-Blocking.

---

## 7. Test-Suite (18 Dateien, alle grün — Stand 2026-06-07)

| Datei | Tests | Zweck |
|---|---|---|
| `supabase-edge-function-jwt-policy.test.ts` | 28 | Alle Edge-Functions verify_jwt-konform |
| `phase4-security-access-matrix.test.ts` | 12 | Auth-Matrix konsistent zur Spec |
| `vite-supabase-define-fallback.test.ts` | 5 | Vite-Define-Fallback ohne `void 0` |
| `repository-secret-policy.test.ts` | 2 | Keine JWT-Literale im Repo |
| `dev-admin-bypass-security.test.ts` | — | Kein Header-Bypass mehr aktiv |
| `app-startpage-smoke.test.tsx` | — | Startseite rendert |
| `app-public-routes-smoke.test.tsx` | — | Public-Routen rendern |
| `protected-route-smoke.test.tsx` | — | ProtectedRoute redirected |
| `sensitive-route-guard-smoke.test.tsx` | — | AnamneseRouteGuard greift |
| `anamnese-route-guard-smoke.test.tsx` | — | Routing-Guard-Verhalten |
| `anamnesebogen-public-route-characterization.test.tsx` | — | Public-Anamnese-Route konsistent |
| `anamnesebogen-public-submission-safety-characterization.test.tsx` | — | Submission-Sicherheit |
| `anamnese-public-toggle-copy.test.tsx` | — | Toggle-Texte verifiziert |
| `header-anamnese-navigation-smoke.test.tsx` | — | Header-Link-Sichtbarkeit |
| `public-anamnese-link-surfaces-characterization.test.tsx` | — | Link-Surfaces |
| `appSmokeTestUtils.tsx` | (Helper) | Test-Utilities |
| `setup.ts` | (Setup) | jsdom + jest-dom |
| `example.test.ts` | — | Baseline |

Run: `bun run test` → vitest run → erwartet alle grün.

---

## 8. DSGVO / Compliance (Memory-konsistent)

- **10-Jahres-Aufbewahrung** (Berufsordnung Heilpraktiker)
- **§ 126a BGB** digitale Signatur (qualifizierte digitale Form)
- **HWG/UWG-konforme Sprache** ("kann unterstützen", "Heilpraktiker oder Arzt")
- **Split-Transmission** (Anamnese vs. IAA → unterschiedliche Postfächer)
- **AI-Training-Opt-out** für Gesundheitsdaten (Lovable DPA — Memory: `dsgvo-lovable-audit-results`)
- **Keine PHI im Console-Log** (verifiziert in Phase-3-Logging-Hygiene)
- **NLS-Befund-Disclosure** auf Patient-PDF (Memory)
- **Mandatory-Aufklärungs-Checkbox** vor Submission (Pricing, Therapie-Methoden)
