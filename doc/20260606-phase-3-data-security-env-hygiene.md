# Phase 3 — Datensicherheit: `.env`-Hygiene

Stand: 2026-06-06 14:19:18 CEST (+0200)

## Ziel

Erster kleiner, risikoarmer Phase-3-Datensicherheitsschritt: lokal benötigte Environment-Dateien dürfen nicht mehr versioniert werden. Die bisher getrackte `.env` wird aus dem Git-Index entfernt, lokal aber erhalten. Stattdessen gibt es eine secretfreie `.env.example` als Vorlage.

Dieser Schritt adressiert Phase-3-Punkt 3.1:

- `.env` war versioniert.
- Enthaltene Schlüssel/URLs wurden in dieser Dokumentation bewusst nicht ausgeschrieben.
- Es wurden keine Supabase-Patientenflows, Edge Functions oder Live-Daten verändert.

## Wichtig: PR-/Handoff-Klarstellung

Der vorherige Hinweis auf ein PR-/Lovable-Handoff bedeutete nicht, dass Phase 3 inhaltlich abgeschlossen oder bereits PR-reif ist. Es war nur ein automatisch vorbereitetes Merge-Paket für einen kleinen lokalen Auth-Smoke-Zwischenschritt. Für diese Datensicherheitsphase gilt weiterhin:

- kein Push,
- kein PR,
- kein Merge,
- keine Lovable-Live-Änderung,
- weitere Phase-3-Security-Punkte bleiben offen.

## Branch und Ausgangspunkt

- Branch: `stabilization/phase-3-data-security-env-hygiene`
- Ausgangs-HEAD: `55f156a70cff93579e68b06d865283bdcb665a83`
- Basis: `main` / `origin/main` nach Phase-2-Merge

Die ältere lokale Branch `stabilization/phase-3-route-auth-triage` bleibt separat und wurde für diesen Security-Fix bewusst nicht weiterverwendet, weil die aktuelle Nutzerpriorität klar auf Phase 3 Datensicherheit liegt.

## Vorher verifizierte Phase-3-Befunde

- `.env` war mit `git ls-files` getrackt.
- `.env` enthielt u.a. Supabase-bezogene Key-Namen; Werte wurden nicht ausgegeben.
- `supabase/config.toml` enthält zehn Functions mit `verify_jwt = false`.
- Mehrere Edge Functions setzen CORS derzeit auf `Access-Control-Allow-Origin: *`.
- `src/lib/devAdminBypass.ts` erlaubt den Dev-Admin-Bypass u.a. auf Hosts mit `preview`, `lovableproject.com` und `localhost`.

## Priorisierung

Gewählter erster Fix: 3.1 `.env` ist versioniert.

Begründung:

- höchster Security-Hygiene-Gewinn bei sehr kleinem Änderungsumfang,
- keine Änderung an Patienten-/Anamnese-Logik,
- keine Änderung an Supabase Edge Functions,
- geringes Risiko für Lovable/Runtime,
- blockiert spätere versehentliche Secret-Commits.

Nicht in diesem Schritt geändert:

- 3.2 `verify_jwt=false` bei Edge Functions,
- 3.3 CORS `*`,
- 3.4 Dev-Admin-Bypass auf Preview-/Dev-Hosts.

Diese Punkte benötigen jeweils eigene kleine Charakterisierung, Test-/Check-Absicherung und vorsichtige Rollout-Entscheidung.

## Änderungen

- `.gitignore`
  - `.env` und `.env.*` werden ignoriert.
  - `.env.example` bleibt explizit erlaubt.
- `.env`
  - aus dem Git-Index entfernt (`git rm --cached .env`), lokal aber beibehalten.
  - Werte wurden nicht dokumentiert.
- `.env.example`
  - neue secretfreie Vorlage mit Platzhalterwerten.

## RED/GREEN-Check

RED vor Änderung:

```text
RED check tracked_env_empty=no
```

GREEN nach Änderung:

```text
tracked .env files removed: yes
.env.example exists: yes
.env.example has no obvious real project URL/id: yes
.gitignore protects local env files: yes
local .env preserved but ignored: yes
```

## Lokale Gates

```text
npm test
Exit 0
Test Files: 10 passed
Tests: 20 passed
```

```text
npx tsc --noEmit
Exit 0
```

```text
npm run build
Exit 0
3309 modules transformed
built in 4.76s
```

```text
npm run lint
Exit 1
327 problems: 295 errors, 32 warnings
```

Lint bleibt wegen bekannter Legacy-Schuld rot. Dieser Schritt fügt keine TypeScript-/React-Produktivdatei hinzu und verändert keine lint-pflichtige Code-Datei. Die bekannte Lint-Gesamtzahl entspricht dem bisherigen Baseline-Wert.

## Backups

Pre-Step ShadowCopy:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-141545_pre-phase-3-data-security-env-hygiene
```

Hinweis: Diese ShadowCopy spiegelt bewusst den Vorher-Zustand und kann die lokale `.env` enthalten. Nicht veröffentlichen.

Post-Step ShadowCopy wird nach lokalem Commit erstellt.

## Patientendaten-/Secret-Sicherheit

- Keine realen Patientendaten verwendet.
- Keine Anamnesebogen- oder Patientenflows ausgeführt.
- Keine Supabase-Function live aufgerufen.
- Keine Secrets in diese Dokumentation übernommen.
- `.env` bleibt lokal vorhanden, aber ist künftig ignoriert und nicht mehr versioniert.

## Nächste empfohlene Phase-3-Schritte

1. 3.4 Dev-Admin-Bypass fokussiert charakterisieren und härten, weil er Preview/Admin-Oberfläche betrifft und clientseitig überschaubar testbar ist.
2. Danach 3.2/3.3 Edge-Function-Security in einzelnen Function-Gruppen behandeln:
   - zuerst Inventar/Tests,
   - dann öffentliche Verification-/Submission-Flows von Admin-only Functions trennen,
   - CORS nicht pauschal ändern, sondern erlaubte Origins und erforderliche öffentliche Flows explizit festlegen.
