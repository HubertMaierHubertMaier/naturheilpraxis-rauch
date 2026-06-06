# Phase 4 – Auth- und Security-Matrix: Route-/Function-Inventar

Datum/Zeit: 2026-06-06 21:36 CEST
Branch: `stabilization/phase-4-auth-security-matrix`
Ausgangs-HEAD / main: `92c88d0b939d78e5d6b5244de55c3e446c9addc1`

## Ziel dieses ersten Phase-4-Schritts

Phase 4 laut `doc/04_phasenplan_umsetzung.md` ist die Auth- und Security-Matrix:

- Route-Matrix erstellen.
- Edge-Function-Matrix erstellen.
- Tabellen-/RLS-Matrix vorbereiten.
- Tests gegen Rollen/Policies aufbauen.
- `verify_jwt=false` pro Function bewusst begründen.

Dieser erste Schritt legt eine versionierte Route-/Edge-Function-Matrix an und ergänzt statische Regressionstests, damit neue Routen oder Edge Functions künftig nicht unklassifiziert bleiben.

## Pre-Phase-ShadowCopy

Erstellt vor substantiellen Änderungen:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-2133_pre-phase-4-auth-security-matrix`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-2133_pre-phase-4-auth-security-matrix/SHADOWCOPY_MANIFEST.md`

## Verifizierter Startstand

Vor Phase-4-Start erneut geprüft:

- GitHub `main`: `92c88d0b939d78e5d6b5244de55c3e446c9addc1`
- lokaler `main`: `92c88d0b939d78e5d6b5244de55c3e446c9addc1`
- `origin/main`: `92c88d0b939d78e5d6b5244de55c3e446c9addc1`
- Lovable Live enthält `data-commit-sha="92c88d0b939d78e5d6b5244de55c3e446c9addc1"`
- Phase-3-Head `b6dd9bb0718dc50f66723bfd394cccd1a7826550` ist Ancestor von `origin/main`.

Zusatz: Lovables ESLint-Follow-up wurde geprüft:

- `npm run lint`: Exit 1 wegen bekannter Bestandsschuld.
- Count wieder bei `327 problems (295 errors, 32 warnings)`.
- Die drei neu hinzugekommenen `as any`-Lintfehler aus dem vorherigen Lovable-Follow-up sind nicht mehr vorhanden.

## TDD-Ablauf

### RED

Neu geschrieben:

- `src/test/phase4-security-access-matrix.test.ts`

Fokussierter RED-Befehl:

```bash
npx vitest run src/test/phase4-security-access-matrix.test.ts
```

Ergebnis:

```text
Test Files 1 failed
Error: Failed to resolve import "@/lib/securityAccessMatrix"
```

Bewertung: sinnvoller RED-Zustand. Der Test verlangt eine versionierte Security-Matrix, die noch nicht existierte.

### GREEN

Neu ergänzt:

- `src/lib/securityAccessMatrix.ts`

Inhalt:

- `routeAccessMatrix`: alle 32 in `src/App.tsx` deklarierten Routes inklusive Komponente, Zielgruppe, Guard-Typ, Sensitivität, Supabase-Tabellen, Edge Functions und Risiko-Hinweis.
- `edgeFunctionAccessMatrix`: alle in `supabase/config.toml` explizit konfigurierten Edge Functions inklusive `verify_jwt`, Zielgruppe, Auth-/Role-Hinweis, Service-Role-Nutzung, CORS, PII-Kontext und Public-Rationale.

Fokussierter GREEN-Befehl:

```bash
npx vitest run src/test/phase4-security-access-matrix.test.ts
```

Ergebnis:

```text
Test Files 1 passed
Tests 4 passed
Exit 0
```

## Neue Regression-Checks

Der neue Test prüft:

1. Jede in `src/App.tsx` deklarierte Route hat einen Eintrag in `routeAccessMatrix`.
2. Admin-/Patient-only-Routen sind nicht als public klassifiziert:
   - `/admin`
   - `/patienten`
   - `/dashboard`
   - `/patienten-bibliothek`
   - `/wissensdatenbank`
3. Jede in `supabase/config.toml` explizit konfigurierte Edge Function hat einen Matrix-Eintrag.
4. Jede bewusst public/pre-session Edge Function mit `verify_jwt=false` hat eine schriftliche Begründung:
   - `request-verification-code`
   - `send-verification-email`
   - `submit-anamnesis`
   - `verify-code`

## Beobachtungen aus der Matrix

