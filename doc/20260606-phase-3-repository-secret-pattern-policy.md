# Phase 3 — Repository Secret Pattern Policy and Documentation Redaction

Datum: 2026-06-06 20:32 CEST
Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
Branch: `stabilization/phase-3-data-security-env-hygiene`
Start-HEAD: `004dbfa90af4035e0c6fb71b6d4276db7f983ea5` (`fix: reduce legacy verification email log`)
Base/Main: `55f156a70cff93579e68b06d865283bdcb665a83`

## Ziel

Nach Env-Hygiene, Edge-Function-JWT/CORS-Härtung und Logging-Hygiene wurde als nächster sicherer Schritt ein statisches Secret-/Credential-Pattern-Inventar eingeführt.

Ziel war, offensichtliche geheime oder geheimnisartige Werte in getrackten Textdateien früh im Testlauf zu blockieren, ohne echte Werte in Tool-Ausgaben, Dokumentation oder Handoffs zu veröffentlichen.

## Schutzumfang

Der neue Test prüft getrackte Textdateien aus `git ls-files` auf folgende Muster:

- JWT-artige Token (`eyJ...` mit drei Segmenten)
- Private-Key-Blöcke
- URLs mit eingebetteten Zugangsdaten
- Literal-Zuweisungen an Schlüssel-/Token-/Secret-/Passwort-Felder, sofern nicht erkennbar Platzhalter/Redactions verwendet werden
- Env-Tracking-Disziplin: nur `.env.example` darf als `.env*` getrackt sein

Der Test gibt nur Datei, Zeile und Pattern-Klasse aus, keine Secret-Werte.

## RED / Findings

Erstlauf des neuen Tests:

```text
npx vitest run src/test/repository-secret-policy.test.ts
Exit 1
1 Test failed, 1 Test passed
```

Redigierte Befundklassen:

```text
docs/SNAPSHOT-2026-06-04/01-architecture.md line 42: jwt_like
docs/restore/01-overview-and-config.md line 13: jwt_like
```

Die betroffenen Dokumentationsstellen enthielten getrackte Supabase-Environment-Beispiele mit einem JWT-artigen Publishable-Key. Die Werte wurden nicht ausgegeben.

## Änderung

In den zwei betroffenen Dokumentationsdateien wurden Supabase-Konfigurationsbeispiele auf Platzhalter umgestellt:

```text
VITE_SUPABASE_URL=https://<supabase-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
VITE_SUPABASE_PROJECT_ID=<supabase-project-ref>
```

Betroffene Dateien:

```text
docs/SNAPSHOT-2026-06-04/01-architecture.md
docs/restore/01-overview-and-config.md
```

Zusätzlich wurde der neue Policy-Test angelegt:

```text
src/test/repository-secret-policy.test.ts
```

## GREEN / Nachprüfung

```text
npx vitest run src/test/repository-secret-policy.test.ts
Exit 0
1 Test File passed
2 Tests passed
```

Redigierte Nachprüfung nach der Änderung:

```text
tracked_findings: []
external_handoff_findings: []
```

## Vollständige lokale Gates

```text
npx vitest run src/test/repository-secret-policy.test.ts src/test/supabase-edge-function-jwt-policy.test.ts
Exit 0
2 Test Files passed
6 Tests passed

npm test
Exit 0
13 Test Files passed
30 Tests passed

npx tsc --noEmit
Exit 0

npm run build
Exit 0
3309 modules transformed
built in 4.88s
Bekannte Browserslist-/Chunk-Warnungen

npm run lint
Exit 1
Bekannte Bestandsschuld bleibt: 327 problems, 295 errors, 32 warnings

npx eslint src/test/repository-secret-policy.test.ts src/test/supabase-edge-function-jwt-policy.test.ts
Exit 0

git diff --check
Exit 0
```

## Patientendaten / DSGVO / Secrets

- Keine echten Patientendaten verwendet.
- Keine echten Anamnesedaten verwendet.
- Keine echten E-Mail-Verifikationen ausgelöst.
- Keine Live-Supabase-/Edge-Function-Aufrufe ausgeführt.
- Keine Secret-Werte in Dokumentation, Handoff oder Zusammenfassung ausgegeben.
- Gefundene Token-/Secret-ähnliche Inhalte wurden nur als Datei/Zeile/Pattern-Klasse dokumentiert.
- Externe Lovable-Handoffs wurden zusätzlich redigiert gescannt; keine Treffer.

## Lokale Port-Disziplin

Es wurde kein Dev-/Preview-Server gestartet.

Port-Status vor dem Schritt:

```text
5173=free
4173=free
5174=free
4174=free
```

Finaler Port-Status wird nach Commit erneut geprüft und im externen Handoff dokumentiert.

## Backups

Pre-Step ShadowCopy:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-203021_pre-phase-3-secret-pattern-policy-doc-redaction
```

Hinweis: Diese Pre-Step ShadowCopy ist lokal und nicht publishable; sie wurde vor Redaction der getrackten Dokumentationsbefunde erstellt.

Post-Step ShadowCopy wird nach finalem Commit erstellt und im externen Handoff mit finalem Commit-SHA dokumentiert.

## Commit-Hinweis

Diese Datei ist Teil des lokalen Secret-Pattern-Policy-Commits. Der exakte finale Commit-SHA steht nicht hier, um keinen self-referential SHA-Loop zu erzeugen; er wird nach stabilem Commit im externen Handoff dokumentiert.

## Nächster optimaler Schritt

Nach diesem Schritt kann als nächster kleiner Sicherheits-/Stabilitätsschritt ein gezieltes Inventar der übrigen Supabase Edge Functions erfolgen, die noch nicht im JWT/CORS-Admin-Satz klassifiziert wurden, insbesondere `list-therapy-pseudonyms`, `generate-diagnoses`, `extract-lab-image` und `enrich-wiki-tags`. Ziel: statisch klären, ob weitere Functions Service-Role/Admin-Charakter haben und analog `verify_jwt`/CORS-Härtung brauchen, ohne Live-Aufrufe und ohne Patienten-/Anamnesedaten.
