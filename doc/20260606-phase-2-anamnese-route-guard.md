# Phase 2 — AnamneseRouteGuard Zugriffskontrollen

## Zeitpunkt

- Datum: 2026-06-06
- Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `aad131b`

## Ziel

Dieser Schritt stabilisiert den Phase-2-Themenbereich „uneinheitliche Zugriffskontrollen“ rund um den sensiblen Anamnese-Zugang.

Abgesichert wurde das Verhalten von:

```text
src/components/AnamneseRouteGuard.tsx
```

## Sicherheits- und Patientendatenregeln

- Keine echten Patientendaten verwendet.
- Keine Anamnese-Inhalte, keine Testpatienten und keine Formulareingaben in Tests oder Logs.
- Keine Änderung an Supabase, Edge Functions, Datenbank oder `.env`.
- Kein Push, kein PR, kein Merge.
- Kein lokaler Dev-/Preview-Server gestartet.

## Portprüfung

Vor Arbeitsbeginn wurde die Portlage geprüft, weil parallel ein weiteres Projekt läuft.

Belegte relevante Ports u. a.:

```text
80, 443, 3001, 4321, 8000, 8080, 8443, 9090
```

Freie Kandidaten für spätere Vite-Tests:

```text
4173, 4174, 5173, 5174, 5180, 5181, 3000
```

Für diesen Schritt wurde kein Port belegt.

## Pre-Step-ShadowCopy

Vor der Änderung wurde eine lokale ShadowCopy erstellt:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-090050_pre-phase-2-anamnese-route-guard-tdd
```

Manifest:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-090050_pre-phase-2-anamnese-route-guard-tdd/SHADOWCOPY_MANIFEST.md
```

## TDD RED

Neu erstellt:

```text
src/test/anamnese-route-guard-smoke.test.tsx
```

Getestete Fälle:

1. Loading-Zustand während Prüfung der public-access-Einstellung:
   - Erwartung: zugänglicher Status `Anamnese-Zugriff wird geprüft`.
   - Geschützter Inhalt wird währenddessen nicht angezeigt.
2. Public enabled:
   - Anamnese-Kindinhalt ist ohne Login sichtbar.
   - Keine Auth-Weiterleitung.
3. Public disabled:
   - Fallback auf `ProtectedRoute`.
   - Nicht eingeloggter Nutzer wird nach `/auth` geleitet.
   - Ursprüngliche Zielroute bleibt in `location.state.from` erhalten.

Fokussierter RED-Befehl:

```sh
npx vitest run src/test/anamnese-route-guard-smoke.test.tsx
```

RED-Ergebnis:

```text
Test Files  1 failed (1)
Tests       1 failed | 2 passed (3)
```

Erwartete Fehlerursache:

```text
Unable to find an accessible element with the role "status" and name `/Anamnese-Zugriff wird geprüft/i`
```

Der Test bewies damit, dass der Loading-Zustand bisher keinen zugänglichen Status hatte.

## GREEN

Minimaler Produktivcode-Fix in:

```text
src/components/AnamneseRouteGuard.tsx
```

Änderung:

- `role="status"`
- `aria-label="Anamnese-Zugriff wird geprüft"`
- Spinner mit `aria-hidden="true"`

Keine Änderung an der eigentlichen Zugriffskontroll-Entscheidung:

```text
loading → Status
public enabled → children
public disabled → ProtectedRoute
```

## GREEN-Verifikation

Fokussierter Test:

```text
npx vitest run src/test/anamnese-route-guard-smoke.test.tsx
```

Ergebnis:

```text
Test Files  1 passed (1)
Tests       3 passed (3)
Exit-Code: 0
```

Gesamttest:

```text
npm test
```

Ergebnis:

```text
Test Files  5 passed (5)
Tests       9 passed (9)
Exit-Code: 0
```

## Lokale Gates

### `npm run build`

```text
✓ 3309 modules transformed.
✓ built in 4.74s
Exit-Code: 0
```

Bekannte nicht-blockierende Warnungen:

```text
Browserslist/caniuse-lite ist veraltet.
Some chunks are larger than 500 kB after minification.
```

### `npx tsc --noEmit`

```text
Exit-Code: 0
```

### `npm run lint`

```text
✖ 332 problems (300 errors, 32 warnings)
LINT_EXIT=1
LINT_COUNTS problems=332 errors=300 warnings=32
```

Bewertung:

- Lint bleibt bekannte Bestandsschuld.
- Anzahl unverändert.
- Neue/geänderte Dateien wurden zusätzlich isoliert geprüft:

```sh
npx eslint src/components/AnamneseRouteGuard.tsx src/test/anamnese-route-guard-smoke.test.tsx
```

Ergebnis: kein Output, Exit-Code 0.

## Geänderte Dateien

```text
M  src/components/AnamneseRouteGuard.tsx
A  src/test/anamnese-route-guard-smoke.test.tsx
A  doc/20260606-phase-2-anamnese-route-guard.md
```

## Bewertung

Der Anamnese-Zugang ist jetzt testseitig klarer abgesichert:

- public access enabled: frei zugänglich ohne Login,
- public access disabled: geschützter Zugriff via Auth-Redirect,
- loading state: zugänglich benannt und testbar.

Das reduziert Risiko bei späteren Arbeiten an `Anamnesebogen.tsx`, `Header.tsx`, public-access-Konfiguration und zugehörigen Supabase-/Edge-Function-Flows.

## Nächster priorisierter Vorschlag

Phase 2 sollte als nächstes eine kleine Bestandsaufnahme zur Dateigröße und Komplexität dokumentieren, bevor große Dateien refactored werden:

1. LOC-/Dateigrößenbericht für `src/` und `supabase/functions/` erstellen.
2. Top-Kandidaten priorisieren:
   - `src/components/admin/TherapyRecommendation.tsx`
   - `src/lib/pdfExportEnhanced.ts`
   - `supabase/functions/therapy-recommend/index.ts`
   - `src/pages/Anamnesebogen.tsx`
   - `src/pages/Auth.tsx`
3. Für den ersten Refactor-Kandidaten erst Sicherheitsnetz/Tests definieren, dann kleine Extraktion.
