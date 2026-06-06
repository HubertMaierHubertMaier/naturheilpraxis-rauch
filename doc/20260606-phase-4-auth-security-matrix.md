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
