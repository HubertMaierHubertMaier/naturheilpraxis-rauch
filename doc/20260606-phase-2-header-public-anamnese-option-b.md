# Phase 2: Header public Anamnese Option B TDD

## Stand

- Datum: 2026-06-06
- Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `e82853d8a1c8c88da468ad185dea75b65b37a294`
- GitHub/Lovable: kein Push, kein PR, kein Merge.

## Ziel

Die zuvor dokumentierte Entscheidungsvorlage `doc/20260606-phase-2-public-anamnese-semantics-decision.md` beschreibt Option B:

Wenn der öffentliche Online-Anamnesebogen-Testmodus (`anamnese_public` / `useAnamnesePublic`) aktiv ist, soll der Header für anonyme Besucher den Online-Link `/anamnesebogen` anzeigen statt den PDF-Download `Anamnesebogen (PDF)`.

Dieser Schritt setzt Option B lokal, klein und TDD-basiert um.

## Patientendaten-/DSGVO-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine Formularfelder befüllt.
- Keine Anamnese-Submission ausgelöst.
- Keine Supabase-Daten geschrieben.
- Keine Edge Function ausgelöst.
- Keine neue Speicherung oder Übermittlung von Patientendaten aktiviert.
- Die Änderung betrifft nur Header-Link-Sichtbarkeit, nicht Formular-Absenden/Speichern.

## Pre-Step-ShadowCopy

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-114622_pre-phase-2-header-public-anamnese-option-b-tdd
```

Manifest:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-114622_pre-phase-2-header-public-anamnese-option-b-tdd/SHADOWCOPY_MANIFEST.md
```

## Geänderte Dateien

```text
src/components/layout/Header.tsx
src/test/header-anamnese-navigation-smoke.test.tsx
doc/20260606-phase-2-header-public-anamnese-option-b.md
```

## RED

Zuerst wurde der bestehende Header-Test erweitert.

Änderung in `src/test/header-anamnese-navigation-smoke.test.tsx`:

- `useAnamnesePublic()` wird im Header-Test gemockt.
- Default bleibt `public=false`, damit das bisherige anonyme PDF-Verhalten explizit als public-disabled abgesichert ist.
- Neuer Testfall:
  - anonymer Nutzer,
  - `useAnamneseEnabled()` enabled,
  - `useAnamnesePublic()` enabled,
  - Erwartung: Header zeigt Online-Link `Anamnesebogen` mit `href="/anamnesebogen"`, kein `download`, kein PDF-Link.

RED-Befehl:

```sh
npx vitest run src/test/header-anamnese-navigation-smoke.test.tsx
```

RED-Ergebnis:

```text
Test Files  1 failed (1)
Tests       1 failed | 3 passed (4)
```

Erwarteter Fehler:

```text
Unable to find an accessible element with the role "link" and name `/^Anamnesebogen$/i`
```

Beobachtung aus RED-Ausgabe:

```text
Name "Anamnesebogen (PDF)"
href="/anamnesebogen-blanko.pdf"
download=""
```

Bewertung: RED war fachlich korrekt. Der Test scheiterte genau daran, dass der Header public-enabled noch nicht berücksichtigt hatte.

## GREEN / minimaler Produktivcode-Fix

Änderung in `src/components/layout/Header.tsx`:

- `useAnamnesePublic()` importiert.
- `anamnesePublic` im Header gelesen.
- `showAnamnese` erweitert:

```ts
const showAnamnese = anamneseEnabled || anamnesePublic || isAdmin;
```

- neue Online-Link-Bedingung:

```ts
const showOnlineAnamnese = user || isAdmin || anamnesePublic;
```

- Desktop- und Mobile-Anamnese-Navigation verwenden jetzt `showOnlineAnamnese`.
- Bestehendes Verhalten bleibt erhalten:
  - public-disabled + anonym + enabled: PDF-Download,
  - eingeloggter Patient: Online-Link,
  - Admin: Online-Link, bei disabled mit `gesperrt`-Marker.
- Kommentar zur Desktop-Anamnese-Navigation wurde an die neue Semantik angepasst.

GREEN-Befehl:

```sh
npx vitest run src/test/header-anamnese-navigation-smoke.test.tsx
```

GREEN-Ergebnis:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
Duration    631ms
```

Nach der Kommentar-Korrektur wurde der fokussierte Test erneut ausgeführt:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
Duration    623ms
```

## Relevante Regressions-Tests

Befehl:

```sh
npx vitest run \
  src/test/header-anamnese-navigation-smoke.test.tsx \
  src/test/anamnesebogen-public-route-characterization.test.tsx \
  src/test/public-anamnese-link-surfaces-characterization.test.tsx \
  src/test/anamnese-route-guard-smoke.test.tsx
```

Ergebnis:

```text
Test Files  4 passed (4)
Tests       10 passed (10)
Duration    2.00s
```

## Volle lokale Gates

### Vollständige Testsuite

Befehl:

```sh
npm test
```

Ergebnis:

```text
Test Files  8 passed (8)
Tests       16 passed (16)
Duration    2.36s
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

- Browserslist/caniuse-lite ist veraltet.
- Chunk-Größenwarnung: `index-Bq7qWWo2.js` größer als 500 kB nach Minification.

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
LINT_EXIT_CODE=1
```

Bewertung: unverändert zur bekannten Phase-2-Baseline, daher kein Blocker.

### Isolierter ESLint-Check geänderte TSX-Dateien

Befehl:

```sh
npx eslint src/components/layout/Header.tsx src/test/header-anamnese-navigation-smoke.test.tsx
```

Ergebnis: Exit-Code 0, kein Output.

## Sicherheitsbewertung

Die Änderung macht den anonymen Online-Link im Header nur sichtbar, wenn `anamnese_public` aktiv ist. Sie ändert nicht:

- `AnamneseRouteGuard`,
- Formularvalidierung,
- Speicherung,
- Submission,
- Auth-Provider,
- Supabase-Client,
- Edge Functions,
- Datenbanktabellen oder RLS.

Das Risiko ist daher auf UI-Link-Sichtbarkeit begrenzt und durch Tests abgesichert.

## Post-Step-ShadowCopy

Wird nach lokalem Commit erstellt.

## Nächster priorisierter Vorschlag

Nach Commit und Post-Step-ShadowCopy sollte als nächster kleiner Schritt die Anamnesebogen-Seite selbst patientendatenfrei charakterisiert werden:

- anonymer public-enabled Besucher,
- Online-Form sichtbar,
- Absenden/Speichern ohne Login weiterhin nicht erfolgreich bzw. nicht als regulärer Patientendatenkanal nutzbar,
- keine echten Patientendaten,
- keine echte Submission.

Damit wird das größte verbleibende Risiko von Option B abgesichert: Der Header macht den Online-Testmodus sichtbarer, also sollte die Formseite klar gegen Missverständnisse und ungesicherte anonyme Speicherung abgesichert sein.
