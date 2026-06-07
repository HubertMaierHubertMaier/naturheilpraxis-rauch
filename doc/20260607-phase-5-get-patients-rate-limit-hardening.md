# Phase 5 – get-patients Rate-Limit- und Logging-Härtung

## Zeitpunkt

2026-06-07 07:55 CEST

## Ausgangsbasis

- Branch: `stabilization/phase-5-critical-edge-functions`
- Startbasis: verifiziertes `origin/main` `83275de35bf920ba469335fc624ae67543b7cdc3`
- Scope: erster lokaler Phase-5-Microstep für kritische Edge Functions
- Kein Push, kein PR, kein Merge, keine Lovable-Live-Änderung

## Ziel

Die admin-only Edge Function `get-patients` liefert eine sensible Patientenliste. Sie war bereits durch Supabase `verify_jwt`, `auth.getUser`, `has_role` und request-aware CORS geschützt. Dieser Microstep ergänzt eine lokale per-admin Rate-Limit-Schranke vor den patientenbezogenen Datenbankabfragen und entfernt rohes Error-Objekt-Logging aus der Catch-Behandlung.

## Geänderte Dateien

- `supabase/functions/get-patients/index.ts`
- `src/test/supabase-edge-function-jwt-policy.test.ts`
- `src/lib/securityAccessMatrix.ts`
- `doc/20260607-phase-5-get-patients-rate-limit-hardening.md`

## RED/GREEN-Evidence

### RED

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis vor Produktcode-Änderung:

- Exit 1
- 7 Tests ausgeführt
- 2 Tests fehlgeschlagen:
  - `keeps get-patients admin patient-list access behind local per-admin rate limiting`
  - `does not log raw Error objects in get-patients patient-list handling`

Erwarteter Grund:

- `get-patients` hatte noch kein lokales `rateLimitMap`/`checkRateLimit`/HTTP-429-Pattern.
- `get-patients` loggte im Catch-Block ein rohes `error`-Objekt.

### GREEN

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis nach minimaler Änderung:

- Exit 0
- 1 Test File passed
- 7 Tests passed

Zusätzlich fokussierte Regression:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/phase4-security-access-matrix.test.ts src/test/repository-secret-policy.test.ts
```

Ergebnis:

- Exit 0
- 3 Test Files passed
- 21 Tests passed

## Implementierungsnotizen

- Das Rate Limit ist lokal/in-memory und pro Admin-User-ID keyed:
  `get-patients:admin:${adminUserId}`
- Der Rate-Limit-Check erfolgt erst nach erfolgreichem Admin-Nachweis und vor dem Laden von `profiles`, `audit_log` und `anamnesis_submissions`.
- Bei Überschreitung wird HTTP 429 mit generischer Fehlermeldung zurückgegeben.
- Die Konsole loggt bei Fehlern nur noch generische Ereignisse, keine rohen Error-Objekte.
- `src/lib/securityAccessMatrix.ts` dokumentiert den neuen Rate-Limit-Status für `get-patients`.

## DSGVO-/Patientendaten-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine Live-Supabase-Function aufgerufen.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Secrets ausgegeben oder persistiert.
- Tests lesen lokale Source-Dateien statisch.

## Backup

Pre-Phase-ShadowCopy:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260607-0752_pre-phase-5-critical-edge-functions`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260607-0752_pre-phase-5-critical-edge-functions/SHADOWCOPY_MANIFEST.md`

## Nächste Gates

Ausgeführt nach der Implementierung:

```sh
npm test
```

Ergebnis:

- Exit 0
- 16 Test Files passed
- 55 Tests passed

```sh
npx tsc --noEmit
```

Ergebnis:

- Exit 0

```sh
npm run build
```

Ergebnis:

- Exit 0
- 3309 modules transformed
- built in 4.82s
- bekannter Chunk-size-Hinweis, kein Build-Fehler

```sh
git diff --check
```

Ergebnis:

- Exit 0

```sh
npx eslint src/test/supabase-edge-function-jwt-policy.test.ts src/lib/securityAccessMatrix.ts supabase/functions/get-patients/index.ts
```

Ergebnis:

- Exit 0
- Keine Lint-Fehler in den geänderten Code-/Test-Dateien

```sh
npm run lint
```

Ergebnis:

- Exit 1
- Bekannte bestehende Lint-Baseline bleibt rot
- Aktueller Baseline-Stand nach diesem Microstep: 322 problems, 290 errors, 32 warnings
- Keine Treffer für die geänderten Dateien im Full-Lint-Output
- Gegenüber dem ersten Full-Lint-Lauf in diesem Microstep wurde die geänderte Datei `supabase/functions/get-patients/index.ts` von bestehenden `any`-Lintfehlern bereinigt; dadurch keine neue Lint-Schuld.

---

# Phase 5 – therapy-recommend Rate-Limit-Härtung

## Zeitpunkt

2026-06-07 08:06 CEST

## Ziel

Die admin-only Edge Function `therapy-recommend` kann kosten- und sensitives gesundheitsbezogenes KI-Processing auslösen. Sie war bereits durch Supabase `verify_jwt`, `auth.getUser`, `has_role` und request-aware CORS geschützt. Dieser Microstep ergänzt eine lokale per-admin Rate-Limit-Schranke nach erfolgreichem Admin-Nachweis und vor Request-Body-Parsing sowie vor AI-Provider-Aufrufen.

## Geänderte Dateien in diesem Microstep

- `supabase/functions/therapy-recommend/index.ts`
- `src/test/supabase-edge-function-jwt-policy.test.ts`
- `src/lib/securityAccessMatrix.ts`
- `doc/20260607-phase-5-get-patients-rate-limit-hardening.md`

## RED/GREEN-Evidence

### RED

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis vor Produktcode-Änderung:

- Exit 1
- 8 Tests ausgeführt
- 1 Test fehlgeschlagen:
  - `keeps therapy-recommend admin AI calls behind local per-admin rate limiting before body parsing`

Erwarteter Grund:

- `therapy-recommend` hatte noch kein lokales `rateLimitMap`/`RATE_LIMIT_WINDOW_MS`/`checkRateLimit`/HTTP-429-Pattern.
- Der neue Test verlangt zusätzlich, dass der Rate-Limit-Check vor `await req.json()` und vor dem primären AI-Gateway-Call liegt.

### GREEN

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis nach minimaler Änderung:

- Exit 0
- 1 Test File passed
- 8 Tests passed

Fokussierte Regression:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/phase4-security-access-matrix.test.ts src/test/repository-secret-policy.test.ts
```

