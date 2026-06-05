# Phase 3 – Testausgabe stabilisieren: AuthProvider-act und React-Router-Future-Warnungen

Datum: 2026-06-05
Branch: `stabilization/phase-1-vitest-baseline`
Remote: `https://github.com/reddy67/naturheilpraxis-rauch.git`

## Ziel

Nächster kleiner Stabilisierungsschritt nach Phase 2: Die Vitest-Ausgabe des Startseiten-Smoke-Tests soll sauberer und regressionssicherer werden.

Fokus:

- vorhandene `AuthProvider`-`act(...)`-Warnung nicht weiter akzeptieren,
- vorhandene React-Router-v7-Future-Flag-Warnungen gezielt abschalten,
- keine echten Patientendaten oder Anamnese-Testdaten verwenden,
- keinen Devserver starten und keine Ports belegen.

## Port-Hygiene

Vor dem Schritt wurde die Portbelegung geprüft. Es wurde kein `npm run dev` gestartet.

Relevante belegte Ports laut `ss -ltnp`:

- `0.0.0.0:8000`
- `0.0.0.0:8080`
- `0.0.0.0:4321`
- `0.0.0.0:8443`
- außerdem jeweilige IPv6-Listener für mehrere dieser Ports

Projektkonfiguration in `vite.config.ts`:

- `server.host: "::"`
- `server.port: 8080`

Konsequenz: Port `8080` ist belegt und darf für dieses Projekt nicht ungeprüft verwendet werden. Für spätere Browser-/Devserver-Prüfungen muss vorher erneut geprüft und ein expliziter freier `127.0.0.1`-Port mit `--strictPort` gewählt werden.

## Ausgangsstand

Vor Änderungen:

- Arbeitsverzeichnis: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-1-vitest-baseline`
- Git-Status: sauber
- HEAD: `34383ce test: add start page smoke test`
- letzte Commits:
  - `34383ce test: add start page smoke test`
  - `cb9bb55 fix: move css import before tailwind directives`
  - `610a5da fix: align vitest with existing react plugin`
  - `324d2ce docs: add stabilization audit and baseline plan`
  - `5448b51 Markdown-Renderer ergänzt`

## Pre-Step-ShadowCopy

Erstellt vor der Änderung:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260605-123119_pre-phase-3-authprovider-act-warning`

Manifest:

`/home/klaus999/project-backups/naturheilpraxis-rauch/20260605-123119_pre-phase-3-authprovider-act-warning/SHADOWCOPY_MANIFEST.md`

Manifest-Auszug:

- `created_at: 2026-06-05T12:31:19+02:00`
- `head: 34383cefcbb1bbcf61fe1388a9d6155a075bc6ea`
- `head_short: 34383ce`
- `last_commit: 34383ce test: add start page smoke test`
- `port_check_before_step: no dev server started; 8080/8000/4321/8443 occupied`
- `excluded: node_modules, dist, .git`
- `file_count: 388`

## Root-Cause-Prüfung

Die vorherige Testwarnung entstand aus asynchronen Provider-/Router-Nebeneffekten nach `render(<App />)`:

- `AuthProvider` startet im `useEffect` eine asynchrone Supabase-Session-Initialisierung und setzt anschließend State.
- Der bisherige Smoke-Test prüfte nur synchron direkt nach `render`.
- Dadurch konnten asynchrone Provider-Updates außerhalb der sichtbaren Testassertions Warnungen erzeugen.
- React Router warnte zusätzlich, weil die v7-Future-Flags noch nicht gesetzt waren.

## TDD-Protokoll

### RED

Der vorhandene Startseiten-Smoke-Test wurde erweitert, sodass er Warnungen explizit als Regression absichert:

- `console.error` wird im Test beobachtet und darf keine `not wrapped in act`-Warnung enthalten.
- `console.warn` wird im Test beobachtet und darf keine `React Router Future Flag Warning` enthalten.
- Nach `render(<App />)` werden ausstehende Auth-Nebeneffekte mit einem kurzen `setTimeout(0)`-Flush abgewartet.

RED-Befehl:

`npx vitest run src/test/app-startpage-smoke.test.tsx`

Ergebnis: erwarteter Fehler wegen React-Router-Future-Flag-Warnungen.

Relevante Fehlermeldung:

`expected "warn" to not be called with arguments: [ StringContaining "React Router Future Flag Warning" ]`

Empfangene Warnungen:

- `React Router will begin wrapping state updates in React.startTransition in v7`
- `Relative route resolution within Splat routes is changing in v7`

### GREEN

Minimale Anpassung:

- `src/App.tsx`
  - `BrowserRouter` erhält die dokumentierten Future Flags:
    - `v7_startTransition: true`
    - `v7_relativeSplatPath: true`

Änderung:

`<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>`

GREEN-Befehl:

`npx vitest run src/test/app-startpage-smoke.test.tsx`

Ergebnis:

- `Test Files 1 passed (1)`
- `Tests 1 passed (1)`
- keine React-Router-Future-Flag-Warnungen mehr in der Ausgabe
- keine `AuthProvider`-`act(...)`-Warnung mehr in der Ausgabe

## Vollständige lokale Gates

### npm test

Befehl:

`npm test`

Ergebnis:

- Exit-Code: `0`
- `Test Files 2 passed (2)`
- `Tests 2 passed (2)`
- Ausgabe sauberer als vorher: keine React-Router-Future-Flag-Warnungen und keine `AuthProvider`-`act(...)`-Warnung sichtbar.

### npm run build

Befehl:

`npm run build`

Ergebnis:

- Exit-Code: `0`
- `✓ 3326 modules transformed.`
- `✓ built in 4.98s`

Bekannte nicht-blockierende Build-Warnung bleibt:

- `Some chunks are larger than 500 kB after minification`
- größter Chunk laut Build: `dist/assets/index-B7qAQt6e.js 2,808.51 kB │ gzip: 795.00 kB`

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
- bekannte Bestandsschuld unverändert:
  - `✖ 332 problems (300 errors, 32 warnings)`
  - `1 error and 0 warnings potentially fixable with the --fix option.`

Lint wurde wie vereinbart als bekannte Baseline ausgeführt und nicht als Blocker behandelt, solange die Zahl nicht schlechter wird.

## Geänderte Dateien

- `src/App.tsx`
  - React Router Future Flags am `BrowserRouter` gesetzt.
- `src/test/app-startpage-smoke.test.tsx`
  - Startseiten-Smoke-Test um explizite Warnungs-Regressionen für `act(...)` und React-Router-Future-Flags erweitert.
- `doc/20260605-phase-3-test-output-stabilization.md`
  - Dieses Statusdokument.

## Nächster sinnvoller Schritt

Priorisiert und klein:

1. Einen kleinen Testinfra-Helfer für wiederkehrende App-Smoke-Test-Patterns prüfen, damit Console-Spies/Flushes nicht in jedem Test dupliziert werden müssen.
2. Danach mit einem zweiten öffentlichen Routen-Smoke-Test fortfahren, z.B. für `/impressum` oder `/datenschutz`, ohne Patientendaten und ohne Devserver.
3. Lint-Schuld weiterhin separat und strukturiert abbauen, nicht mit Testinfra-Smoke-Schritten vermischen.
