# Phase 3 – Edge Function JWT hardening

Erstellt: 2026-06-06

## Ausgangspunkt

- Branch: `stabilization/phase-3-data-security-env-hygiene`
- Start-HEAD dieses Schritts: `a667870a9f23922ce29ddf3dbd7af71bebdaae7e`
- Base `main`: `55f156a70cff93579e68b06d865283bdcb665a83`
- Kein Push, kein PR, kein Merge, keine Lovable-Live-Aenderung.
- Es wurde kein lokaler Dev-/Preview-Server gestartet.

## Ziel

Die Supabase Edge Functions mit Service-Role-Zugriff und Admin-/Therapie-/ICD-10-Patientenkontext sollen nicht mehr schon auf Plattformebene ohne JWT aufrufbar sein.

Dieser Schritt haertet nur `supabase/config.toml`. Die bestehenden internen Funktions-Auth-Checks bleiben unveraendert als zweite Schutzschicht bestehen.

## Inventar und Klassifizierung

Konfigurationsstand vor diesem Schritt:

| Function | vorher `verify_jwt` | Klassifizierung | Begruendung |
| --- | --- | --- | --- |
| `request-verification-code` | `false` | oeffentlich notwendig | Login/Registrierung/Passwort-Reset fordert vor Session einen Code an. |
| `verify-code` | `false` | oeffentlich notwendig | Code-Verifikation erzeugt/ermoeglicht erst den Login-/Registrierungsabschluss. |
| `submit-anamnesis` | `false` | oeffentlich/DSGVO-kritisch | Anonymer Public-Anamnese-Pfad ist Phase-2-charakterisiert; rechtlich pruefpflichtig, aber technisch vorerst bewusst erreichbar. |
| `send-verification-email` | `false` | Legacy/Pruefkandidat | Direkter Legacy-Mailer; im aktuellen `src/` nicht aktiv gefunden. Bewusst nicht in diesem Schritt geaendert, um keinen unbekannten externen Flow zu brechen. |
| `generate-icd10` | `false` | admin-only / service-role | Funktion prueft intern Admin-Token und liest Anamnese-/ICD-10-Kontext via Service Role. |
| `send-icd10-report` | `false` | admin-only / service-role / E-Mail | Funktion prueft intern Admin-Token und sendet patientenbezogenen ICD-10-Bericht. |
| `resend-submission` | `false` | admin-only / service-role / E-Mail | Funktion prueft intern Admin-Token und versendet Einreichungen erneut. |
| `get-patients` | `false` | admin-only / service-role | Funktion prueft intern Admin-Rolle und liest Patientenprofile/Einreichungen. |
| `therapy-recommend` | `false` | admin-only / service-role / KI | Funktion prueft intern Admin-Rolle, nutzt Therapie-/Wissensdaten und KI-Gateway. |
| `get-therapy-sessions` | `false` | admin-only / service-role | Funktion prueft intern Admin-Rolle und liest Therapiesitzungen. |

Nicht explizit in `supabase/config.toml` konfigurierte Functions wurden inventarisiert, aber nicht geaendert. Supabase-Default wird hier nicht ueberschrieben. Sie bleiben Kandidaten fuer eine separate CORS-/Logging-/Legacy-Triage.

## RED/GREEN

### RED

Neuer Test:

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis vor der Konfigurationsaenderung:

```text
Test Files  1 failed (1)
Tests       1 failed | 1 passed (2)
Failure: generate-icd10: expected false to be true
```

Damit war belegt, dass mindestens eine admin-only/service-role Function noch `verify_jwt=false` hatte.

### GREEN

Geaendert in `supabase/config.toml`:

```text
[functions.generate-icd10]        verify_jwt = true
[functions.send-icd10-report]     verify_jwt = true
[functions.resend-submission]     verify_jwt = true
[functions.get-patients]          verify_jwt = true
[functions.therapy-recommend]     verify_jwt = true
[functions.get-therapy-sessions]  verify_jwt = true
```

Bewusst unveraendert `false`:

```text
[functions.request-verification-code]
[functions.verify-code]
[functions.submit-anamnesis]
[functions.send-verification-email]
```

GREEN-Ergebnis:

```text
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
Test Files  1 passed (1)
Tests       2 passed (2)
```

## Fokus-Regression

```sh
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/anamnesebogen-public-submission-safety-characterization.test.tsx src/test/protected-route-smoke.test.tsx
```

Ergebnis:

```text
Test Files  3 passed (3)
Tests       6 passed (6)
```

## Vollstaendige lokale Gates

```sh
npm test
```

Ergebnis:

```text
Test Files  12 passed (12)
Tests       26 passed (26)
```

```sh
npx tsc --noEmit
```

Ergebnis: Exit 0.

```sh
npm run build
```

Ergebnis:

```text
3309 modules transformed
built in 4.80s
```

Bekannte nicht-blockierende Build-Warnungen:

- Browserslist/caniuse-lite ist veraltet.
- Einige Chunks sind groesser als 500 kB nach Minification.

```sh
npm run lint
```

Ergebnis: Exit 1 wegen bekannter Bestandsschuld.

```text
327 problems (295 errors, 32 warnings)
```

Isolierter Lint fuer die neue Testdatei:

```sh
npx eslint src/test/supabase-edge-function-jwt-policy.test.ts
```

Ergebnis: Exit 0.

## Patientendaten-/DSGVO-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten E-Mail-Verifikationen ausgeloest.
- Keine Live-Supabase-/Edge-Function-Aufrufe ausgefuehrt.
- Keine Screenshots erstellt.
- Patientendatenfuehrende Functions erhalten nun eine zusaetzliche Plattform-JWT-Barriere, bevor die bestehende interne Admin-Pruefung ausgefuehrt wird.

## Port-Disziplin

- Kein Dev-/Preview-Server gestartet.
- Es wurde kein Port belegt.
- Die ueblichen Ports wurden zu Beginn geprueft und waren frei: `5173`, `4173`, `5174`, `4174`.

## Bekannte Folgepunkte

1. `send-verification-email` ist ein Legacy-/Pruefkandidat: im aktuellen Frontend nicht aktiv gefunden, aber noch mit `verify_jwt=false` konfiguriert. Naechster stabiler Schritt sollte klaeren, ob diese Function deaktiviert, auf `verify_jwt=true` gesetzt oder durch `request-verification-code` vollstaendig ersetzt werden kann.
2. CORS bleibt in vielen Edge Functions noch auf `Access-Control-Allow-Origin: *`. Das sollte in einem separaten Schritt inventarisiert und dann risikoarm zentralisiert/gehärtet werden.
3. Edge-Function-Logs enthalten an mehreren Stellen E-Mail-/Identifier-/Pfad-nahe Informationen. Das ist ein eigener DSGVO-Logging-Härtungsschritt und wurde hier nicht gebündelt.
4. Functions, die nicht explizit in `supabase/config.toml` stehen, sollten separat gegen den Supabase-Default und ihre tatsaechliche Deployment-Konfiguration geprueft werden.