Ergebnis:

- Exit 0
- 3 Test Files passed
- 22 Tests passed

## Implementierungsnotizen

- Das Rate Limit ist lokal/in-memory und pro Admin-User-ID keyed:
  `therapy-recommend:admin:${user.id}`
- Der Rate-Limit-Check erfolgt nach erfolgreichem `has_role`-Admin-Nachweis.
- Der Rate-Limit-Check erfolgt vor `await req.json()` und vor dem primären AI-Gateway-Call.
- Bei Überschreitung wird HTTP 429 mit generischer Fehlermeldung zurückgegeben.
- Die Security-Matrix dokumentiert den neuen Rate-Limit-Status für `therapy-recommend`.
- Bei der fokussierten Lint-Prüfung wurden bestehende Lint-Schulden in `therapy-recommend` bereinigt, soweit sie in der geänderten Datei auffielen.

## DSGVO-/Patientendaten-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine Live-Supabase-Function aufgerufen.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine AI-/Lovable-Gateway-Live-Calls ausgelöst.
- Keine Secrets ausgegeben oder persistiert.
- Tests lesen lokale Source-Dateien statisch.

## Gates nach diesem Microstep

```sh
npx eslint src/test/supabase-edge-function-jwt-policy.test.ts src/lib/securityAccessMatrix.ts supabase/functions/therapy-recommend/index.ts
```

Ergebnis:

- Exit 0

```sh
npm test
```

Ergebnis:

- Exit 0
- 16 Test Files passed
- 56 Tests passed

```sh
npx tsc --noEmit
```

Ergebnis:

- Exit 0

```sh
npm run build
```

Ergebnis:

- Exit 0
- 3309 modules transformed
- built in 4.75s
- bekannter Chunk-size-Hinweis, kein Build-Fehler

```sh
git diff --check
```

Ergebnis:

- Exit 0

```sh
npm run lint
```

Ergebnis:

- Exit 1
- Bekannte bestehende Lint-Baseline bleibt rot
- Aktueller Baseline-Stand nach diesem Microstep: 319 problems, 287 errors, 32 warnings
- Keine Treffer für die geänderten Dateien im Full-Lint-Output

## Build-Bundle-Regression gegen alten Supabase-void-0-Fehler

Nach `npm run build` geprüft:

- `createClient(void 0=false`
- `createClient(void 0,void 0=false`
- `VITE_SUPABASE_URL void-0 probe=false`
- `VITE_SUPABASE_ANON_KEY void-0 probe=false`

## Remote-/Live-Gate

- Kein Push.
- Kein PR.
- Kein Merge.
- Keine Lovable-Live-Änderung.

---

# Phase 5 – get-therapy-sessions Rate-Limit- und Logging-Härtung

## Zeitpunkt

2026-06-07 08:14 CEST

## Ziel

