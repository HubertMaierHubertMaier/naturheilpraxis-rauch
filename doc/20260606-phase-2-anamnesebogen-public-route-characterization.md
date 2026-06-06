# Phase 2: Route-Level Characterization `/anamnesebogen` public-enabled anonymous

## Stand

- Datum: 2026-06-06
- Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `eeb74578a1044480a5daf584cd40c673b9043588`
- GitHub/Lovable: kein Push, kein PR, kein Merge.

## Ziel

Die zuvor dokumentierte Header-Auffälligkeit wurde auf Route-Level charakterisiert:

- `AnamneseRouteGuard` erlaubt bei public-enabled grundsätzlich anonymen Zugriff.
- Der Header zeigt für anonyme Besucher bei `anamneseEnabled=true` bisher den PDF-Download statt den Online-Link.
- Dieser Schritt prüft isoliert die reale App-Route `/anamnesebogen`, ohne Produktivcode zu ändern.

## Änderung

Neue Testdatei:

- `src/test/anamnesebogen-public-route-characterization.test.tsx`

Der Test rendert die reale App-Route `/anamnesebogen` mit kontrollierten Mocks:

- anonymer Nutzer (`user: null`),
- `useAnamnesePublic()` public-enabled,
- `useAnamneseEnabled()` enabled für Header-/Layout-Kontext,
- `AuthProvider` als ungefährlicher Test-Wrapper,
- `useContentProtection()` als No-op, damit keine Browser-Schutz-Seiteneffekte die Route-Charakterisierung verfälschen.

Geprüft wird:

- `window.location.pathname` bleibt `/anamnesebogen`,
- Heading `Anamnesebogen` erscheint,
- Online-Form-Auswahl `Wie möchten Sie das Formular ausfüllen?` erscheint,
- kein Guard-Loading `Anamnese-Zugriff wird geprüft`,
- kein verbleibendes Seiten-Loading `Wird geladen...`,
- keine relevanten App-Smoke-Console-Warnungen.

## Ergebnis / Charakterisierung

Der Test war sofort grün. Daher wurde kein künstlicher RED/GREEN-Produktivcode-Fix erzwungen.

Aktuell charakterisiertes Verhalten:

- Bei public-enabled ist die Route `/anamnesebogen` für anonyme Besucher online erreichbar.
- Die Online-Anamnesebogen-Oberfläche rendert bis zur Layout-Auswahl.
- Es erfolgt kein Auth-Redirect und kein Guard-Loading-Endzustand.
- Die zuvor dokumentierte Header-Inkonsistenz bleibt damit fachlich präziser eingegrenzt: Route-Level erlaubt anonymen Online-Zugang, während der Header anonym weiterhin den PDF-Link anbietet.

## Patientendaten-/DSGVO-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine Test-Formulardaten befüllt.
- Keine Submission, keine Verification, keine Supabase-Function-Auslösung.
- Keine unsicheren digitalen Patientendaten-Flows neu aktiviert.
- Produktivcode blieb unverändert.

## Verifikation

### Fokussierter Test

Befehl:

```sh
npx vitest run src/test/anamnesebogen-public-route-characterization.test.tsx
```

Ergebnis:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
Duration    1.96s
```

### Vollständige Testsuite

Befehl:

```sh
npm test
```

Ergebnis:

```text
Test Files  7 passed (7)
Tests       13 passed (13)
Duration    2.32s
```

### Build

Befehl:

```sh
npm run build
```

Ergebnis:

```text
3309 modules transformed
built in 4.84s
```

Bekannte nicht-blockierende Warnungen:

- Browserslist/caniuse-lite veraltet.
- Chunk-Größenwarnung: `index-C-ffOheS.js` größer als 500 kB nach Minification.

### TypeScript

Befehl:

```sh
npx tsc --noEmit
```

Ergebnis: Exit-Code 0, kein Output.

### Full Lint Baseline

Befehl:

```sh
npm run lint
```

Ergebnis weiterhin bekannte Bestandsschuld:

```text
332 problems (300 errors, 32 warnings)
```

Bewertung: nicht schlechter als dokumentierte Baseline, daher kein Blocker für diesen Characterization-Schritt.

### Isolierter ESLint-Check neue Datei

Befehl:

```sh
npx eslint src/test/anamnesebogen-public-route-characterization.test.tsx
```

Ergebnis: Exit-Code 0, kein Output.

## ShadowCopies

Pre-Step-ShadowCopy:

- `/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-093547_pre-phase-2-anamnesebogen-route-characterization`

Post-Step-ShadowCopy wird nach lokalem Commit erstellt.

## Nächster priorisierter Vorschlag

Als nächster kleiner sicherer Schritt sollte die fachliche Entscheidung zur Header-Inkonsistenz vorbereitet werden, ohne sofort Produktivcode zu ändern:

1. Dokumentieren, welche Schalter semantisch gelten sollen:
   - `anamnese_public` / `useAnamnesePublic`: anonyme Online-Route?
   - `anamnese_enabled` / `useAnamneseEnabled`: Header-Sichtbarkeit allgemein?
2. Characterization/Regression für Footer/Home-Links prüfen, weil diese ebenfalls direkt auf `/anamnesebogen` verweisen können.
3. Danach entscheiden, ob Header bei public-enabled + anonymem Besucher ebenfalls den Online-Link zeigen soll oder ob bewusst PDF-only bleiben soll.
