# Phase 3 — Final Edge Function Caller/Publicness Hardening

Datum: 2026-06-06 20:50 CEST
Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
Branch: `stabilization/phase-3-data-security-env-hygiene`
Start-HEAD: `c13c15678093ad22a93211a5bae3c3b273f779b6` (`fix: harden remaining admin edge functions`)
Base/Main: `55f156a70cff93579e68b06d865283bdcb665a83`

## Ziel

Nach der Härtung aller bestätigten service-role/admin Edge Functions wurden die zwei verbleibenden bisher nicht klassifizierten Edge Functions separat geprüft:

```text
elevenlabs-tts
notify-existing-patient
```

Ziel war kein Blind-Hardening, sondern ein statischer Caller-/Publicness-Check:

- Ist die Function public/pre-session notwendig?
- Wird sie von getracktem App-Code aufgerufen?
- Nutzt sie sensible externe Provider-/Relay-Secrets?
- Ist `verify_jwt` in `supabase/config.toml` explizit gesetzt?
- Gibt es wildcard CORS?
- Gibt es Logs, die Response-/Fehlerdetails mit potenziell sensiblen Daten ausgeben könnten?

Es wurden keine Live-Aufrufe durchgeführt.

## Klassifizierung

### `notify-existing-patient`

Statische Caller-Prüfung:

```text
src/pages/Auth.tsx
```

Der getrackte App-Caller ruft `notify-existing-patient` nach Registrierung/Verifizierung und nach `supabase.auth.signInWithPassword(...)` auf. Damit ist die Function nicht als anonymer Public-/Pre-Session-Flow klassifiziert, sondern als authentifizierter Post-Registration-Benachrichtigungsflow.

Weitere statische Merkmale:

- nutzt `RELAY_SECRET`, `SMTP_*`-Konfiguration und einen Mail-Relay-Endpunkt,
- übermittelt E-Mail-Adresse im Praxis-Benachrichtigungstext,
- hatte keine explizite `verify_jwt`-Config,
- nutzte bisher Supabase-CORS-Import statt lokale Origin-Allowlist,
- loggte Relay-Antworttext (`relayResult`), der sicherheitlich nicht als stabil nicht-sensitiv angenommen werden sollte.

Entscheidung:

```text
verify_jwt=true
request-aware CORS-Allowlist
Relay-Response-Text nicht mehr loggen
Fehlerantwort generisch halten
```

### `elevenlabs-tts`

Statische Caller-Prüfung:

```text
Kein getrackter App-Code-Caller gefunden.
```

Weitere statische Merkmale:

- nutzt `ELEVENLABS_API_KEY`, also einen sensiblen externen Provider-/Kosten-Secret-Kontext,
- hatte keine explizite `verify_jwt`-Config,
- nutzte wildcard CORS,
- loggte ElevenLabs-Error-Body und gab Provider-Fehlerdetails in Response-Fehlern zurück.

Entscheidung:

```text
verify_jwt=true
request-aware CORS-Allowlist
Provider-Error-Body nicht mehr loggen oder zurückgeben
Fehlerantwort generisch halten
```

Da kein getrackter App-Caller vorhanden ist, ist diese Härtung funktional risikoarm für sichtbare Produktflows und sicherheitlich sinnvoll, weil die Function einen externen Provider-Key schützt.

## RED

Der bestehende statische Edge-Function-Policy-Test wurde test-first erweitert:

- `authenticatedNonPublicFunctions` enthält zusätzlich:
  - `elevenlabs-tts`
  - `notify-existing-patient`
- JWT-Test verlangt `verify_jwt=true` für authentifizierte/nicht-public Functions.
- CORS-Test verlangt keine wildcard Origin und `getCorsHeaders(req)`.
- Logging-Test umfasst `notify-existing-patient` und erkennt `relayResult`-Logging.

RED-Ergebnis:

```text
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
Exit 1
1 Test File failed
3 Tests failed, 1 Test passed
```

Erwartete Failures:

```text
elevenlabs-tts: verify_jwt undefined statt true
elevenlabs-tts: wildcard CORS vorhanden
notify-existing-patient: relayResult wurde geloggt
```

## Änderung

Geänderte Dateien:

```text
src/test/supabase-edge-function-jwt-policy.test.ts
supabase/config.toml
supabase/functions/elevenlabs-tts/index.ts
supabase/functions/notify-existing-patient/index.ts
```