Die admin-only Edge Function `get-therapy-sessions` liest sensible therapiesitzungsbezogene Daten aus `therapy_sessions`. Sie war bereits durch Supabase `verify_jwt`, `auth.getUser`, `has_role` und request-aware CORS geschützt. Dieser Microstep ergänzt eine lokale per-admin Rate-Limit-Schranke nach erfolgreichem Admin-Nachweis und vor Request-Body-Parsing sowie vor der `therapy_sessions`-Query. Zusätzlich wurde rohes Error-Objekt-Logging aus der Catch-Behandlung entfernt.

## Geänderte Dateien in diesem Microstep

- `supabase/functions/get-therapy-sessions/index.ts`
- `src/test/supabase-edge-function-jwt-policy.test.ts`
- `src/lib/securityAccessMatrix.ts`
- `doc/20260607-phase-5-get-patients-rate-limit-hardening.md`

## RED/GREEN-Evidence

### RED

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis vor Produktcode-Änderung:

- Exit 1
- 10 Tests ausgeführt
- 2 Tests fehlgeschlagen:
  - `keeps get-therapy-sessions admin session access behind local per-admin rate limiting before session queries`
  - `does not log raw Error objects in get-therapy-sessions session handling`

Erwarteter Grund:

- `get-therapy-sessions` hatte noch kein lokales `rateLimitMap`/`RATE_LIMIT_WINDOW_MS`/`checkRateLimit`/HTTP-429-Pattern.
- `get-therapy-sessions` nutzte noch `catch (error: any)` und loggte ein rohes Error-Objekt.

### GREEN

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis nach minimaler Änderung:

- Exit 0
- 1 Test File passed
- 10 Tests passed

