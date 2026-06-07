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
- `VITE_SUPABASE_URL: void 0=false`
- `VITE_SUPABASE_ANON_KEY: void 0=false`

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
- `VITE_SUPABASE_URL: void 0=false`
- `VITE_SUPABASE_ANON_KEY: void 0=false`

## Remote-/Live-Gate

- Kein Push.
- Kein PR.
- Kein Merge.
- Keine Lovable-Live-Änderung.
