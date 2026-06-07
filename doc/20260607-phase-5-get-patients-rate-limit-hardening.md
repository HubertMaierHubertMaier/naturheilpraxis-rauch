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
