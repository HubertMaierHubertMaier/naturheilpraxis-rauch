# Phase 2 – Startseiten-Smoke-Test

Datum: 2026-06-04
Branch: `stabilization/phase-1-vitest-baseline`
Remote: `https://github.com/reddy67/naturheilpraxis-rauch.git`

## Ziel

Kleiner sicherer Stabilisierungsschritt nach TDD: Ein App-/Startseiten-Smoke-Test soll absichern, dass die öffentliche Startseite der React/Vite-App lokal rendert und zentrale öffentliche Startseiten-Inhalte erreichbar sind.

Keine Patientendaten oder Anamnese-Testdaten wurden angelegt, geloggt oder committed.

## Vorab-Verifikation

Ausgangsstand:

- Arbeitsverzeichnis: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-1-vitest-baseline`
- `git status --short --branch`: sauber
- Letzte Commits laut `git log --oneline -5`:
  - `cb9bb55 fix: move css import before tailwind directives`
  - `610a5da fix: align vitest with existing react plugin`
  - `324d2ce docs: add stabilization audit and baseline plan`
  - `5448b51 Markdown-Renderer ergänzt`
  - `f93b5d9 Changes`
- Node: `v20.20.0`
- npm: `10.8.2`

## Pre-Step-ShadowCopy

Erstellt vor der Änderung:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260604-231938_pre-phase-2-startpage-smoke-test`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260604-231938_pre-phase-2-startpage-smoke-test/SHADOWCOPY_MANIFEST.md`

Manifest-Auszug:

- `created_at: 2026-06-04T23:19:38+02:00`
- `source: /home/klaus999/projects/naturheilpraxis-rauch`
- `head: cb9bb5565d57f7c2c123b8a0eaec6098163d9872`
- `excluded: node_modules, dist, .git`
- `file_count: 386`

## Teststruktur

Vorhandene Vitest-Struktur:

- `vitest.config.ts`
  - `environment: "jsdom"`
  - `setupFiles: ["./src/test/setup.ts"]`
  - `include: ["src/**/*.{test,spec}.{ts,tsx}"]`
  - Alias `@` auf `./src`
- `src/test/setup.ts`
  - importiert `@testing-library/jest-dom`
  - mockt `window.matchMedia`
- bestehender Basistest: `src/test/example.test.ts`

## TDD-Protokoll

### RED

Neu angelegt:

`src/test/app-startpage-smoke.test.tsx`

Der Test rendert `App` und erwartet:

- H1 `Ganzheitliche Heilkunde für Körper und Seele`
- die drei Startseiten-Auswahlbuttons:
  - `Ich bin Neupatient`
  - `Ich bin schon Patient`
  - `Ich möchte mich informieren`
- einen benannten Main-Landmark `Startseite`

RED-Befehl:

`npx vitest run src/test/app-startpage-smoke.test.tsx`

Ergebnis: erwarteter Fehler, weil der vorhandene `<main>`-Landmark noch keinen zugänglichen Namen hatte.

Relevante Fehlermeldung:

`Unable to find an accessible element with the role "main" and name /Startseite/i`

### GREEN

Minimale Anpassung:

- `src/components/layout/Layout.tsx`
  - `LayoutProps` um optionales `mainAriaLabel?: string` erweitert
  - `<main>` erhält `aria-label={mainAriaLabel}`
- `src/pages/Index.tsx`
  - Startseite nutzt `<Layout mainAriaLabel="Startseite">`

GREEN-Befehl:

`npx vitest run src/test/app-startpage-smoke.test.tsx`

Ergebnis:

- `Test Files 1 passed (1)`
- `Tests 1 passed (1)`

Hinweis: Der Testlauf zeigt weiterhin nicht-blockierende bestehende Warnungen zu React Router Future Flags und eine `act(...)`-Warnung aus `AuthProvider`. Diese Warnungen wurden in diesem kleinen Schritt nicht verändert und sollten separat stabilisiert werden.

## Vollständige lokale Gates

### npm test

Befehl:

`npm test`

Ergebnis:

- Exit-Code: `0`
- `Test Files 2 passed (2)`
- `Tests 2 passed (2)`

Weiterhin sichtbare nicht-blockierende Test-Warnungen:

- React Router Future Flag Warnings für v7
- `Warning: An update to AuthProvider inside a test was not wrapped in act(...)`

### npm run build

Befehl:

`npm run build`

Ergebnis:

- Exit-Code: `0`
- `✓ 3326 modules transformed.`
- `✓ built in 5.65s`

Weiterhin sichtbare bekannte Build-Warnung:

- Chunk-Größe: `Some chunks are larger than 500 kB after minification`
- Größter Chunk laut Build: `dist/assets/index-CJDRqu8m.js 2,808.46 kB │ gzip: 794.96 kB`

### TypeScript

Befehl:

`npx tsc --noEmit`

Ergebnis:

- Exit-Code: `0`

### Lint-Baseline

Befehl:

`npm run lint`

Ergebnis:

- Exit-Code: `1`
- Bekannte Bestandsschuld unverändert laut Zusammenfassung:
  - `✖ 332 problems (300 errors, 32 warnings)`
  - `1 error and 0 warnings potentially fixable with the --fix option.`

Lint wurde wie vereinbart als Baseline ausgeführt und nicht als Blocker behandelt, solange die bekannte Zahl nicht schlechter wird.

## Geänderte Dateien

- `src/test/app-startpage-smoke.test.tsx`
  - Neuer App-/Startseiten-Smoke-Test.
- `src/components/layout/Layout.tsx`
  - Optionales `mainAriaLabel` für den Main-Landmark.
- `src/pages/Index.tsx`
  - Startseite setzt `mainAriaLabel="Startseite"`.
- `doc/20260604-phase-2-startpage-smoke-test.md`
  - Dieses Statusdokument.

## Nächster sinnvoller Schritt

Priorisiert und klein:

1. Die nicht-blockierende Test-Warnung aus `AuthProvider` isoliert stabilisieren, damit Vitest-Ausgaben sauberer werden.
2. Danach optional React-Router-v7-Future-Flag-Warnungen bewusst konfigurieren oder als dokumentierte Baseline belassen.
3. Lint-Schuld weiterhin separat strukturiert und phasenweise abbauen, nicht vermischt mit Smoke-Test-Stabilisierung.
