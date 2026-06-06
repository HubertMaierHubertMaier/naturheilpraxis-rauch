# Phase 3 — Datensicherheit: Dev-Admin-Bypass-Härtung

Stand: 2026-06-06 19:42:22 CEST (+0200)

## Ziel

Phase-3-Punkt 3.4 risikoarm und testgestützt härten: Der clientseitige Dev-Admin-Bypass darf nicht mehr auf Lovable-Preview-/Preview-Hosts oder beliebigen nicht-lokalen Hosts aktivierbar sein.

Dieser Schritt ist bewusst klein gehalten und berührt keine Supabase Edge Functions, keine Patientendaten-Flows und keine Anamnesebogen-Submission.

## Port-/Parallel-Session-Disziplin

Vor Beginn wurden lokale Listener und Vite-Standardports geprüft, weil parallel eine weitere Hermes Session auf derselben Hardware laufen kann.

Geprüfte Vite-Ports vor Arbeit:

```text
port_5173=free
port_4173=free
port_5174=free
port_4174=free
```

Für diesen Schritt wurde kein Dev-/Preview-Server gestartet. Daher wurde kein Port belegt und nichts musste freigegeben werden.

Nach den Gates erneut geprüft:

```text
port_5173=free
port_4173=free
port_5174=free
port_4174=free
```

## Branch und Ausgangspunkt

- Branch: `stabilization/phase-3-data-security-env-hygiene`
- Ausgangs-HEAD vor diesem Schritt: `8e8600e7ddae465d5694482908d0cbc0d58bd0a2`
- Enthält bereits den vorherigen Phase-3-Schritt `.env`-Hygiene.

Hinweis: Der Branchname ist nach dem zweiten Security-Schritt etwas enger als der tatsächliche Inhalt. Es wurde dennoch auf demselben lokalen Phase-3-Security-Branch weitergearbeitet, um keine bereits getesteten lokalen Security-Commits unnötig zu verzweigen. Kein Push/PR/Merge wurde ausgeführt.

## Vorheriges Risiko

`src/lib/devAdminBypass.ts` erlaubte Dev-Admin-Bypass bisher für:

- `import.meta.env.DEV`,
- Hostnamen mit `preview`,
- Hostnamen mit `lovableproject.com`,
- Hostnamen mit `localhost`,
- ausgenommen explizit publizierte Produktionsdomains.

Dadurch konnte der Admin-Bypass auf Preview-/Lovable-Projekt-Hosts und potentiell auf nicht-lokalen Dev-Hosts aktiv werden.

## Änderung

Neue Pure-Policy-Funktion:

```ts
isDevAdminBypassAllowedHost(hostname: string, isDevBuild: boolean)
```

Policy nach Änderung:

- erlaubt nur lokale Vite-Development-Hosts:
  - `localhost`
  - `127.0.0.1`
  - `::1`
- nur wenn `isDevBuild === true`, also `import.meta.env.DEV`.
- blockiert Lovable-/Preview-/Produktionshosts.
- blockiert nicht-lokale Netzwerkhosts auch bei Dev-Build.
- blockiert lokale Production-Preview-Builds (`npm run build && npm run preview`), weil das kein Entwicklungs-Bypass-Kontext sein soll.

Geänderte Dateien:

- `src/lib/devAdminBypass.ts`
- `src/test/dev-admin-bypass-security.test.ts`
- dieses Statusdokument

## TDD RED/GREEN

RED vor Produktivänderung:

```text
npx vitest run src/test/dev-admin-bypass-security.test.ts
Exit 1
4 failed
TypeError: isDevAdminBypassAllowedHost is not a function
```

GREEN nach minimaler Produktivänderung:

```text
npx vitest run src/test/dev-admin-bypass-security.test.ts
Exit 0
1 Test File passed
4 Tests passed
```

Zusätzliche fokussierte Regression:

```text
npx vitest run src/test/dev-admin-bypass-security.test.ts src/test/protected-route-smoke.test.tsx src/test/anamnese-route-guard-smoke.test.tsx src/test/header-anamnese-navigation-smoke.test.tsx
Exit 0
4 Test Files passed
13 Tests passed
```

Isolierter Lint für geänderte TS-Dateien:

```text
npx eslint src/lib/devAdminBypass.ts src/test/dev-admin-bypass-security.test.ts
Exit 0
```

## Vollständige lokale Gates

```text
npm test
Exit 0
11 Test Files passed
24 Tests passed
```

```text
npx tsc --noEmit
Exit 0
```

```text
npm run build
Exit 0
3309 modules transformed
built in 4.86s
```

```text
npm run lint
Exit 1
327 problems: 295 errors, 32 warnings
```

`npm run lint` bleibt wegen bekannter Legacy-Schuld rot. Der isolierte Lint der geänderten Dateien ist grün, und die bekannte Gesamtzahl hat sich nicht erhöht.

## Backups

Pre-Step ShadowCopy:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-194105_pre-phase-3-dev-admin-bypass-hardening
```

Post-Step ShadowCopy wird nach lokalem Commit erstellt.

## Patientendaten-/Secret-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine Anamnese-Formulardaten eingegeben.
- Keine Supabase Function live aufgerufen.
- Keine Screenshots oder Logs mit Patientenbezug erzeugt.
- Lokale `.env` bleibt ignoriert und wurde nicht kopiert/veröffentlicht.

## Restliche Phase-3-Punkte

Noch offen und separat zu behandeln:

1. 3.2 `verify_jwt=false` bei Edge Functions
   - zuerst inventarisieren und öffentliche vs. admin-only Functions trennen.
   - nicht pauschal umstellen, um öffentliche Verification-/Submission-Flows nicht blind zu brechen.
2. 3.3 CORS `*`
   - pro Function und erlaubtem Origin-Set härten.
   - öffentliche Verification-/Submission-Flows benötigen gesonderte Entscheidung.

## Lokaler Release-Status

- Kein Push.
- Kein PR.
- Kein Merge.
- Keine Lovable-Live-Änderung.
