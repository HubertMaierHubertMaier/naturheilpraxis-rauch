# Phase 2 — ProtectedRoute Redirect ohne User

## Zeitpunkt

- Datum: 2026-06-06
- Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `7a76c155207e10e2c7f1d81ae5eb22d22f3a1b8b`

## Kontext

Phase 1 ist auf `main` gemerged und Lovable Live wurde zuvor verifiziert. Phase 2 läuft lokal weiter auf dem Branch `stabilization/phase-2-testid-and-security-baseline`.

Dieser Schritt gehört zum Themenbereich uneinheitliche Zugriffskontrollen. Ziel war, das bestehende `ProtectedRoute`-Redirect-Verhalten für nicht eingeloggte Besucher als Regressionstest abzusichern.

## Sicherheits- und Patientendatenregeln

- Keine echten Patientendaten verwendet.
- Keine Anamnesedaten in Tests, Logs oder Screenshots eingebaut.
- Keine Änderung an Supabase, Edge Functions, Datenbank, `.env` oder produktiven Patientendaten-Flows.
- Kein Push, kein Pull Request, kein Merge.
- Kein lokaler Dev-/Preview-Server gestartet.

## Portprüfung

Vor Arbeitsbeginn wurde die lokale Portlage geprüft, weil parallel ein weiteres Projekt läuft.

Belegte relevante Ports u. a.:

```text
80, 443, 3001, 4321, 8000, 8080, 8443, 9090
```

Freie Kandidaten für spätere Vite-Tests:

```text
4173, 4174, 5173, 5174, 5180
```

Für diesen Schritt wurde kein Port belegt.

## Pre-Step-ShadowCopy

Vor der Änderung wurde eine lokale ShadowCopy erstellt:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-084214_pre-phase-2-protected-route-redirect-tdd
```

Manifest:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-084214_pre-phase-2-protected-route-redirect-tdd/SHADOWCOPY_MANIFEST.md
```

## TDD-/Charakterisierungsschritt

Neue Testabdeckung in:

```text
src/test/protected-route-smoke.test.tsx
```

Getestetes Verhalten:

- nicht eingeloggter Nutzer (`user: null`, `loading: false`) besucht `/erstanmeldung?termin=erstgespraech#formular`,
- `ProtectedRoute` rendert den geschützten Inhalt nicht,
- Routing geht nach `/auth`,
- die ursprüngliche Zielroute bleibt in `location.state.from` erhalten:
  - `pathname`: `/erstanmeldung`
  - `search`: `?termin=erstgespraech`
  - `hash`: `#formular`

### RED-Verifikation

Fokussierter Testbefehl:

```sh
npx vitest run src/test/protected-route-smoke.test.tsx
```

Ergebnis nach Hinzufügen des Tests:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
Exit-Code: 0
```

Bewertung:

Der Test wurde nicht rot, weil das gewünschte Redirect-Verhalten im Produktivcode bereits korrekt vorhanden war:

```tsx
return <Navigate to="/auth" state={{ from: location }} replace />;
```

Deshalb wurde keine künstliche Produktivcode-Änderung vorgenommen. Der Schritt ist hier bewusst als Charakterisierungs-/Regressionstest dokumentiert, nicht als erzwungener Code-Fix. Das verhindert unnötige Änderungen an auth-naher Logik.

## GREEN-Verifikation

Fokussierter Test:

```text
npx vitest run src/test/protected-route-smoke.test.tsx
```

Ergebnis:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
Exit-Code: 0
```

## Lokale Gates

### `npm test`

```text
Test Files  4 passed (4)
Tests       6 passed (6)
Exit-Code: 0
```

### `npm run build`

```text
vite v5.4.19 building for production...
✓ 3309 modules transformed.
✓ built in 4.89s
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
- Anzahl unverändert zur Phase-2-Baseline.
- Der neue Test verschlechtert die Lint-Baseline nicht.

## Geänderte Dateien

```text
M  src/test/protected-route-smoke.test.tsx
A  doc/20260606-phase-2-protected-route-redirect.md
```

## Bewertung

Dieser Schritt verbessert die Testabdeckung für Zugriffskontrollen, ohne produktive Auth-Logik zu ändern:

- Redirect für unauthentifizierte Besucher ist jetzt als Regressionstest abgesichert.
- Ursprüngliches Ziel inklusive Query und Hash bleibt nachweislich in `location.state.from` erhalten.
- Keine sensiblen Daten oder digitalen Patienten-Flows betroffen.

## Nächster priorisierter Vorschlag

Als nächstes sollte Phase 2 weiterhin bei Zugriffskontrollen bleiben:

1. `AnamneseRouteGuard` public/private Verhalten testen:
   - public enabled → Kindinhalt ohne Login möglich,
   - public disabled → fällt auf `ProtectedRoute`/Auth-Redirect zurück.
2. Danach die größeren Dateien erfassen und priorisieren:
   - Dateigrößen-/LOC-Auswertung,
   - Kandidaten für spätere risikoarme Extraktion,
   - keine große Datei ohne vorheriges Sicherheitsnetz refactoren.
