# Phase 2: Public Anamnese link surfaces characterization

## Stand

- Datum: 2026-06-06
- Projektpfad: `/home/klaus999/projects/naturheilpraxis-rauch`
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `426ead640136d78ddb77c263c8dd9c5f014f78b1`
- GitHub/Lovable: kein Push, kein PR, kein Merge.

## Ziel

Nach der Route-Level-Charakterisierung von `/anamnesebogen` wurde der nächste sichere Schritt umgesetzt: öffentliche Anamnese-Einstiegspunkte außerhalb des Headers wurden eingefroren.

Hintergrund:

- Route-Level ist `/anamnesebogen` bei `anamnese_public` / `useAnamnesePublic()` enabled anonym online erreichbar.
- Der Header zeigt anonym bei `useAnamneseEnabled()` enabled weiterhin den PDF-Download `Anamnesebogen (PDF)`.
- Vor einer fachlichen Header-Entscheidung sollen weitere öffentliche Link-Surfaces akkurat dokumentiert sein.

## Änderung

Neue Testdatei:

- `src/test/public-anamnese-link-surfaces-characterization.test.tsx`

Der Test charakterisiert patientendatenfrei:

1. Footer-Navigation:
   - sichtbarer Link `Anamnesebogen`,
   - `href="/anamnesebogen"`,
   - kein `download`-Attribut.
2. Home/Feature-Kachel-Komponente `FeaturesSection`:
   - sichtbare Anamnese-Kachel mit Beschreibung und CTA `Mehr erfahren`,
   - `href="/anamnesebogen"`,
   - kein `download`-Attribut.

Produktivcode wurde nicht geändert.

## Ergebnis / Charakterisierung

Der Test war sofort grün. Daher wurde kein künstlicher Produktivcode-Fix erzwungen.

Aktuell charakterisiertes Verhalten:

- Footer verweist öffentlich direkt auf die Online-Route `/anamnesebogen`.
- Die vorhandene Home/Features-Kachel-Komponente verweist ebenfalls direkt auf die Online-Route `/anamnesebogen`.
- Beide Link-Surfaces verwenden keinen PDF-Download.
- Damit ist die Header-Abweichung weiter eingegrenzt: Header anonym zeigt PDF, während andere öffentliche Link-Surfaces direkt auf die Online-Route zeigen können.

## Zusätzlich beobachtete Link-Surfaces

Bei der Code-Suche wurden weitere `/anamnesebogen`-Verweise gesehen, die in späteren kleinen Schritten bei Bedarf charakterisiert werden sollten:

- `src/pages/FAQ.tsx`: CTA-Link zu `/anamnesebogen`.
- `src/pages/Erstanmeldung.tsx`: Navigation zu `/anamnesebogen` mit `state: { from: "erstanmeldung" }`.

Diese wurden in diesem Schritt bewusst nicht geändert und nicht in Produktivcode angefasst, um den Schritt klein und stabil zu halten.

## Patientendaten-/DSGVO-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine Formulareingaben erstellt.
- Keine Anamnese-Submission, keine Verifikation, keine Supabase-Function ausgelöst.
- Nur statische Link-Ziele geprüft.
- Keine unsicheren digitalen Patientendaten-Flows neu aktiviert.

## Verifikation

### Fokussierter Test

Befehl:

```sh
npx vitest run src/test/public-anamnese-link-surfaces-characterization.test.tsx
```

Ergebnis:

```text
Test Files  1 passed (1)
Tests       2 passed (2)
Duration    517ms
```

### Vollständige Testsuite

Befehl:

```sh
npm test
```

Ergebnis:

```text
Test Files  8 passed (8)
Tests       15 passed (15)
Duration    2.34s
```

### Build

Befehl:

```sh
npm run build
```

Ergebnis:

```text
3309 modules transformed
built in 4.76s
```

Bekannte nicht-blockierende Warnungen:

- Browserslist/caniuse-lite veraltet.
- Chunk-Größenwarnung: einige Chunks größer als 500 kB nach Minification.

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
npx eslint src/test/public-anamnese-link-surfaces-characterization.test.tsx
```

Ergebnis: Exit-Code 0, kein Output.

## ShadowCopies

Pre-Step-ShadowCopy:

- `/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-094101_pre-phase-2-public-anamnese-link-surfaces-characterization`

Post-Step-ShadowCopy wird nach lokalem Commit erstellt.

## Nächster priorisierter Vorschlag

Als nächster optimaler kleiner Schritt sollte die Schalter-Semantik in einem Entscheidungs-/Risk-Dokument festgehalten werden, bevor Produktivcode geändert wird:

1. `useAnamnesePublic` / `anamnese_public`: semantisch aktuell Online-Route anonym erlaubt.
2. `useAnamneseEnabled` / `anamnese_enabled`: semantisch aktuell Header-Sichtbarkeit/Verfügbarkeit, aber nicht identisch mit Route-Level-Public-Zugang.
3. Entscheidungsvorlage: Soll der Header bei public-enabled + anonymem Besucher ebenfalls den Online-Link zeigen, oder bleibt PDF-only bewusst?  
4. Falls Änderung fachlich eindeutig gewünscht wird: erst gezielten RED-Test im bestehenden Header-Characterization-Test ergänzen, dann minimalen Header-Produktivcode anpassen.
