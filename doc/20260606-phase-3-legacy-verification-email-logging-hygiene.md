# Phase 3 — Legacy Verification Email Logging Hygiene

Datum: 2026-06-06 20:23 CEST
Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
Branch: `stabilization/phase-3-data-security-env-hygiene`
Start-HEAD: `e6dc38a8a582d99a4f72ac713d2a150449af2c8b` (`fix: reduce sensitive edge function logs`)
Base/Main: `55f156a70cff93579e68b06d865283bdcb665a83`

## Ziel

Den nach dem vorigen Logging-Hygiene-Schritt verbleibenden Legacy-Log mit direkter E-Mail-Adresse in `send-verification-email` entschärfen, ohne die Legacy-Funktion zu deaktivieren oder ihren Ablauf zu verändern.

Der Nutzer hat bestätigt, dass Legacy weiterhin benötigt wird. Deshalb bleibt `send-verification-email` technisch erhalten und bleibt in `supabase/config.toml` weiterhin als anonymer/pre-session Flow ohne Plattform-JWT klassifiziert.

## Ausgangsinventar

Eine statische Suche nach direkten Identifier-Logs in `supabase/functions/*/index.ts` fand nach dem vorherigen Schritt noch genau einen Treffer:

```text
send-verification-email line 106: console.log(`Verification email sent successfully to ${email}`);
```

Alle übrigen geprüften Edge Functions hatten für das verwendete Pattern keine Treffer mehr.

## Änderung

Geändert wurde ausschließlich ein Console-Log:

```text
console.log(`Verification email sent successfully to ${email}`);
```

wurde zu:

```text
console.log("Verification email sent successfully");
```

Die E-Mail-Zustellung, der Request-Flow, CORS, `verify_jwt`, SMTP-Konfiguration, Response-Shape und Error-Handling wurden nicht absichtlich verändert.

## Test-first / RED-GREEN

Erweitert wurde der bestehende statische Policy-Test:

```text
src/test/supabase-edge-function-jwt-policy.test.ts
```

`send-verification-email` wurde in die High-Risk-Logging-Function-Liste aufgenommen.

RED:

```text
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
Exit 1
1 Test failed
Fehler: send-verification-email loggte direkte E-Mail-Adresse in console.log.
```

GREEN:

```text
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
Exit 0
1 Test File passed
4 Tests passed
```

Zusätzliche statische Nachprüfung:

```text
Direkte Identifier-Log-Findings in supabase/functions/*/index.ts: []
```

## Vollständige lokale Gates

```text
Fokussierte Regression:
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/anamnesebogen-public-submission-safety-characterization.test.tsx src/test/protected-route-smoke.test.tsx
Exit 0
3 Test Files passed
8 Tests passed

npm test
Exit 0
12 Test Files passed
28 Tests passed

npx tsc --noEmit
Exit 0

npm run build
Exit 0
3309 modules transformed
built in 4.75s
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
- Legacy-Funktion wurde nicht deaktiviert.
- Eine direkte E-Mail-Adresse wurde aus dem Success-Console-Log entfernt.

## Lokale Port-Disziplin

Es wurde kein Dev-/Preview-Server gestartet.

Finaler Port-Status wird nach Commit erneut geprüft und im externen Handoff dokumentiert.

## Backups

Pre-Step ShadowCopy:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-202121_pre-phase-3-legacy-verification-email-logging-hygiene
```

Post-Step ShadowCopy wird nach finalem Commit erstellt und im externen Handoff mit exaktem finalem Commit-SHA dokumentiert.

## Commit-Hinweis

Diese Datei ist Teil des lokalen Legacy-Logging-Hygiene-Commits. Der exakte finale Commit-SHA steht nicht in dieser Repo-Dokumentation, um keinen self-referential SHA-Loop zu erzeugen; er wird im externen Lovable/GitHub-Handoff nach stabilem Commit dokumentiert.

## Nächster optimaler Schritt

Nach diesem Schritt ist das aktuell definierte direkte Identifier-Console-Log-Pattern in `supabase/functions/*/index.ts` bereinigt. Nächster sinnvoller kleiner Schritt wäre ein separates Secret-/Token-/Credential-String-Inventar für Dokumentation, `.env.example`, Supabase Function Sources und Handoffs, ohne Werte auszugeben.