- `/anamnesebogen` bleibt bewusst patient-sensitiv, aber public/pre-session möglich, sofern `anamnese_public` aktiviert ist. Das ist kein Patient-only-Route-Fehler, sondern der kontrollierte öffentliche Online-Anamnese-Pfad.
- `/admin`, `/patienten` und `/wissensdatenbank` sind nicht über `ProtectedRoute`, sondern über Komponentenlogik (`useAuth`, `useAdminCheck`, `isAdmin`, lokaler Dev-Bypass) geschützt. Das ist jetzt explizit dokumentiert und testseitig klassifiziert.
- `/dashboard` schützt sich aktuell über Komponenten-Redirect bei fehlendem User, nicht über `ProtectedRoute`. Auch das ist jetzt explizit dokumentiert.
- Alle vorhandenen konfigurierten Edge Functions sind in der Matrix erfasst.
- Public/pre-session Functions bleiben bewusst begründet statt implizit offen.

## Datenschutz-/Patientendaten-Hinweis

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Live-Supabase-/Edge-Function-Aufrufe ausgeführt.
- Keine Secret-Werte ausgegeben.
- Es wurde nur statischer Quellcode und Konfiguration lokal analysiert.

## Geänderte Dateien

- `src/lib/securityAccessMatrix.ts`
- `src/test/phase4-security-access-matrix.test.ts`
- `doc/20260606-phase-4-auth-security-matrix.md`

## Nächste sinnvolle Phase-4-Substeps

1. Tabellen-/RLS-Matrix aus Supabase-Migrationen und Frontend-Queries ergänzen.
2. Admin-/Patient-Routen mit fokussierten Guard-Smoke-Tests absichern, besonders:
   - `/admin`
   - `/patienten`
   - `/wissensdatenbank`
   - `/dashboard`
3. Prüfen, ob component-level Guards für sensible Routen bewusst ausreichend bleiben oder ob zusätzlich route-level Wrapper sinnvoll sind.
4. Rate-Limit- und Role-Check-Spalte für Edge Functions weiter konkretisieren, ohne Live-Patientendaten zu verwenden.


## Substep 2 – Tabellen-/RLS-Matrix ergänzt

Datum/Zeit: 2026-06-06 23:14 CEST
Branch: `stabilization/phase-4-auth-security-matrix`
Pre-Substep-ShadowCopy:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-2308_pre-phase-4-table-rls-matrix`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-2308_pre-phase-4-table-rls-matrix/SHADOWCOPY_MANIFEST.md`

### Ziel

Der zweite Phase-4-Schritt ergänzt die zuvor vorbereitete Tabellen-/RLS-Abdeckung. Die Matrix ist weiterhin statisch und lokal versioniert; es wurden keine Live-Supabase-Aufrufe und keine echten Patientendaten verwendet.

### Quelleninventar

Die Tabellenliste wurde aus `src/integrations/supabase/types.ts` abgeleitet. Erfasst sind alle 15 typisierten Public-Schema-Tabellen:

- `admin_knowledge_base`
- `anamnesis_submissions`
- `app_settings`
- `audit_log`
- `faqs`
- `iaa_submissions`
- `mannayan_orders`
- `mannayan_products`
- `patient_resources`
- `practice_info`
- `practice_pricing`
- `profiles`
- `therapy_sessions`
- `user_roles`
- `verification_codes`

Zusätzlich wurden Frontend-Query-Verbraucher aus `src/**/*.ts(x)` und RLS-/Policy-Kontext aus `supabase/migrations/*.sql` lokal inventarisiert.

### TDD-Ablauf

RED wurde über neue Assertions in `src/test/phase4-security-access-matrix.test.ts` hergestellt:

```text
npx vitest run src/test/phase4-security-access-matrix.test.ts
Test Files 1 failed
Tests 3 failed | 4 passed
Fehler: tableAccessMatrix war noch nicht implementiert.
```

GREEN wurde durch `tableAccessMatrix` in `src/lib/securityAccessMatrix.ts` hergestellt.

Neue Regression-Checks:

1. Jede typisierte Supabase-Tabelle hat einen Eintrag in `tableAccessMatrix`.
2. Patientendaten-Tabellen sind nicht public-read und haben `rlsEnabled=true`.
3. Bewusst public-read Tabellen sind separat dokumentiert, enthalten keine Patientendaten und haben eine schriftliche Begründung:
   - `app_settings`
   - `faqs`
   - `practice_info`
   - `practice_pricing`

### Routenmatrix-Korrekturen aus dem Tabelleninventar

Im Zuge der Inventarisierung wurden veraltete/ungenau benannte Tabellenreferenzen in `routeAccessMatrix` korrigiert:

- `patient_registrations` entfernt, da nicht in der typisierten Supabase-Tabelle vorhanden.
- `patient_library_items` auf `patient_resources` korrigiert.
- `audit_logs` auf `audit_log` korrigiert.
- `anamnesis_submissions`, `iaa_submissions`, `practice_pricing`, `therapy_sessions` und `profiles` dort ergänzt, wo sie aus Frontend-Verbrauchern ableitbar waren.

