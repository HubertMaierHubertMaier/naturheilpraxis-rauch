# Phase 4 – Public-Route-Smoke-Test und Smoke-Test-Helfer

Datum/Zeit: 2026-06-05 12:39 CEST
Branch: `stabilization/phase-1-vitest-baseline`
Ausgangs-HEAD: `106836b test: stabilize app smoke test warnings`

## Ziel

Nächster kleiner sicherer Stabilisierungsschritt nach Phase 3:

- Teststruktur für App-Smoke-Tests entduplizieren.
- Einen weiteren öffentlichen Routen-Smoke-Test ergänzen.
- Keine echten Patientendaten verwenden.
- Keine Devserver starten und keine belegten Ports verwenden.
- Kein Push zu GitHub/Lovable.

## Port-/Runtime-Schutz

Es wurde kein Devserver gestartet.

Vor Arbeitsbeginn wurde die Portbelegung mit `ss -ltnp` geprüft. Belegt waren unter anderem:

- `80`
- `443`
- `8000`
- `8080`
- `4321`
- `8443`
- `3001`
- `9090`

Die Vite-Konfiguration verwendet weiterhin Port `8080`; dieser war belegt. Deshalb wurde bewusst kein `npm run dev` ausgeführt.

## Pre-Step-ShadowCopy

Erstellt vor substantiellen Änderungen:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260605-123737_pre-phase-4-public-route-smoke-helper`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260605-123737_pre-phase-4-public-route-smoke-helper/SHADOWCOPY_MANIFEST.md`

## TDD-Ablauf

### RED

Neu geschrieben:

- `src/test/appSmokeTestUtils.tsx`
- `src/test/app-public-routes-smoke.test.tsx`

Fokussierter RED-Befehl:

```bash
npx vitest run src/test/app-public-routes-smoke.test.tsx
```

Ergebnis:

```text
Test Files  1 failed (1)
Tests  1 failed (1)
Unable to find an accessible element with the role "main" and name `/Datenschutz/i`
```

Bewertung: sinnvoller RED-Zustand. Die Datenschutz-Seite rendert zwar den erwarteten `h1`, aber der zentrale `main`-Landmark war noch nicht eindeutig per Accessible Name auffindbar.

### GREEN

Minimaler Produktions-Fix:

- `src/pages/Datenschutz.tsx`
  - `Layout` von `<Layout>` auf `<Layout mainAriaLabel="Datenschutz">` geändert.

Fokussierter GREEN-Befehl:

```bash
npx vitest run src/test/app-public-routes-smoke.test.tsx
```

Ergebnis:

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

### REFACTOR

Nach GREEN wurde der bestehende Startseiten-Smoke-Test auf den neuen Helfer umgestellt:

- `src/test/app-startpage-smoke.test.tsx`
  - nutzt jetzt `renderAppAtRoute("/")`
  - nutzt jetzt `expectNoAppSmokeConsoleWarnings()`
  - setzt nach jedem Test den Pfad zurück auf `/`

Refactor-Verifikation:

```bash
npx vitest run src/test/app-startpage-smoke.test.tsx src/test/app-public-routes-smoke.test.tsx
```

Ergebnis:

```text
Test Files  2 passed (2)
Tests  2 passed (2)
```

## Lokale Gates

### `npm test`

```text
Test Files  3 passed (3)
Tests  3 passed (3)
Exit-Code: 0
```

### `npm run build`

```text
✓ 3326 modules transformed.
✓ built in 5.03s
Exit-Code: 0
```

Bekannte nicht-blockierende Warnung bleibt bestehen:

```text
Some chunks are larger than 500 kB after minification.
```

### `npx tsc --noEmit`

```text
Exit-Code: 0
```

### `npm run lint`

```text
Exit-Code: 1
✖ 332 problems (300 errors, 32 warnings)
```

Bewertung: bekannte Lint-Baseline unverändert. Der Schritt verschlechtert die Lint-Zahl nicht und wird nicht als Blocker behandelt.

## Geänderte Dateien

- `src/pages/Datenschutz.tsx`
- `src/test/appSmokeTestUtils.tsx`
- `src/test/app-public-routes-smoke.test.tsx`
- `src/test/app-startpage-smoke.test.tsx`
- `doc/20260605-phase-4-public-route-smoke-helper.md`

## Datenschutz-/Patientendaten-Hinweis

Es wurden keine echten Patientendaten oder Anamnese-Daten erzeugt, geloggt oder in Tests eingebaut. Der neue Smoke-Test prüft ausschließlich öffentliche Seiteninhalte der Datenschutz-Seite und allgemeine Accessibility-Struktur.

## Commit

Lokaler Commit nach erfolgreicher Prüfung:

```text
test: add privacy route smoke coverage
```

Hinweis: Die finale Kurz-SHA wurde nach dem Amend mit `git log --oneline -5` verifiziert. Kein Push ohne separate Freigabe.

## Nächster sinnvoller Schritt nach dieser Phase

Nach Commit und Post-Step-ShadowCopy: einen weiteren kleinen öffentlichen Route-Smoke-Test ergänzen, bevorzugt `/impressum`, oder alternativ zuerst die App-Smoke-Test-Helfer noch stärker absichern, falls bei weiteren Routen wieder Provider-/Router-Warnungen auftreten.
