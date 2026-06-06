# Phase 3 — Admin Edge Function CORS Hardening

Datum: 2026-06-06 20:07 CEST
Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
Branch: `stabilization/phase-3-data-security-env-hygiene`
Start-HEAD: `1f9d97f65270eac8dd448801d724d2904bb05f6f`

## Ziel

Dieser Mikroschritt haertet CORS fuer die bereits als admin-only/service-role klassifizierten Supabase Edge Functions. Die Funktionen bleiben weiterhin durch Plattform-JWT (`verify_jwt = true`) und interne Admin-/Auth-Pruefungen geschuetzt. Zusaetzlich wird `Access-Control-Allow-Origin: "*"` fuer diese sensitiven Funktionen entfernt.

## User-Entscheidung

`send-verification-email` wird weiterhin benoetigt und bleibt daher in diesem Schritt unveraendert als Legacy-/Public-Flow mit `verify_jwt = false` und bisheriger CORS-Policy. Eine Entfernung oder JWT-Umstellung wurde nicht vorgenommen.

## Gehaertete Funktionen

- `generate-icd10`
- `send-icd10-report`
- `resend-submission`
- `get-patients`
- `therapy-recommend`
- `get-therapy-sessions`

## Bewusst unveraendert

Folgende Public-/Pre-Session-/Legacy-Flows wurden nicht gehaertet, um Anamnese-/Verifikationspfade nicht ungetestet zu brechen:

- `request-verification-code`
- `verify-code`
- `submit-anamnesis`
- `send-verification-email`

## CORS-Regel

Die gehaerteten Admin-Funktionen setzen `Access-Control-Allow-Origin` nur noch dynamisch, wenn der Request-Origin bekannt ist:

- `http://localhost:5173`
- `http://localhost:4173`
- `http://localhost:5174`
- `http://localhost:4174`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:4173`
- `http://127.0.0.1:5174`
- `http://127.0.0.1:4174`
- `https://naturheilpraxis-rauch.lovable.app`
- `https://rauch-heilpraktiker.de`
- `https://www.rauch-heilpraktiker.de`
- `https://*.lovableproject.com` Preview-Hosts

`Vary: Origin` wird gesetzt, damit Caches origin-spezifische Antworten korrekt behandeln.

## RED/GREEN

### RED

Test zuerst erweitert:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis vor Produkt-/Function-Aenderung:

```text
1 Test failed
Failure: generate-icd10 still contained Access-Control-Allow-Origin: "*"
```

### GREEN

Nach minimaler Aenderung in den sechs admin-only Edge Functions:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis:

```text
1 Test File passed
3 Tests passed
```

### Fokussierte Regression

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/anamnesebogen-public-submission-safety-characterization.test.tsx src/test/protected-route-smoke.test.tsx
```

Ergebnis:

```text
3 Test Files passed
7 Tests passed
```

## Vollstaendige lokale Gates

```text
npm test: Exit 0; 12 Test Files passed; 27 Tests passed
npx tsc --noEmit: Exit 0
npm run build: Exit 0; built in 4.73s; bekannte Chunk-/Browserslist-Warnungen
npm run lint: Exit 1; bekannte Bestandsschuld bleibt 327 problems (295 errors, 32 warnings)
npx eslint src/test/supabase-edge-function-jwt-policy.test.ts: Exit 0
```

Zusaetzlich:

```text
git diff --check: Exit 0
```

## Patientendaten/DSGVO

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine Live-Supabase-Aufrufe ausgefuehrt.
- Keine E-Mail-Verifikation live ausgefuehrt.
- Keine Secrets, Tokens oder echten personenbezogenen Daten dokumentiert.
- Dieser Schritt reduziert die Browser-Origin-Angriffsoberflaeche fuer admin-only/service-role Edge Functions.

## Backups

Pre-Step ShadowCopy:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-200602_pre-phase-3-admin-cors-hardening
```

Post-Step ShadowCopy wird nach den vollen Gates und dem lokalen Commit erstellt.

## Bekannte Grenzen

- Deno ist lokal nicht installiert; ein `deno check` der Edge Functions konnte daher nicht ausgefuehrt werden.
- Die Frontend-Gates und statischen Vitest-Policytests bleiben die lokale Verifikationsbasis.
- Public-/Legacy-CORS (`request-verification-code`, `verify-code`, `submit-anamnesis`, `send-verification-email`) bleibt fuer einen separaten, vorsichtigen Schritt offen.
- DSGVO-Logging-Haertung ist der naechste eigenstaendige Schritt und wurde nicht mit CORS gebuendelt.

## Naechster empfohlener Schritt

DSGVO-Logging-Haertung function-by-function, beginnend mit den hoechsten Patientendaten-/E-Mail-Beruehrungspunkten (`submit-anamnesis`, `request-verification-code`, `verify-code`, `resend-submission`) und jeweils mit statischer Charakterisierung, Test und minimaler Reduktion sensibler Log-Inhalte.