### Verifizierte Gates nach Substep 2

```text
npx vitest run src/test/phase4-security-access-matrix.test.ts
Exit 0
Test Files 1 passed
Tests 7 passed
```

```text
npx vitest run src/test/phase4-security-access-matrix.test.ts src/test/supabase-edge-function-jwt-policy.test.ts src/test/repository-secret-policy.test.ts
Exit 0
Test Files 3 passed
Tests 13 passed
```

```text
npm test
Exit 0
Test Files 14 passed
Tests 37 passed
```

```text
npx tsc --noEmit
Exit 0
```

```text
npm run build
Exit 0
3309 modules transformed
built in 4.83s
```

```text
npx eslint src/lib/securityAccessMatrix.ts src/test/phase4-security-access-matrix.test.ts
Exit 0
```

```text
git diff --check
Exit 0
```

Bekannter Nicht-Blocker bleibt unverändert:

```text
npm run lint
Exit 1
327 problems (295 errors, 32 warnings)
```

### Datenschutz-/Patientendaten-Hinweis

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Live-Supabase-/Edge-Function-Aufrufe ausgeführt.
- Keine Secret-Werte ausgegeben.
- Alle Checks waren lokale statische oder Build-/Test-Gates.

### Nächste sinnvolle Phase-4-Substeps

1. Matrix-internen Konsistenztest ergänzen: Alle in Routen referenzierten Supabase-Tabellen und Edge Functions müssen in den jeweiligen Matrixlisten existieren.
2. Admin-/Patient-Routen mit weiteren Guard-Smoke-Tests absichern.
3. Prüfen, ob sensible component-level Guards zusätzlich route-level Wrapper bekommen sollten.
4. Edge-Function-Rollen-/Rate-Limit-Spalten weiter konkretisieren, ohne Live-Patientendaten zu verwenden.


## Substep 3 – Matrix-interne Konsistenztests ergänzt

Datum/Zeit: 2026-06-06 23:19 CEST
Branch: `stabilization/phase-4-auth-security-matrix`
Pre-Substep-ShadowCopy:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-2318_pre-phase-4-matrix-consistency-test`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-2318_pre-phase-4-matrix-consistency-test/SHADOWCOPY_MANIFEST.md`

### Ziel

Dieser Substep ergänzt reine Matrix-Konsistenztests, damit Tippfehler oder stale Referenzen zwischen Route-, Tabellen-/RLS- und Edge-Function-Matrix künftig automatisch erkannt werden.

### Charakterisierung statt Produktcode-RED

Neu ergänzt in `src/test/phase4-security-access-matrix.test.ts`:

1. Jede in `routeAccessMatrix.supabaseTables` referenzierte Tabelle muss in `tableAccessMatrix` existieren.
2. Jede in `routeAccessMatrix.edgeFunctions` referenzierte Edge Function muss in `edgeFunctionAccessMatrix` existieren.

Der fokussierte Testlauf war direkt grün:

```text
npx vitest run src/test/phase4-security-access-matrix.test.ts
Exit 0
Test Files 1 passed
Tests 9 passed
```

Bewertung: Dies ist bewusst als Charakterisierungs-/Regressionstest dokumentiert. Der vorherige Substep hatte die bekannten stale Tabellenreferenzen bereits korrigiert, daher war keine weitere Produktionscode-Änderung nötig und kein künstlicher Fehler wurde erzeugt.

### Verifizierte Gates nach Substep 3

```text
npx vitest run src/test/phase4-security-access-matrix.test.ts src/test/supabase-edge-function-jwt-policy.test.ts src/test/repository-secret-policy.test.ts
Exit 0
Test Files 3 passed
Tests 15 passed
```

```text
npm test
Exit 0
Test Files 14 passed
Tests 39 passed
```

```text
npx tsc --noEmit
Exit 0
```

```text
npm run build
Exit 0
3309 modules transformed
built in 4.70s
```

```text
npx eslint src/test/phase4-security-access-matrix.test.ts src/lib/securityAccessMatrix.ts
Exit 0
```

```text
git diff --check
Exit 0
```

Bekannter Nicht-Blocker bleibt unverändert:

```text
npm run lint
Exit 1
327 problems (295 errors, 32 warnings)
```

### Datenschutz-/Patientendaten-Hinweis

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Live-Supabase-/Edge-Function-Aufrufe ausgeführt.
- Keine Secret-Werte ausgegeben.
- Es wurden nur lokale statische Matrix-/Test-Gates ausgeführt.

### Nächste sinnvolle Phase-4-Substeps

