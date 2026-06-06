# Phase 2 — ProtectedRoute Smoke-Test und barrierefreier Loading-Status

## Zeitpunkt

- Datum: 2026-06-06
- Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `18514c3bdfdcb2488e9fffbf7a201879b3f5e00e`

## Ziel

Erster kleiner lokaler Phase-2-Schritt nach dem erfolgreichen Phase-1-Merge nach `main` und Lovable-Live-Nachweis.

Ziel war, das Testsystem vorsichtig weiter auszubauen und eine sicherheits-/auth-nahe Route mit einem fokussierten Smoke-Test abzusichern.

## Sicherheits- und Patientendatenregeln

- Keine echten Patientendaten verwendet.
- Keine Anamnesedaten in Tests, Logs oder Screenshots eingebaut.
- Kein Devserver gestartet.
- Kein Push, kein Pull Request, kein Merge.

## Pre-Phase-2-ShadowCopy

Vor Änderungen wurde eine lokale ShadowCopy erstellt:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-001915_pre-phase-2-local-testsystem-security-baseline
```

Manifest:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-001915_pre-phase-2-local-testsystem-security-baseline/SHADOWCOPY_MANIFEST.md
```

## TDD-Ablauf

### RED

Neue Testdatei:

```text
src/test/protected-route-smoke.test.tsx
```

Fokussierter Test:

- rendert `ProtectedRoute` im Loading-Zustand,
- erwartet einen zugänglichen Statusbereich mit `role="status"`,
- erwartet den Namen `Authentifizierung wird geprüft`,
- stellt sicher, dass geschützter Inhalt während Loading nicht gerendert wird.

RED-Befehl:

```sh
npx vitest run src/test/protected-route-smoke.test.tsx
```

RED-Ergebnis:

```text
1 failed
Unable to find an accessible element with the role "status" and name `/Authentifizierung wird geprüft/i`
```

Ursache:

Der bisherige Loading-Spinner war visuell vorhanden, aber nicht als zugänglicher Status ausgezeichnet.

### GREEN

Minimaler Produktivcode-Fix:

Datei:

```text
src/components/ProtectedRoute.tsx
```

Änderung:

- Loading-Container erhält `role="status"`.
- Loading-Container erhält `aria-label="Authentifizierung wird geprüft"`.
- Spinner-Icon erhält `aria-hidden="true"`.

### GREEN-Verifikation

Fokussierter Test:

```text
npx vitest run src/test/protected-route-smoke.test.tsx
```

Ergebnis:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
Exit-Code: 0
```

Gesamte Test-Suite:

```text
npm test
```

Ergebnis:

```text
Test Files  4 passed (4)
Tests       5 passed (5)
Exit-Code: 0
```

## Weitere lokale Gates

### `npm run build`

```text
vite v5.4.19 building for production...
✓ 3309 modules transformed.
✓ built in 4.87s
Exit-Code: 0
```

Bekannte nicht-blockierende Hinweise:

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
Exit-Code: 1
```

Bewertung:

- Lint bleibt die bekannte Bestandsschuld-Baseline.
- Die Anzahl hat sich nicht verschlechtert.
- Der neue Test und die kleine `ProtectedRoute`-Änderung erzeugen keine neue Lint-Verschlechterung.

## Geänderte Dateien

```text
M  src/components/ProtectedRoute.tsx
A  src/test/protected-route-smoke.test.tsx
A  doc/20260606-phase-2-protected-route-smoke.md
```

## Bewertung

Dieser Schritt ist klein, lokal getestet und risikoarm:

- Auth-nahe Route erhält zusätzliche Testabdeckung.
- Loading-Zustand wird barriereärmer und testbar.
- Keine Patientendaten betroffen.
- Keine Deployment-/GitHub-/Lovable-Aktion erfolgt.

## Nächster priorisierter Vorschlag

Nach Commit dieses kleinen Schritts:

1. Post-Step-ShadowCopy erstellen.
2. Danach als nächsten Phase-2-TDD-Schritt `ProtectedRoute`-Redirect ohne User oder `AnamneseRouteGuard` public/private Verhalten testen.
3. Security-/Dependency-Audit danach strukturiert angehen, sobald die auth-/route-nahen Smoke-Tests als Sicherheitsnetz erweitert sind.
