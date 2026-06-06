# Phase 2 – Public Anamnesebogen submission-safety characterization

- Datum: 2026-06-06
- Branch: `stabilization/phase-2-testid-and-security-baseline`
- Ausgangs-HEAD: `0950adb4bab6e4fa96d331135d38a9ee18bce435`
- Schrittart: kleiner patientendatenfreier Characterization-/Security-Boundary-Test
- Produktivcode geändert: nein
- Push/PR/Merge: nein

## Ziel

Nach der Header-Option-B-Anpassung ist der Online-Anamnesebogen bei `anamnese_public=true` für anonyme Besucher sichtbarer erreichbar. Dieser Schritt sichert deshalb eine kleine, sichere Grenze der öffentlich erreichbaren Seite ab:

- anonymer Besucher,
- `anamnese_public=true`,
- Route `/anamnesebogen`,
- Auswahl der Accordion-Darstellung,
- leerer Absendeversuch,
- keine echten Patientendaten,
- keine echte Submission,
- keine Supabase-/Edge-Function-Übermittlung vor gültigen Pflichtfeldern.

## Geänderte Dateien

- `src/test/anamnesebogen-public-submission-safety-characterization.test.tsx`
- `doc/20260606-phase-2-public-anamnesebogen-submission-safety.md`

Die bereits vorher vorhandene untracked Datei `doc/20260606-next-session-handoff-phase-2-header-anamnese.md` wurde nicht verändert und wird nicht in diesen Schritt aufgenommen.

## Code- und Risikobeobachtung

`src/pages/Anamnesebogen.tsx` enthält weiterhin produktiven Submission-Code, der nach erfüllter Validierung `supabase.functions.invoke('submit-anamnesis', ...)` aufruft. Dieser Schritt ändert diesen Flow bewusst nicht, sondern friert zunächst eine kleinere, eindeutig testbare Barriere ein: Ohne Pflichtfelder darf kein Invoke erfolgen.

Wichtig: Der Test beweist nicht, dass ein vollständig ausgefüllter anonymer Online-Bogen unmöglich übermittelt werden kann. Diese fachlich/rechtlich größere Frage bleibt als separater Decision-/Security-Gate-Schritt offen und sollte nicht ohne klare Entscheidung und TDD geändert werden.

## Testinhalt

Neuer Test:

`src/test/anamnesebogen-public-submission-safety-characterization.test.tsx`

Charakterisierte Erwartung:

1. `/anamnesebogen` bleibt bei anonymem Nutzer und `anamnese_public=true` erreichbar.
2. Die Layout-Auswahl erscheint.
3. Nach Auswahl von `Alle Bereiche sichtbar` erscheint der Button `Anamnesebogen absenden`.
4. Ein leerer Submit-Versuch zeigt die Pflichtfeld-Validierung:
   - `Bitte füllen Sie alle Pflichtfelder aus (Name, Adresse, E-Mail)`
5. `supabase.functions.invoke` wird dabei nicht aufgerufen.
6. Die Route bleibt `/anamnesebogen`.

## RED-/Setup-Evidence

Beim ersten fokussierten Lauf war der Test zunächst rot wegen Testdouble-/Mock-Aufbau, nicht wegen Produktivcode:

1. Vitest-Hoisting-Fehler im `sonner`-Mock:
   - `Cannot access 'mockToastError' before initialization`
   - Korrektur: `vi.hoisted(...)` für Mock-Funktionen.
2. Fehlender `Toaster`-Export im `sonner`-Mock:
   - Korrektur: harmloser `Toaster: () => null`.
3. Zu schmaler globaler Supabase-/Settings-Testdouble-Pfad über `usePatientLoginEnabled`:
   - `supabase.channel is not a function`
   - Korrektur: testlokaler Mock von `usePatientLoginEnabled`.

Es wurde kein Produktivcode geändert.

## GREEN-Evidence

Fokussierter Test:

```sh
npx vitest run src/test/anamnesebogen-public-submission-safety-characterization.test.tsx
```

Ergebnis:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
```

Verwandte Regressionstests:

```sh
npx vitest run \
  src/test/anamnesebogen-public-submission-safety-characterization.test.tsx \
  src/test/anamnesebogen-public-route-characterization.test.tsx \
  src/test/anamnese-route-guard-smoke.test.tsx \
  src/test/header-anamnese-navigation-smoke.test.tsx \
  src/test/public-anamnese-link-surfaces-characterization.test.tsx
```

Ergebnis:

```text
Test Files  5 passed (5)
Tests       11 passed (11)
```

## Lokale Gates

### `npm test`

```text
Test Files  9 passed (9)
Tests       17 passed (17)
```

### `npm run build`

Ergebnis: erfolgreich.

Relevante Ausgabe:

```text
3309 modules transformed.
✓ built in 4.69s
```

Bekannte nicht-blockierende Warnungen:

- `Browserslist: browsers data (caniuse-lite) is 12 months old`
- Chunk-Größenwarnung: ein Bundle größer als 500 kB nach Minification.

### `npx tsc --noEmit`

Ergebnis: erfolgreich, Exit-Code 0, kein Output.

### `npm run lint`

Ergebnis: bekannte Bestandsschuld, weiterhin unverändert:

```text
✖ 332 problems (300 errors, 32 warnings)
```

Nicht als Blocker bewertet, weil die bekannte Baseline nicht schlechter wurde.

### Isolierter ESLint-Check für neue Datei

```sh
npx eslint src/test/anamnesebogen-public-submission-safety-characterization.test.tsx
```

Ergebnis: Exit-Code 0, kein Output.

## Backups

Pre-Step-ShadowCopy:

```text
/home/klaus999/project-backups/naturheilpraxis-rauch/20260606-120105_pre-phase-2-anamnesebogen-public-submission-safety-characterization
```

Post-Step-ShadowCopy wird nach lokalem Commit erstellt.

## Patientendaten-/DSGVO-Sicherheit

- Keine echten Patientendaten verwendet.
- Keine synthetischen Patientendaten in Formularfelder eingetragen.
- Kein Supabase-Write ausgelöst.
- Kein Edge-Function-Invoke ausgelöst.
- Keine Screenshots erstellt.
- Keine E-Mail-/Anamnese-Submission ausgelöst.

## Nächster priorisierter Vorschlag

Als nächster Schritt sollte eine explizite Decision-/Security-Notiz für den vollständig ausgefüllten anonymen Online-Anamnesebogen erstellt werden:

- Darf `anamnese_public=true` nur ein UI-Testmodus sein?
- Soll ein vollständig ausgefüllter anonymer Submit vor legaler/DSGVO-Prüfung blockiert werden?
- Falls ja: RED-Test zuerst, der eine anonyme vollständige Submission ohne Login/Explizitfreigabe blockiert; danach minimaler Guard im Produktivcode.
- Falls nein: UI-/Hinweistexte und Admin-Beschreibung müssen sehr klar dokumentieren, dass damit ein echter öffentlicher Online-Übermittlungspfad aktiv ist.

Bis zur Entscheidung sollte kein weiterer öffentlicher Patientendaten-Submit-Flow erweitert werden.
