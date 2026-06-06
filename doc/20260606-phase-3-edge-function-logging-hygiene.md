# Phase 3 — Edge Function Logging Hygiene

Datum: 2026-06-06 20:17 CEST
Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
Branch: `stabilization/phase-3-data-security-env-hygiene`
Start-HEAD: `382dcbe75724679fab71e18592a77d52f7540ab0` (`fix: restrict admin edge function cors`)
Base/Main: `55f156a70cff93579e68b06d865283bdcb665a83`

## Ziel

DSGVO-bewusste Reduktion sensibler Log-Ausgaben in priorisierten Supabase Edge Functions, ohne Public-/Legacy-/Anamnese-Flows funktional zu verändern.

Dieser Schritt haertet ausschliesslich Log-Inhalte. Es wurden keine Live-Supabase-Aufrufe, keine echten E-Mail-Verifikationen und keine echten Patienten-/Anamnesedaten verwendet.

## Priorisierte Functions

Bearbeitet:

- `supabase/functions/submit-anamnesis/index.ts`
- `supabase/functions/request-verification-code/index.ts`
- `supabase/functions/verify-code/index.ts`
- `supabase/functions/resend-submission/index.ts`

Bewusst nicht deaktiviert:

- `send-verification-email` bleibt als Legacy-Funktion erhalten, weil der Nutzer bestaetigt hat, dass Legacy noch benoetigt wird.

## Aenderung

Direkte Identifier wurden aus Hochrisiko-Logs entfernt, insbesondere:

- E-Mail-Adressen in SMTP-/Verification-/Confirm-Logs
- `submissionId` in Resend-Logs
- Storage-Pfade wie `pdfStoragePath`
- Rate-Limit-Keys, die E-Mail + Typ enthalten koennen
- volle Zod-Validation-Error-Arrays aus Request-Payloads
- interne User-ID in Cleanup-Logs fuer unbestaetigte Re-Registrierungen

Beispiele der neuen Log-Formulierungen:

- `"[SMTP] sending anamnesis verification code"`
- `"Anamnesis verification code sent"`
- `"Rate limit exceeded for verification-code request"`
- `"Verify rate limit exceeded"`
- `"[resend] Retrieving stored PDFs"`
- `"[resend] Emails sent successfully ${pdfInfo}"`

Die eigentliche Verarbeitung bleibt unveraendert: E-Mail-Zustellung, Code-Erzeugung, DB-Schreibungen, PDF-Storage und Resend-Ablauf wurden nicht absichtlich veraendert.

## Test-first / RED-GREEN

Ergaenzt wurde ein statischer Policy-Test in:

- `src/test/supabase-edge-function-jwt-policy.test.ts`

Neue Assertion:

- High-risk Verification-/Anamnese-Functions duerfen direkte Patient-/Submission-Identifier nicht per `console.log`, `console.warn`, `console.error` oder `console.info` loggen.

RED:

```text
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
Exit 1
1 Test failed
Erster Treffer: submit-anamnesis loggte direkte Identifier / Payload-Details.
Nach Schaerfung der Policy wurde auch request-verification-code mit existingUserId-Cleanup-Log erfasst.
```

GREEN:

```text
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
Exit 0
1 Test File passed
4 Tests passed
```

Fokussierte Regression:

```text
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/anamnesebogen-public-submission-safety-characterization.test.tsx src/test/protected-route-smoke.test.tsx
Exit 0
3 Test Files passed
8 Tests passed
```

## Vollstaendige lokale Gates

```text
npm test
Exit 0
12 Test Files passed
28 Tests passed

npx tsc --noEmit
Exit 0

npm run build
Exit 0
3309 modules transformed
built in 4.89s
Bekannte Browserslist-/Chunk-Warnungen

npm run lint
Exit 1
Bekannte Bestandsschuld bleibt: 327 problems, 295 errors, 32 warnings

npx eslint src/test/supabase-edge-function-jwt-policy.test.ts
Exit 0

git diff --check
Exit 0
```

## Patientendaten / DSGVO

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Live-Supabase-/Edge-Function-Aufrufe ausgeführt.
- Logs wurden reduziert, damit direkte Identifier nicht unnoetig in Runtime-Logs gelangen.
- Bestehende Audit-/DB-Felder wurden in diesem Schritt nicht entfernt oder semantisch veraendert; Ziel war ausschliesslich Console-Logging-Hygiene.

## Lokale Port-Disziplin

Es wurde kein Dev-/Preview-Server gestartet.

Finaler Port-Status:

```text
5173=free
4173=free
5174=free
4174=free
```

## Backups

Pre-Step ShadowCopy:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-201244_pre-phase-3-edge-function-logging-hygiene
```

Post-Step ShadowCopy wird nach finalem Commit erstellt und im externen Handoff mit exaktem finalem Commit-SHA dokumentiert.

## Commit-Hinweis

Diese Datei ist Teil des lokalen Logging-Hygiene-Commits. Um einen self-referential SHA-Loop zu vermeiden, steht der exakte finale Commit-SHA nicht in dieser Repo-Dokumentation, sondern im externen Lovable/GitHub-Handoff nach stabilem Commit.

## Naechster optimaler Schritt

Nach diesem lokalen Schritt: optional weitere DSGVO-Haertung mit statischer Suche nach sensiblen Log-Mustern in uebrigen Functions, insbesondere bei Admin-/AI-/Therapie-Functions, wieder nur in kleinen Characterization-/Policy-Schritten.