`supabase/config.toml`:

```toml
[functions.elevenlabs-tts]
verify_jwt = true

[functions.notify-existing-patient]
verify_jwt = true
```

Beide Functions erhielten denselben request-aware CORS-Allowlist-Ansatz wie die gehärteten Admin-Functions:

- bekannte Lovable-/Praxis-/Custom-Domains,
- lokale Dev-/Preview-Ports `5173`, `4173`, `5174`, `4174`,
- `*.lovableproject.com`,
- `Vary: Origin`,
- kein wildcard `Access-Control-Allow-Origin`.

Logging-/Fehlerhygiene:

- `notify-existing-patient` loggt nicht mehr `relayResult`, sondern nur noch eine generische Empfangsmeldung.
- `notify-existing-patient` gibt in Fehlerfällen nicht mehr `error.message` zurück, sondern generisch `Notification failed`.
- `elevenlabs-tts` loggt/returned keinen ElevenLabs-Provider-Error-Body mehr.
- `elevenlabs-tts` gibt in Catch-Fällen generisch `TTS generation failed` zurück.

Nicht verändert:

- Auth-/Registration-UI in `src/pages/Auth.tsx`,
- Public-/Pre-Session-Anamnese-/Verification-Flows,
- SMTP-/Relay-Zieladresse,
- TTS-Modell-/Voice-Konfiguration,
- Live-Supabase-/Provider-Konfiguration.

## GREEN

```text
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
Exit 0
1 Test File passed
4 Tests passed
```

Statische Nachprüfung nach Änderung:

```text
elevenlabs-tts: verify_jwt=true, wildcard_cors=false, getCorsHeaders=true
notify-existing-patient: verify_jwt=true, wildcard_cors=false, getCorsHeaders=true
```

## Vollständige lokale Gates

```text
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts src/test/repository-secret-policy.test.ts src/test/anamnesebogen-public-submission-safety-characterization.test.tsx src/test/protected-route-smoke.test.tsx
Exit 0
4 Test Files passed
10 Tests passed

npm test
Exit 0
13 Test Files passed
30 Tests passed

npx tsc --noEmit
Exit 0

npm run build
Exit 0
3309 modules transformed
built in 4.68s
Bekannte Browserslist-/Chunk-Warnungen

npm run lint
Exit 1
Bekannte Bestandsschuld bleibt: 327 problems, 295 errors, 32 warnings

npx eslint src/test/supabase-edge-function-jwt-policy.test.ts supabase/functions/elevenlabs-tts/index.ts supabase/functions/notify-existing-patient/index.ts
Exit 0

git diff --check
Exit 0
```

Hinweis: `deno` ist lokal nicht installiert/verfügbar; daher wurde keine Deno-spezifische Check-Ausführung behauptet.

## Patientendaten / DSGVO / Secrets

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Live-Supabase-Aufrufe ausgeführt.
- Keine Relay-/SMTP-Aufrufe ausgeführt.
- Keine ElevenLabs-/Provider-Aufrufe ausgeführt.
- Keine Secret-Werte ausgegeben.
- Keine patientenbezogenen Werte in neue Testdaten eingeführt.
- Fehler-/Provider-/Relay-Responses werden in den zwei Functions weniger detailliert nach außen/logseitig sichtbar.

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
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-204806_pre-phase-3-final-edge-function-caller-publicness-hardening
```

Post-Step ShadowCopy wird nach finalem Commit erstellt und im externen Handoff mit finalem Commit-SHA dokumentiert.

## Commit-Hinweis

Diese Datei ist Teil des lokalen Hardening-Commits. Der exakte finale Commit-SHA wird nach stabilem Commit im externen Handoff dokumentiert, um keinen self-referential SHA-Loop zu erzeugen.

## Nächster optimaler Schritt

Nach diesem Mikroschritt ist die Phase-3-Edge-Function-Policy statisch vollständig über alle derzeit vorhandenen `supabase/functions/*` abgedeckt. Der nächste sinnvolle Schritt ist ein letzter Phase-3-Gesamtstatus-/PR-Readiness-Check ohne Push: saubere Commit-Liste, Handoff-Konsistenz, keine Secret-Leaks in Handoffs, und dann nur auf ausdrückliche Anweisung `PR erstellen` weiter.