1. Admin-/Patient-Routen mit weiteren Guard-Smoke-Tests absichern.
2. Prüfen, ob sensible component-level Guards zusätzlich route-level Wrapper bekommen sollten.
3. Edge-Function-Rollen-/Rate-Limit-Spalten weiter konkretisieren, ohne Live-Patientendaten zu verwenden.


## Substep 4 – Sensible Admin-/Patient-Routen per Guard-Smoke charakterisiert

Datum/Zeit: 2026-06-06 23:24 CEST
Branch: `stabilization/phase-4-auth-security-matrix`
Pre-Substep-ShadowCopy:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-2322_pre-phase-4-admin-patient-route-guard-smoke`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-2322_pre-phase-4-admin-patient-route-guard-smoke/SHADOWCOPY_MANIFEST.md`

### Ziel

Dieser Substep friert die bestehenden component-level Guards für die sensibelsten Admin-/Patient-Routen als lokale Regressionstests ein, bevor eine spätere Entscheidung über zusätzliche route-level Wrapper getroffen wird.

### Neu ergänzt

Neue Testdatei:

`src/test/sensitive-route-guard-smoke.test.tsx`

Abgedeckte Routen und erwartetes bestehendes Verhalten:

1. `/admin`
   - anonymer Besucher wird nach `/auth` weitergeleitet.
   - Admin-Dashboard-Inhalt wird nicht gerendert.

2. `/patienten`
   - authentifizierter Nicht-Admin erhält `Zugriff verweigert`.
   - Patient-Manager-Inhalt wird nicht gerendert.

3. `/wissensdatenbank`
   - authentifizierter Nicht-Admin wird zur Startseite `/` weitergeleitet.
   - Knowledge-Base/Admin-Inhalt wird nicht gerendert.

4. `/dashboard`
   - anonymer Besucher wird nach `/auth` weitergeleitet.
   - Patient-Dashboard-Inhalt wird nicht gerendert.

5. `/patienten-bibliothek`
   - anonymer Besucher wird nach `/auth` weitergeleitet.
   - Bibliotheksinhalt wird nicht gerendert.

### Charakterisierung statt Produktcode-RED

Der fokussierte Testlauf war direkt grün:

```text
npx vitest run src/test/sensitive-route-guard-smoke.test.tsx
Exit 0
Test Files 1 passed
Tests 5 passed
```

Bewertung: Das ist bewusst als Charakterisierungs-/Regressionstest dokumentiert. Die bestehenden Guards erfüllen diese geprüften Grenzen bereits; daher wurde keine Produktcode-Änderung vorgenommen und kein künstlicher Fehler erzeugt.

### Verifizierte Gates nach Substep 4

```text
npx vitest run src/test/sensitive-route-guard-smoke.test.tsx src/test/protected-route-smoke.test.tsx src/test/phase4-security-access-matrix.test.ts
Exit 0
Test Files 3 passed
Tests 16 passed
```

```text
npm test
Exit 0
Test Files 15 passed
Tests 44 passed
```

```text
npx tsc --noEmit
Exit 0
```

```text
npm run build
Exit 0
3309 modules transformed
built in 4.81s
```

```text
npx eslint src/test/sensitive-route-guard-smoke.test.tsx
Exit 0
```

```text
git diff --check
Exit 0
```

Bekannter Nicht-Blocker bleibt unverändert:

```text
npm run lint
Exit 1
327 problems (295 errors, 32 warnings)
```

### Datenschutz-/Patientendaten-Hinweis

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Live-Supabase-/Edge-Function-Aufrufe ausgeführt.
- Keine Secret-Werte ausgegeben.
- Tests nutzen nur synthetische Auth-Zustände und eine `.invalid`-Beispieladresse.

### Beobachtung für spätere Entscheidungen

Die sensiblen Routen verwenden aktuell gemischte Schutzmuster:

- `/patienten-bibliothek` ist route-level über `ProtectedRoute` geschützt.
- `/admin`, `/patienten`, `/wissensdatenbank` und `/dashboard` schützen sich über Komponentenlogik, Redirects bzw. Access-Denial-UI.

Dieser Substep ändert diese Architektur bewusst nicht. Eine spätere Vereinheitlichung auf zusätzliche route-level Wrapper sollte separat mit RED-Test und hohem Stabilitätsfokus erfolgen.

### Nächste sinnvolle Phase-4-Substeps

1. Prüfen, ob sensible component-level Guards zusätzlich route-level Wrapper bekommen sollten, ohne Verhalten zu brechen.
2. Falls ja: erst RED-Test für eine konkrete Route, dann minimaler Wrapper-Change.
3. Alternativ Edge-Function-Rollen-/Rate-Limit-Spalten weiter konkretisieren, wenn die Route-Guard-Architektur zunächst unverändert bleiben soll.
