# Phase 3 — Remaining Admin Edge Functions JWT/CORS Hardening

Datum: 2026-06-06 20:41 CEST
Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
Branch: `stabilization/phase-3-data-security-env-hygiene`
Start-HEAD: `4e520148327c6d240f740c740eb5aba8c87931c1` (`test: add repository secret pattern policy`)
Base/Main: `55f156a70cff93579e68b06d865283bdcb665a83`

## Ziel

Nach der ersten Edge-Function-JWT/CORS-Härtung wurde ein weiteres statisches Inventar der übrigen Supabase Edge Functions durchgeführt. Ziel war, Funktionen mit Service-Role/Admin-/KI-/Therapie-Charakter zu identifizieren, die noch keine explizite `verify_jwt=true`-Policy in `supabase/config.toml` hatten und noch wildcard CORS nutzten.

Der Schritt wurde bewusst statisch durchgeführt:

- keine Live-Supabase-Aufrufe,
- keine echten Patientendaten,
- keine echten Anamnesedaten,
- keine AI-Gateway-Aufrufe,
- keine E-Mail-/SMTP-Aufrufe.

## Klassifizierung

Als admin-only/service-role Funktionen klassifiziert und gehärtet:

```text
list-therapy-pseudonyms
generate-diagnoses
extract-lab-image
enrich-wiki-tags
```

Begründung:

- alle vier nutzen `SUPABASE_SERVICE_ROLE_KEY`,
- alle vier prüfen einen authentifizierten User,
- alle vier prüfen Admin-Rolle/Role-Tabelle/RPC vor sensibler Arbeit,
- sie berühren Therapie-, Labor-, Diagnose- oder Admin-Knowledge-Base-Kontext.

Nicht Teil dieses Mikroschritts:

```text
elevenlabs-tts
notify-existing-patient
```

Begründung: In diesem Schritt wurden nur bestätigte service-role/admin-artige Functions gehärtet. Die beiden übrigen Functions benötigen einen separaten Call-Semantik-/Publicness-Check, bevor man Plattform-JWT oder CORS verändert.

## RED

Der bestehende statische Policy-Test wurde test-first erweitert, indem die vier bestätigten admin-only/service-role Functions in den Admin-Policy-Satz aufgenommen wurden.

```text
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
Exit 1
2 Tests failed, 2 Tests passed
```

Erwartete Failures:

```text
list-therapy-pseudonyms: verify_jwt war undefined statt true
list-therapy-pseudonyms: enthielt wildcard Access-Control-Allow-Origin "*"
```

Der Test stoppte beim ersten betroffenen Function-Namen; das vorherige Inventar hatte dieselben Policy-Lücken für alle vier Funktionen gezeigt.

## Änderung

In `supabase/config.toml` wurden explizite Function-Policies ergänzt:

```toml
[functions.list-therapy-pseudonyms]
verify_jwt = true

[functions.generate-diagnoses]
verify_jwt = true

[functions.extract-lab-image]
verify_jwt = true

[functions.enrich-wiki-tags]
verify_jwt = true
```

In den vier Functions wurde literal wildcard CORS durch denselben request-aware Allowlist-Ansatz ersetzt, der bereits für die anderen admin-only/service-role Functions verwendet wird:

- bekannte Praxis-/Lovable-/Custom-Domains,
- lokale Dev-/Preview-Ports `5173`, `4173`, `5174`, `4174`,
- `*.lovableproject.com`,
- `Vary: Origin`,
- kein `Access-Control-Allow-Origin: "*"`.

Geänderte Function-Dateien:

```text
supabase/functions/list-therapy-pseudonyms/index.ts
supabase/functions/generate-diagnoses/index.ts
supabase/functions/extract-lab-image/index.ts
supabase/functions/enrich-wiki-tags/index.ts
```

Zusätzlich wurde der statische Policy-Test erweitert:

```text
src/test/supabase-edge-function-jwt-policy.test.ts
```

## GREEN

```text
npx vitest run src/test/supabase-edge-function-jwt-policy.test.ts
Exit 0
1 Test File passed
4 Tests passed
```

Statische Nachprüfung nach Änderung:

```text
list-therapy-pseudonyms: verify_jwt=true, wildcard_cors=false, getCorsHeaders=true
generate-diagnoses: verify_jwt=true, wildcard_cors=false, getCorsHeaders=true
extract-lab-image: verify_jwt=true, wildcard_cors=false, getCorsHeaders=true
enrich-wiki-tags: verify_jwt=true, wildcard_cors=false, getCorsHeaders=true
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
built in 4.79s
Bekannte Browserslist-/Chunk-Warnungen

npm run lint
Exit 1
Bekannte Bestandsschuld bleibt: 327 problems, 295 errors, 32 warnings

npx eslint src/test/supabase-edge-function-jwt-policy.test.ts src/test/repository-secret-policy.test.ts
Exit 0

git diff --check
Exit 0
```

Hinweis: `deno` ist lokal nicht installiert/verfügbar; daher wurde keine Deno-spezifische Check-Ausführung behauptet.

## Patientendaten / DSGVO / Secrets

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine AI-Gateway-Aufrufe ausgeführt.
- Keine Live-Supabase-Aufrufe ausgeführt.
- Keine Secret-Werte ausgegeben.
- Public-/Pre-Session-Anamnese-/Verification-Flows wurden nicht verändert.
- Legacy `send-verification-email` bleibt erhalten.

## Lokale Port-Disziplin

Es wurde kein Dev-/Preview-Server gestartet.

Port-Status vor/final im Schritt:

```text
5173=free
4173=free
5174=free
4174=free
```

## Backups

Pre-Step ShadowCopy:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-203855_pre-phase-3-remaining-admin-edge-functions-hardening
```

Post-Step ShadowCopy wird nach finalem Commit erstellt und im externen Handoff mit finalem Commit-SHA dokumentiert.

## Commit-Hinweis

Diese Datei ist Teil des lokalen Hardening-Commits. Der exakte finale Commit-SHA wird nach stabilem Commit im externen Handoff dokumentiert, um keinen self-referential SHA-Loop zu erzeugen.

## Nächster optimaler Schritt

Nach diesem Mikroschritt bleiben `elevenlabs-tts` und `notify-existing-patient` als separate Semantik-Inventar-Kandidaten. Sie sollten nicht blind gehärtet werden, sondern zuerst statisch nach aktuellen Callern/Publicness klassifiziert werden.