Fokussierte Regression:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/phase4-security-access-matrix.test.ts src/test/repository-secret-policy.test.ts
```

Ergebnis:

- Exit 0
- 3 Test Files passed
- 24 Tests passed

## Implementierungsnotizen

- Das Rate Limit ist lokal/in-memory und pro Admin-User-ID keyed:
  `get-therapy-sessions:admin:${user.id}`
- Der Rate-Limit-Check erfolgt nach erfolgreichem `has_role`-Admin-Nachweis.
- Der Rate-Limit-Check erfolgt vor `await req.json()` und vor der `therapy_sessions`-Query.
- Bei Überschreitung wird HTTP 429 mit generischer Fehlermeldung zurückgegeben.
- Die Catch-Behandlung verwendet `unknown` statt `any`.
- Die Konsole loggt nur noch einen stabilen, nicht-identifizierenden Fehler-Marker.
- Die Security-Matrix dokumentiert den neuen Rate-Limit-Status für `get-therapy-sessions`.

## DSGVO-/Patientendaten-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten Therapiesitzungsdaten verwendet.
- Keine Live-Supabase-Function aufgerufen.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Secrets ausgegeben oder persistiert.
- Tests lesen lokale Source-Dateien statisch.

## Gates nach diesem Microstep

```sh
npx eslint src/test/supabase-edge-function-jwt-policy.test.ts src/lib/securityAccessMatrix.ts supabase/functions/get-therapy-sessions/index.ts
```

Ergebnis:

- Exit 0

```sh
npm test
```

Ergebnis:

- Exit 0
- 16 Test Files passed
- 58 Tests passed

```sh
npx tsc --noEmit
```

Ergebnis:

- Exit 0

```sh
npm run build
```

Ergebnis:

- Exit 0
- 3309 modules transformed
- built in 4.75s
- bekannter Chunk-size-Hinweis, kein Build-Fehler

```sh
git diff --check
```

Ergebnis:

- Exit 0

```sh
npm run lint
```

Ergebnis:

- Exit 1
- Bekannte bestehende Lint-Baseline bleibt rot
- Aktueller Baseline-Stand nach diesem Microstep: 318 problems, 286 errors, 32 warnings
- Keine Treffer für die geänderten Dateien im Full-Lint-Output

## Build-Bundle-Regression gegen alten Supabase-void-0-Fehler

Nach `npm run build` geprüft:

- `createClient(void 0=false`
- `createClient(void 0,void 0=false`
- `VITE_SUPABASE_URL void-0 probe=false`
- `VITE_SUPABASE_ANON_KEY void-0 probe=false`

## Remote-/Live-Gate

- Kein Push.
- Kein PR.
- Kein Merge.
- Keine Lovable-Live-Änderung.


---

# Phase 5 – generate-icd10 Rate-Limit-Härtung

## Zeitpunkt

2026-06-07 08:22 CEST

## Ziel

Die admin-only Edge Function `generate-icd10` verarbeitet sensible Anamnesedaten und kann zusätzlich kosten-/providerrelevante KI-ICD-10-Analyse auslösen. Sie war bereits durch Supabase `verify_jwt`, `auth.getUser`, `has_role` und request-aware CORS geschützt. Dieser Microstep ergänzt eine lokale per-admin Rate-Limit-Schranke nach erfolgreichem Admin-Nachweis und vor Request-Body-Parsing sowie vor AI-Provider-Aufrufen.

## Geänderte Dateien in diesem Microstep

- `supabase/functions/generate-icd10/index.ts`
- `src/test/supabase-edge-function-jwt-policy.test.ts`
- `src/lib/securityAccessMatrix.ts`
- `doc/20260607-phase-5-get-patients-rate-limit-hardening.md`

## RED/GREEN-Evidence

### RED

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis vor Produktcode-Änderung:

- Exit 1
- 12 Tests ausgeführt
- 2 Tests fehlgeschlagen:
  - `keeps generate-icd10 admin AI calls behind local per-admin rate limiting before body parsing and provider calls`
  - `does not log raw Error objects in generate-icd10 AI/admin handling`

Erwarteter Grund:

- `generate-icd10` hatte noch kein lokales `rateLimitMap`/`RATE_LIMIT_WINDOW_MS`/`checkRateLimit`/HTTP-429-Pattern.
- `generate-icd10` loggte in AI-/Admin-Catch-Pfaden noch rohe Error-Objekte.

### GREEN

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis nach minimaler Änderung:

- Exit 0
- 1 Test File passed
- 12 Tests passed

Fokussierte Regression:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/phase4-security-access-matrix.test.ts src/test/repository-secret-policy.test.ts
```

Ergebnis:

- Exit 0
- 3 Test Files passed
- 26 Tests passed

## Implementierungsnotizen

- Das Rate Limit ist lokal/in-memory und pro Admin-User-ID keyed:
  `generate-icd10:admin:${user.id}`
- Der Rate-Limit-Check erfolgt nach erfolgreichem `has_role`-Admin-Nachweis.
- Der Rate-Limit-Check erfolgt vor `await req.json()` und vor dem Lovable-AI-Gateway-Aufruf.
- Bei Überschreitung wird HTTP 429 mit generischer Fehlermeldung zurückgegeben.
- Rohes Error-Objekt-Logging wurde in den AI-/Admin-Catch-Pfaden durch stabile, nicht-identifizierende Fehler-Marker ersetzt.
- Beim berührten Helper-Code wurden explizite `any`-Typen durch lokale JSON-/AI-Item-Typen ersetzt, sodass fokussiertes ESLint für diese Dateien grün ist.
- Die Security-Matrix dokumentiert den neuen Rate-Limit-Status für `generate-icd10`.

## DSGVO-/Patientendaten-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine Live-Supabase-Function aufgerufen.
- Keine AI-/Provider-Live-Calls ausgeführt.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Secrets ausgegeben oder persistiert.
- Tests lesen lokale Source-Dateien statisch.

## Gates nach diesem Microstep

```sh
npx eslint src/test/supabase-edge-function-jwt-policy.test.ts src/lib/securityAccessMatrix.ts supabase/functions/generate-icd10/index.ts
```

Ergebnis:

- Exit 0

```sh
npm test
```

Ergebnis:

- Exit 0
- 16 Test Files passed
- 60 Tests passed

```sh
npx tsc --noEmit
```

Ergebnis:

- Exit 0

```sh
npm run build
```

Ergebnis:

- Exit 0
- 3309 modules transformed
- built in 4.84s
- bekannter Chunk-size-Hinweis, kein Build-Fehler

```sh
git diff --check
```

Ergebnis:

- Exit 0

```sh
npm run lint
```

Ergebnis:

- Exit 1
- Bekannte bestehende Lint-Baseline bleibt rot
- Aktueller Baseline-Stand nach diesem Microstep: 312 problems, 280 errors, 32 warnings
- Keine Treffer für die geänderten Dateien im Full-Lint-Output

## Build-Bundle-Regression gegen alten Supabase-void-0-Fehler

Nach `npm run build` geprüft:

- `createClient(void 0=false`
- `createClient(void 0,void 0=false`
- `VITE_SUPABASE_URL void-0 probe=false`
- `VITE_SUPABASE_ANON_KEY void-0 probe=false`

## Remote-/Live-Gate

- Kein Push.
- Kein PR.
- Kein Merge.
- Keine Lovable-Live-Änderung.


---

# Phase 5 – generate-diagnoses Rate-Limit-Härtung

## Zeitpunkt

2026-06-07 08:35 CEST

## Ziel

Die admin-only Edge Function `generate-diagnoses` verarbeitet sensible medizinische Patienteneingaben und kann kosten-/providerrelevante KI-Diagnose-Hypothesen auslösen. Sie war bereits durch Supabase `verify_jwt`, `auth.getUser`, service-role `user_roles`-Adminprüfung und request-aware CORS geschützt. Dieser Microstep ergänzt eine lokale per-admin Rate-Limit-Schranke nach erfolgreichem Admin-Nachweis und vor Request-Body-Parsing sowie vor AI-Provider-Aufrufen.

## Geänderte Dateien in diesem Microstep

- `supabase/functions/generate-diagnoses/index.ts`
- `src/test/supabase-edge-function-jwt-policy.test.ts`
- `src/lib/securityAccessMatrix.ts`
- `doc/20260607-phase-5-get-patients-rate-limit-hardening.md`

## RED/GREEN-Evidence

### RED

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis vor Produktcode-Änderung:

- Exit 1
- 14 Tests ausgeführt
- 2 Tests fehlgeschlagen:
  - `keeps generate-diagnoses admin AI calls behind local per-admin rate limiting before body parsing and provider calls`
  - `does not log or return raw Error objects in generate-diagnoses AI/admin handling`

Erwarteter Grund:

- `generate-diagnoses` hatte noch kein lokales `rateLimitMap`/`RATE_LIMIT_WINDOW_MS`/`checkRateLimit`/HTTP-429-Pattern.
- `generate-diagnoses` nutzte `catch (e: any)` und gab `e.message` als Fehlerantwort zurück.

### GREEN

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis nach minimaler Änderung:

- Exit 0
- 1 Test File passed
- 14 Tests passed

Fokussierte Regression:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/phase4-security-access-matrix.test.ts src/test/repository-secret-policy.test.ts
```

Ergebnis:

- Exit 0
- 3 Test Files passed
- 28 Tests passed

## Implementierungsnotizen

- Das Rate Limit ist lokal/in-memory und pro Admin-User-ID keyed:
  `generate-diagnoses:admin:${user.id}`
- Der Rate-Limit-Check erfolgt nach erfolgreichem service-role `user_roles`-Admin-Nachweis.
- Der Rate-Limit-Check erfolgt vor `await req.json()` und vor dem Lovable-AI-Gateway-Aufruf.
- Bei Überschreitung wird HTTP 429 mit generischer Fehlermeldung zurückgegeben.
- Die allgemeine Catch-Behandlung gibt nur noch eine generische Fehlermeldung zurück.
- AI-Gateway-Fehler werden nicht mehr als roher Provider-Response-Text an Clients zurückgegeben.
- Beim berührten Helper-/Parsing-Code wurden explizite `any`-Typen durch lokale Request-/AI-/Record-Typen und Guards ersetzt, sodass fokussiertes ESLint für diese Dateien grün ist.
- Die Security-Matrix dokumentiert den neuen Rate-Limit-Status für `generate-diagnoses`.

## DSGVO-/Patientendaten-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine Live-Supabase-Function aufgerufen.
- Keine AI-/Provider-Live-Calls ausgeführt.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Secrets ausgegeben oder persistiert.
- Tests lesen lokale Source-Dateien statisch.

## Gates nach diesem Microstep

```sh
npx eslint src/test/supabase-edge-function-jwt-policy.test.ts src/lib/securityAccessMatrix.ts supabase/functions/generate-diagnoses/index.ts
```

Ergebnis:

- Exit 0

```sh
npm test
```

Ergebnis:

- Exit 0
- 16 Test Files passed
- 62 Tests passed

```sh
npx tsc --noEmit
```

Ergebnis:

- Exit 0

```sh
npm run build
```

Ergebnis:

- Exit 0
- 3309 modules transformed
- built in 4.87s
- bekannter Chunk-size-Hinweis, kein Build-Fehler

```sh
git diff --check
```

Ergebnis:

- Exit 0

```sh
npm run lint
```

Ergebnis:

- Exit 1
- Bekannte bestehende Lint-Baseline bleibt rot
- Aktueller Baseline-Stand nach diesem Microstep: 310 problems, 278 errors, 32 warnings
- Keine Treffer für die geänderten Dateien im Full-Lint-Output

## Build-Bundle-Regression gegen alten Supabase-void-0-Fehler

Nach `npm run build` geprüft:

- `createClient(void 0=false`
- `createClient(void 0,void 0=false`
- `VITE_SUPABASE_URL void-0 probe=false`
- `VITE_SUPABASE_ANON_KEY void-0 probe=false`

## Remote-/Live-Gate

- Kein Push.
- Kein PR.
- Kein Merge.
- Keine Lovable-Live-Änderung.


---

# Phase 5 – extract-lab-image Rate-Limit-Härtung

## Zeitpunkt

2026-06-07 09:55 CEST

## Ziel

Die admin-only Edge Function `extract-lab-image` verarbeitet hochsensible Laborbild-/Arztbrief-Bilddaten und kann kosten-/providerrelevante Vision-AI-Aufrufe auslösen. Sie war bereits durch Supabase `verify_jwt`, `auth.getUser`, service-role `user_roles`-Adminprüfung und request-aware CORS geschützt. Dieser Microstep ergänzt eine lokale per-admin Rate-Limit-Schranke nach erfolgreichem Admin-Nachweis und vor Request-Body-Parsing sowie vor AI-Provider-Aufrufen.

## Geänderte Dateien in diesem Microstep

- `supabase/functions/extract-lab-image/index.ts`
- `src/test/supabase-edge-function-jwt-policy.test.ts`
- `src/lib/securityAccessMatrix.ts`
- `doc/20260607-phase-5-get-patients-rate-limit-hardening.md`

## RED/GREEN-Evidence

### RED

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis vor Produktcode-Änderung:

- Exit 1
- 16 Tests ausgeführt
- 2 Tests fehlgeschlagen:
  - `keeps extract-lab-image admin AI calls behind local per-admin rate limiting before body parsing and provider calls`
  - `does not log or return raw Error objects in extract-lab-image AI/admin handling`

Erwarteter Grund:

- `extract-lab-image` hatte noch kein lokales `rateLimitMap`/`RATE_LIMIT_WINDOW_MS`/`checkRateLimit`/HTTP-429-Pattern.
- `extract-lab-image` nutzte `catch (e: any)` und gab `e.message` als Fehlerantwort zurück.

### GREEN

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis nach minimaler Änderung:

- Exit 0
- 1 Test File passed
- 16 Tests passed

Fokussierte Regression:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/phase4-security-access-matrix.test.ts src/test/repository-secret-policy.test.ts
```

Ergebnis:

- Exit 0
- 3 Test Files passed
- 30 Tests passed

## Implementierungsnotizen

- Das Rate Limit ist lokal/in-memory und pro Admin-User-ID keyed:
  `extract-lab-image:admin:${user.id}`
- Der Rate-Limit-Check erfolgt nach erfolgreichem service-role `user_roles`-Admin-Nachweis.
- Der Rate-Limit-Check erfolgt vor `await req.json()` und vor dem Lovable-AI-Gateway-Aufruf.
- Bei Überschreitung wird HTTP 429 mit generischer Fehlermeldung zurückgegeben.
- Die allgemeine Catch-Behandlung gibt nur noch eine generische Fehlermeldung zurück.
- AI-Gateway-Fehler werden nicht mehr als roher Provider-Response-Text an Clients zurückgegeben.
- Beim berührten Helper-/Request-/AI-Code wurden explizite `any`-Typen durch lokale Request-/Content-/AI-Typen ersetzt, sodass fokussiertes ESLint für diese Dateien grün ist.
- Die Security-Matrix dokumentiert den neuen Rate-Limit-Status für `extract-lab-image`.

## DSGVO-/Patientendaten-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten Laborbilder oder Arztbriefbilder verwendet.
- Keine Live-Supabase-Function aufgerufen.
- Keine AI-/Provider-Live-Calls ausgeführt.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Secrets ausgegeben oder persistiert.
- Tests lesen lokale Source-Dateien statisch.

## Gates nach diesem Microstep

```sh
npx eslint src/test/supabase-edge-function-jwt-policy.test.ts src/lib/securityAccessMatrix.ts supabase/functions/extract-lab-image/index.ts
```

Ergebnis:

- Exit 0

```sh
npm test
```

Ergebnis:

- Exit 0
- 16 Test Files passed
- 64 Tests passed

```sh
npx tsc --noEmit
```

Ergebnis:

- Exit 0

```sh
npm run build
```

Ergebnis:

- Exit 0
- 3309 modules transformed
- built in 4.83s
- bekannter Chunk-size-Hinweis, kein Build-Fehler

```sh
git diff --check
```

Ergebnis:

- Exit 0

```sh
npm run lint
```

Ergebnis:

- Exit 1
- Bekannte bestehende Lint-Baseline bleibt rot
- Aktueller Baseline-Stand nach diesem Microstep: 308 problems, 276 errors, 32 warnings
- Keine Treffer für die geänderten Dateien im Full-Lint-Output

## Build-Bundle-Regression gegen alten Supabase-void-0-Fehler

Nach `npm run build` geprüft:

- `createClient(void 0=false`
- `createClient(void 0,void 0=false`
- `VITE_SUPABASE_URL void-0 probe=false`
- `VITE_SUPABASE_ANON_KEY void-0 probe=false`

## Remote-/Live-Gate

- Kein Push.
- Kein PR.
- Kein Merge.
- Keine Lovable-Live-Änderung.


---

# Phase 5 – enrich-wiki-tags Rate-Limit-Härtung

## Zeitpunkt

2026-06-07 10:20 CEST

## Ziel

Die admin-only Edge Function `enrich-wiki-tags` erzeugt AI-Tag-Vorschläge für interne Wissensdatenbankeinträge und kann kosten-/providerrelevante Lovable-AI-Gateway-Aufrufe auslösen. Sie war bereits durch Supabase `verify_jwt`, `auth.getUser`, service-role `user_roles`-Adminprüfung und request-aware CORS geschützt. Dieser Microstep ergänzt eine lokale per-admin Rate-Limit-Schranke nach erfolgreichem Admin-Nachweis und vor Request-Body-Parsing sowie vor AI-Enrichment-Aufrufen.

## Geänderte Dateien in diesem Microstep

- `supabase/functions/enrich-wiki-tags/index.ts`
- `src/test/supabase-edge-function-jwt-policy.test.ts`
- `src/lib/securityAccessMatrix.ts`
- `doc/20260607-phase-5-get-patients-rate-limit-hardening.md`

## RED/GREEN-Evidence

### RED

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis vor Produktcode-Änderung:

- Exit 1
- 18 Tests ausgeführt
- 2 Tests fehlgeschlagen:
  - `keeps enrich-wiki-tags admin AI calls behind local per-admin rate limiting before body parsing and AI enrichment`
  - `does not log or return raw Error objects in enrich-wiki-tags AI/admin handling`

Erwarteter Grund:

- `enrich-wiki-tags` hatte noch kein lokales `rateLimitMap`/`RATE_LIMIT_WINDOW_MS`/`checkRateLimit`/HTTP-429-Pattern.
- `enrich-wiki-tags` enthielt explizite `any`-Typen und gab raw Error-/Provider-Details in Ergebnis-/Fehlerpfaden zurück.

### GREEN

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis nach minimaler Änderung:

- Exit 0
- 1 Test File passed
- 18 Tests passed

Fokussierte Regression:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/phase4-security-access-matrix.test.ts src/test/repository-secret-policy.test.ts
```

Ergebnis:

- Exit 0
- 3 Test Files passed
- 32 Tests passed

## Implementierungsnotizen

- Das Rate Limit ist lokal/in-memory und pro Admin-User-ID keyed:
  `enrich-wiki-tags:admin:${userResult.user.id}`
- Der Rate-Limit-Check erfolgt nach erfolgreichem service-role `user_roles`-Admin-Nachweis.
- Der Rate-Limit-Check erfolgt vor `await req.json()` und vor `await callAI(...)` im Preview-Pfad.
- Bei Überschreitung wird HTTP 429 mit generischer Fehlermeldung zurückgegeben.
- Die allgemeine Catch-Behandlung gibt nur noch eine generische Fehlermeldung zurück.
- AI-Gateway-Fehler werden nicht mehr als roher Provider-Response-Text oder raw Error-Message an Clients zurückgegeben.
- Beim berührten Role-/Request-/KnowledgeBase-/AI-Code wurden explizite `any`-Typen durch lokale Typen und Guards ersetzt, sodass fokussiertes ESLint für diese Dateien grün ist.
- Die Security-Matrix dokumentiert den neuen Rate-Limit-Status für `enrich-wiki-tags`.

## DSGVO-/Patientendaten-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine Live-Supabase-Function aufgerufen.
- Keine AI-/Provider-Live-Calls ausgeführt.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Secrets ausgegeben oder persistiert.
- Tests lesen lokale Source-Dateien statisch.

## Gates nach diesem Microstep

```sh
npx eslint src/test/supabase-edge-function-jwt-policy.test.ts src/lib/securityAccessMatrix.ts supabase/functions/enrich-wiki-tags/index.ts
```

Ergebnis:

- Exit 0

```sh
npm test
```

Ergebnis:

- Exit 0
- 16 Test Files passed
- 66 Tests passed

```sh
npx tsc --noEmit
```

Ergebnis:

- Exit 0

```sh
npm run build
```

Ergebnis:

- Exit 0
- 3309 modules transformed
- built in 4.83s
- bekannter Chunk-size-Hinweis, kein Build-Fehler

```sh
git diff --check
```

Ergebnis:

- Exit 0

```sh
npm run lint
```

Ergebnis:

- Exit 1
- Bekannte bestehende Lint-Baseline bleibt rot
- Aktueller Baseline-Stand nach diesem Microstep: 306 problems, 274 errors, 32 warnings
- Keine Treffer für die geänderten Dateien im Full-Lint-Output

## Build-Bundle-Regression gegen alten Supabase-void-0-Fehler

Nach `npm run build` geprüft:

- `createClient(void 0=false`
- `createClient(void 0,void 0=false`
- `VITE_SUPABASE_URL void-0 probe=false`
- `VITE_SUPABASE_ANON_KEY void-0 probe=false`

## Remote-/Live-Gate

- Kein Push.
- Kein PR.
- Kein Merge.
- Keine Lovable-Live-Änderung.


---

# Phase 5 – list-therapy-pseudonyms Rate-Limit-Härtung

## Zeitpunkt

2026-06-07 10:27 CEST

## Ziel

Die admin-only Edge Function `list-therapy-pseudonyms` liest Therapie-Session-Daten, gruppiert diese nach Pseudonymen und liefert zusammenfassende sessionbezogene Informationen zurück. Sie war bereits durch Supabase `verify_jwt`, `auth.getUser`, `has_role`-Adminprüfung und request-aware CORS geschützt. Dieser Microstep ergänzt eine lokale per-admin Rate-Limit-Schranke nach erfolgreichem Admin-Nachweis und vor der sensiblen `therapy_sessions`-Abfrage.

## Geänderte Dateien in diesem Microstep

- `supabase/functions/list-therapy-pseudonyms/index.ts`
- `src/test/supabase-edge-function-jwt-policy.test.ts`
- `src/lib/securityAccessMatrix.ts`
- `doc/20260607-phase-5-get-patients-rate-limit-hardening.md`

## RED/GREEN-Evidence

### RED

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis vor Produktcode-Änderung:

- Exit 1
- 20 Tests ausgeführt
- 2 Tests fehlgeschlagen:
  - `keeps list-therapy-pseudonyms admin session-summary access behind local per-admin rate limiting before session queries`
  - `does not log or return raw Error objects in list-therapy-pseudonyms session-summary handling`

Erwarteter Grund:

- `list-therapy-pseudonyms` hatte noch kein lokales `rateLimitMap`/`RATE_LIMIT_WINDOW_MS`/`checkRateLimit`/HTTP-429-Pattern.
- `list-therapy-pseudonyms` enthielt explizite `any`-Typen, loggte raw Error-Objekte und gab raw Error-Messages an Clients zurück.

### GREEN

Befehl:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis nach minimaler Änderung:

- Exit 0
- 1 Test File passed
- 20 Tests passed

Fokussierte Regression:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/phase4-security-access-matrix.test.ts src/test/repository-secret-policy.test.ts
```

Ergebnis:

- Exit 0
- 3 Test Files passed
- 34 Tests passed

## Implementierungsnotizen

- Das Rate Limit ist lokal/in-memory und pro Admin-User-ID keyed:
  `list-therapy-pseudonyms:admin:${user.id}`
- Der Rate-Limit-Check erfolgt nach erfolgreichem `has_role`-Admin-Nachweis.
- Der Rate-Limit-Check erfolgt vor der `.from("therapy_sessions")`-Abfrage.
- Bei Überschreitung wird HTTP 429 mit generischer Fehlermeldung zurückgegeben.
- Die allgemeine Catch-Behandlung loggt nur noch eine stabile nicht-identifizierende Fehlermarkierung.
- Client-Fehlerantworten enthalten keine raw Error-Message mehr.
- Explizite `any`-Typen im berührten Function-Code wurden durch lokale Typen ersetzt.
- Die Security-Matrix dokumentiert den neuen Rate-Limit-Status für `list-therapy-pseudonyms`.

## DSGVO-/Patientendaten-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten Therapie-Session-Daten verwendet.
- Keine Live-Supabase-Function aufgerufen.
- Keine AI-/Provider-Live-Calls ausgeführt.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Secrets ausgegeben oder persistiert.
- Tests lesen lokale Source-Dateien statisch.

## Gates nach diesem Microstep

```sh
npx eslint src/test/supabase-edge-function-jwt-policy.test.ts src/lib/securityAccessMatrix.ts supabase/functions/list-therapy-pseudonyms/index.ts
```

Ergebnis:

- Exit 0

```sh
npm test
```

Ergebnis:

- Exit 0
- 16 Test Files passed
- 68 Tests passed

```sh
npx tsc --noEmit
```

Ergebnis:

- Exit 0

```sh
npm run build
```

Ergebnis:

- Exit 0
- 3309 modules transformed
- built in 4.89s
- bekannter Chunk-size-Hinweis, kein Build-Fehler

```sh
git diff --check
```

Ergebnis:

- Exit 0

```sh
npm run lint
```

Ergebnis:

- Exit 1
- Bekannte bestehende Lint-Baseline bleibt rot
- Aktueller Baseline-Stand nach diesem Microstep: 304 problems, 272 errors, 32 warnings
- Keine Treffer für die geänderten Dateien im Full-Lint-Output

## Build-Bundle-Regression gegen alten Supabase-void-0-Fehler

Nach `npm run build` geprüft:

- `createClient(void 0=false`
- `createClient(void 0,void 0=false`
- `VITE_SUPABASE_URL void-0 probe=false`
- `VITE_SUPABASE_ANON_KEY void-0 probe=false`

## Remote-/Live-Gate

- Kein Push.
- Kein PR.
- Kein Merge.
- Keine Lovable-Live-Änderung.
